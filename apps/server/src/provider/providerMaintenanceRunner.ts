import {
  defaultInstanceIdForDriver,
  ProviderDriverKind,
  ServerProviderUpdateError,
  type ProviderInstanceId,
  type ServerProvider,
  type ServerProviderUpdatedPayload,
  type ServerProviderUpdateState,
} from "@kairo/contracts";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { ProviderRegistry } from "./Services/ProviderRegistry.ts";
import { makeProviderMaintenanceCommandCoordinator } from "./providerMaintenanceCommandCoordinator.ts";
import { enrichProviderSnapshotWithVersionAdvisory } from "./providerMaintenance.ts";
import type { ProviderMaintenanceCapabilities } from "./providerMaintenance.ts";
import * as ExternalLauncher from "../process/externalLauncher.ts";
const isServerProviderUpdateError = Schema.is(ServerProviderUpdateError);

const UPDATE_TIMEOUT_MS = 5 * 60_000;
const UPDATE_OUTPUT_MAX_BYTES = 10_000;
const AUTH_URL_PATTERN = /https:\/\/[^\s"'<>]+/;

export interface ProviderMaintenanceCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly stdoutTruncated: boolean;
  readonly stderrTruncated: boolean;
}

export interface ProviderMaintenanceRunnerShape {
  readonly loginProvider: (
    target:
      | ProviderDriverKind
      | {
          readonly provider: ProviderDriverKind;
          readonly instanceId?: ProviderInstanceId | undefined;
        },
  ) => Effect.Effect<ServerProviderUpdatedPayload, ServerProviderUpdateError>;
  readonly updateProvider: (
    target:
      | ProviderDriverKind
      | {
          readonly provider: ProviderDriverKind;
          readonly instanceId?: ProviderInstanceId | undefined;
        },
  ) => Effect.Effect<ServerProviderUpdatedPayload, ServerProviderUpdateError>;
}

export class ProviderMaintenanceRunner extends Context.Service<
  ProviderMaintenanceRunner,
  ProviderMaintenanceRunnerShape
>()("kairo/provider/providerMaintenanceRunner") {}

class ProviderMaintenanceCommandError extends Data.TaggedError("ProviderMaintenanceCommandError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

interface VerifiedProviderRefresh {
  readonly providers: ReadonlyArray<ServerProvider>;
  readonly verifiedProviders: ReadonlyArray<ServerProvider>;
}

const nowIso = Effect.map(DateTime.now, DateTime.formatIso);

function authUrlFromOutput(output: string): string | null {
  const match = AUTH_URL_PATTERN.exec(output);
  if (!match) return null;
  let candidate = match[0];
  while (/[),.;:!?]$/.test(candidate)) {
    candidate = candidate.slice(0, -1);
  }
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const collectUint8StreamTextWithTap = Effect.fnUntraced(function* <E, E2>(input: {
  readonly stream: Stream.Stream<Uint8Array, E>;
  readonly maxBytes?: number | undefined;
  readonly onText?: ((text: string) => Effect.Effect<void, E2>) | undefined;
}): Effect.fn.Return<
  {
    readonly text: string;
    readonly truncated: boolean;
    readonly bytes: number;
  },
  E | E2
> {
  const maxBytes = input.maxBytes ?? Number.POSITIVE_INFINITY;
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;

  const processChunk = Effect.fnUntraced(function* (chunk: Uint8Array) {
    if (truncated) {
      const decoded = decoder.decode(chunk, { stream: true });
      if (decoded.length > 0 && input.onText) {
        yield* input.onText(decoded);
      }
      return;
    }

    const remainingBytes = maxBytes - bytes;
    if (remainingBytes <= 0) {
      truncated = true;
      const decoded = decoder.decode(chunk, { stream: true });
      if (decoded.length > 0 && input.onText) {
        yield* input.onText(decoded);
      }
      return;
    }

    const nextChunk = chunk.byteLength > remainingBytes ? chunk.slice(0, remainingBytes) : chunk;
    chunks.push(nextChunk);
    bytes += nextChunk.byteLength;
    truncated = chunk.byteLength > remainingBytes;

    const decoded = decoder.decode(nextChunk, { stream: !truncated });
    if (decoded.length > 0 && input.onText) {
      yield* input.onText(decoded);
    }
  });

  yield* Stream.runForEach(input.stream, processChunk);
  const remainder = truncated ? "" : decoder.decode();
  if (remainder.length > 0 && input.onText) {
    yield* input.onText(remainder);
  }
  return {
    text: Buffer.concat(chunks, bytes).toString("utf8"),
    bytes,
    truncated,
  };
});

const runProviderMaintenanceCommandWithSpawner = Effect.fn("ProviderMaintenanceRunner.runCommand")(
  function* (input: {
    readonly spawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
    readonly command: string;
    readonly args: ReadonlyArray<string>;
    readonly onOutputText?:
      | ((text: string) => Effect.Effect<void, ProviderMaintenanceCommandError>)
      | undefined;
  }) {
    const collectCommandResult = Effect.fn("ProviderMaintenanceRunner.collectCommandResult")(
      function* () {
        const child = yield* input.spawner
          .spawn(ChildProcess.make(input.command, [...input.args]))
          .pipe(
            Effect.mapError(
              (cause) =>
                new ProviderMaintenanceCommandError({
                  message: `Failed to run provider command ${input.command}: ${cause.message}`,
                  cause,
                }),
            ),
          );
        yield* Effect.addFinalizer(() => child.kill().pipe(Effect.ignore));

        const [stdout, stderr, exitCode] = yield* Effect.all(
          [
            collectUint8StreamTextWithTap({
              stream: child.stdout,
              maxBytes: UPDATE_OUTPUT_MAX_BYTES,
              onText: input.onOutputText,
            }),
            collectUint8StreamTextWithTap({
              stream: child.stderr,
              maxBytes: UPDATE_OUTPUT_MAX_BYTES,
              onText: input.onOutputText,
            }),
            child.exitCode,
          ],
          { concurrency: "unbounded" },
        ).pipe(
          Effect.mapError(
            (cause) =>
              new ProviderMaintenanceCommandError({
                message: cause instanceof Error ? cause.message : "Update command failed to run.",
                cause,
              }),
          ),
        );

        return {
          stdout: stdout.text,
          stderr: stderr.text,
          exitCode: Number(exitCode),
          timedOut: false,
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
        } satisfies ProviderMaintenanceCommandResult;
      },
    );

    return yield* collectCommandResult().pipe(
      Effect.scoped,
      Effect.timeoutOption(Duration.millis(UPDATE_TIMEOUT_MS)),
      Effect.map((result) =>
        Option.match(result, {
          onSome: (value) => value,
          onNone: () =>
            ({
              stdout: "",
              stderr: "",
              exitCode: null,
              timedOut: true,
              stdoutTruncated: false,
              stderrTruncated: false,
            }) satisfies ProviderMaintenanceCommandResult,
        }),
      ),
    );
  },
);

function trimNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function commandOutput(result: ProviderMaintenanceCommandResult): string | null {
  const output = trimNullable([result.stderr, result.stdout].filter(Boolean).join("\n\n"));
  if (!output) {
    return null;
  }
  return truncateText(output, UPDATE_OUTPUT_MAX_BYTES);
}

function failureMessage(result: ProviderMaintenanceCommandResult, commandLabel: string): string {
  if (result.timedOut) {
    return `${commandLabel} timed out.`;
  }
  if (result.exitCode !== null && result.exitCode !== 0) {
    return `${commandLabel} exited with code ${result.exitCode}.`;
  }
  return `${commandLabel} failed.`;
}

function isOutdatedProvider(provider: ServerProvider | undefined): boolean {
  return provider?.versionAdvisory?.status === "behind_latest";
}

function makeUpdateState(input: {
  readonly status: ServerProviderUpdateState["status"];
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly message: string | null;
  readonly output?: string | null;
}): ServerProviderUpdateState {
  return {
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    message: input.message,
    output: input.output ?? null,
  };
}

export const make = Effect.fn("ProviderMaintenanceRunner.make")(function* () {
  const providerRegistry = yield* ProviderRegistry;
  const externalLauncher = yield* ExternalLauncher.ExternalLauncher;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const httpClient = yield* HttpClient.HttpClient;
  const runMaintenanceCommand = (
    command: string,
    args: ReadonlyArray<string>,
    options?: {
      readonly onOutputText?:
        | ((text: string) => Effect.Effect<void, ProviderMaintenanceCommandError>)
        | undefined;
    },
  ) =>
    runProviderMaintenanceCommandWithSpawner({
      spawner,
      command,
      args,
      onOutputText: options?.onOutputText,
    });
  const commandCoordinator = yield* makeProviderMaintenanceCommandCoordinator({
    makeAlreadyRunningError: () =>
      new ServerProviderUpdateError({
        provider: ProviderDriverKind.make("unknown"),
        reason: "An update is already running for this provider.",
      }),
  });

  const resolveTarget = (
    target:
      | ProviderDriverKind
      | {
          readonly provider: ProviderDriverKind;
          readonly instanceId?: ProviderInstanceId | undefined;
        },
  ) => {
    const provider = typeof target === "string" ? target : target.provider;
    const instanceId =
      typeof target === "string"
        ? defaultInstanceIdForDriver(provider)
        : (target.instanceId ?? defaultInstanceIdForDriver(provider));
    return { provider, instanceId };
  };

  const verifyRefreshedProvider = (
    provider: ProviderDriverKind,
    maintenanceCapabilities: ProviderMaintenanceCapabilities,
    instanceId: ProviderInstanceId,
  ): Effect.Effect<VerifiedProviderRefresh> =>
    providerRegistry.getProviders.pipe(
      Effect.map((providers) => {
        const instanceIds: Array<ProviderInstanceId> = [];
        for (const candidate of providers) {
          if (candidate.driver === provider && candidate.instanceId === instanceId) {
            instanceIds.push(candidate.instanceId);
          }
        }
        return instanceIds;
      }),
      Effect.flatMap((instanceIds) =>
        instanceIds.length === 0
          ? providerRegistry.refreshInstance(instanceId)
          : Effect.forEach(
              instanceIds,
              (instanceId) => providerRegistry.refreshInstance(instanceId),
              {
                concurrency: "unbounded",
                discard: true,
              },
            ).pipe(Effect.andThen(providerRegistry.getProviders)),
      ),
      Effect.flatMap((providers) => {
        const refreshedProviders = providers.filter(
          (candidate) => candidate.driver === provider && candidate.instanceId === instanceId,
        );
        if (refreshedProviders.length === 0) {
          return Effect.succeed<VerifiedProviderRefresh>({
            providers,
            verifiedProviders: [],
          });
        }
        return Effect.forEach(
          refreshedProviders,
          (refreshedProvider) =>
            enrichProviderSnapshotWithVersionAdvisory(
              refreshedProvider,
              maintenanceCapabilities,
            ).pipe(Effect.provideService(HttpClient.HttpClient, httpClient)),
          {
            concurrency: "unbounded",
          },
        ).pipe(
          Effect.map(
            (verifiedProviders): VerifiedProviderRefresh => ({
              providers,
              verifiedProviders,
            }),
          ),
          Effect.catchCause((cause) =>
            Effect.logWarning("Provider post-update version verification failed", {
              provider,
              cause: Cause.pretty(cause),
            }).pipe(
              Effect.as<VerifiedProviderRefresh>({
                providers,
                verifiedProviders: refreshedProviders,
              }),
            ),
          ),
        );
      }),
    );

  const loginProvider: ProviderMaintenanceRunnerShape["loginProvider"] = Effect.fn(
    "ProviderMaintenanceRunner.loginProvider",
  )(function* (target) {
    const { provider, instanceId } = resolveTarget(target);
    const capabilities = yield* providerRegistry.getProviderMaintenanceCapabilitiesForInstance(
      instanceId,
      provider,
    );
    const login = capabilities.login;
    if (!login) {
      return yield* new ServerProviderUpdateError({
        provider,
        reason: "This provider does not support one-click login.",
      });
    }

    const setLoginState = (state: ServerProviderUpdateState | null) =>
      providerRegistry.setProviderMaintenanceActionState({
        instanceId,
        action: "login",
        state,
      });

    const runProviderLogin = Effect.fn("ProviderMaintenanceRunner.runProviderLogin")(function* () {
      const finish = (state: ServerProviderUpdateState) =>
        setLoginState(state).pipe(
          Effect.andThen(providerRegistry.refreshInstance(instanceId)),
          Effect.map((providers) => ({ providers })),
        );
      const startedAtRef = yield* Ref.make<string | null>(null);
      const authUrlOpenedRef = yield* Ref.make(false);
      const authOutputBufferRef = yield* Ref.make("");
      const openAuthUrlFromOutput = Effect.fn("ProviderMaintenanceRunner.openAuthUrlFromOutput")(
        function* (text: string) {
          const alreadyOpened = yield* Ref.get(authUrlOpenedRef);
          if (alreadyOpened) return;
          const output = yield* Ref.updateAndGet(authOutputBufferRef, (previous) =>
            `${previous}${text}`.slice(-4_096),
          );
          const authUrl = authUrlFromOutput(output);
          if (!authUrl) return;
          yield* Ref.set(authUrlOpenedRef, true);
          yield* externalLauncher.launchBrowser(authUrl).pipe(
            Effect.mapError(
              (cause) =>
                new ProviderMaintenanceCommandError({
                  message: `Failed to open provider login URL: ${cause.message}`,
                  cause,
                }),
            ),
          );
        },
      );

      const runCommand = Effect.fn("ProviderMaintenanceRunner.runProviderLoginCommand")(
        function* () {
          const startedAt = yield* nowIso;
          yield* Ref.set(startedAtRef, startedAt);
          yield* setLoginState(
            makeUpdateState({
              status: "running",
              startedAt,
              finishedAt: null,
              message: "Logging in provider.",
            }),
          );

          const result = yield* runMaintenanceCommand(login.executable, login.args, {
            onOutputText: openAuthUrlFromOutput,
          });
          const finishedAt = yield* nowIso;
          if (result.timedOut || result.exitCode !== 0) {
            return yield* finish(
              makeUpdateState({
                status: "failed",
                startedAt,
                finishedAt,
                message: failureMessage(result, "Login command"),
                output: commandOutput(result),
              }),
            );
          }

          return yield* finish(
            makeUpdateState({
              status: "succeeded",
              startedAt,
              finishedAt,
              message: "Provider sign-in opened in your browser.",
              output: commandOutput(result),
            }),
          );
        },
      );

      const recordFailedLogin = Effect.fn("ProviderMaintenanceRunner.recordFailedLogin")(function* (
        cause: Cause.Cause<unknown>,
      ) {
        const failure = Cause.squash(cause);
        const startedAt = yield* Ref.get(startedAtRef);
        return yield* finish(
          makeUpdateState({
            status: "failed",
            startedAt,
            finishedAt: yield* nowIso,
            message: failure instanceof Error ? failure.message : "Login command failed.",
            output: null,
          }),
        );
      });

      return yield* runCommand().pipe(Effect.catchCause(recordFailedLogin));
    });

    return yield* commandCoordinator
      .withCommandLock({
        targetKey: `login:${instanceId}`,
        lockKey: login.lockKey,
        onQueued: setLoginState(
          makeUpdateState({
            status: "queued",
            startedAt: null,
            finishedAt: null,
            message: "Waiting for another provider login to finish.",
          }),
        ).pipe(Effect.asVoid),
        run: runProviderLogin(),
      })
      .pipe(
        Effect.flatMap(() =>
          setLoginState(null).pipe(
            Effect.andThen(providerRegistry.refreshInstance(instanceId)),
            Effect.map((providers) => ({ providers })),
          ),
        ),
        Effect.mapError((error) =>
          isServerProviderUpdateError(error)
            ? new ServerProviderUpdateError({
                provider,
                reason: error.reason,
              })
            : error,
        ),
      );
  });

  const updateProvider: ProviderMaintenanceRunnerShape["updateProvider"] = Effect.fn(
    "ProviderMaintenanceRunner.updateProvider",
  )(function* (target) {
    const { provider, instanceId } = resolveTarget(target);
    const targetKey = `update:${instanceId}`;
    const capabilities = yield* providerRegistry.getProviderMaintenanceCapabilitiesForInstance(
      instanceId,
      provider,
    );
    const update = capabilities.update;
    if (!update) {
      return yield* new ServerProviderUpdateError({
        provider,
        reason: "This provider does not support one-click updates.",
      });
    }

    const setUpdateState = (state: ServerProviderUpdateState | null) =>
      providerRegistry.setProviderMaintenanceActionState({
        instanceId,
        action: "update",
        state,
      });
    const setQueuedState = setUpdateState(
      makeUpdateState({
        status: "queued",
        startedAt: null,
        finishedAt: null,
        message: "Waiting for another provider update to finish.",
      }),
    ).pipe(Effect.asVoid);

    const runProviderUpdate = Effect.fn("ProviderMaintenanceRunner.runProviderUpdate")(
      function* () {
        const finish = (state: ServerProviderUpdateState) =>
          setUpdateState(state).pipe(Effect.map((providers) => ({ providers })));
        const startedAtRef = yield* Ref.make<string | null>(null);

        const runCommandAndVerify = Effect.fn("ProviderMaintenanceRunner.runCommandAndVerify")(
          function* () {
            const startedAt = yield* nowIso;
            yield* Ref.set(startedAtRef, startedAt);
            yield* setUpdateState(
              makeUpdateState({
                status: "running",
                startedAt,
                finishedAt: null,
                message: "Updating provider.",
              }),
            );

            const result = yield* runMaintenanceCommand(update.executable, update.args);
            const finishedAt = yield* nowIso;
            if (result.timedOut || result.exitCode !== 0) {
              return yield* finish(
                makeUpdateState({
                  status: "failed",
                  startedAt,
                  finishedAt,
                  message: failureMessage(result, "Update command"),
                  output: commandOutput(result),
                }),
              );
            }

            const { verifiedProviders } = yield* verifyRefreshedProvider(
              provider,
              capabilities,
              instanceId,
            );
            const couldNotVerify = verifiedProviders.length === 0;
            const stillOutdated =
              couldNotVerify ||
              verifiedProviders.some((verifiedProvider) => isOutdatedProvider(verifiedProvider));
            return yield* finish(
              makeUpdateState({
                status: stillOutdated ? "unchanged" : "succeeded",
                startedAt,
                finishedAt,
                message: couldNotVerify
                  ? "Update command completed, but Kairo could not verify the provider version."
                  : stillOutdated
                    ? "Update command completed, but Kairo still detects an outdated provider version."
                    : "Provider updated.",
                output: commandOutput(result),
              }),
            );
          },
        );

        const recordFailedUpdate = Effect.fn("ProviderMaintenanceRunner.recordFailedUpdate")(
          function* (cause: Cause.Cause<unknown>) {
            const failure = Cause.squash(cause);
            const startedAt = yield* Ref.get(startedAtRef);
            return yield* finish(
              makeUpdateState({
                status: "failed",
                startedAt,
                finishedAt: yield* nowIso,
                message: failure instanceof Error ? failure.message : "Update command failed.",
                output: null,
              }),
            );
          },
        );

        return yield* runCommandAndVerify().pipe(Effect.catchCause(recordFailedUpdate));
      },
    );

    return yield* commandCoordinator
      .withCommandLock({
        targetKey,
        lockKey: update.lockKey,
        onQueued: setQueuedState,
        run: runProviderUpdate(),
      })
      .pipe(
        Effect.mapError((error) =>
          isServerProviderUpdateError(error)
            ? new ServerProviderUpdateError({
                provider,
                reason: error.reason,
              })
            : error,
        ),
      );
  });

  return ProviderMaintenanceRunner.of({
    loginProvider,
    updateProvider,
  });
});

export const layer = Layer.effect(ProviderMaintenanceRunner, make());
