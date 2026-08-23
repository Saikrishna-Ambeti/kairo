import { WS_METHODS } from "@kairo/contracts";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import {
  createAtomCommandScheduler,
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "./runtime.ts";

export function createScheduledTaskEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  const scheduler = createAtomCommandScheduler();
  const serialPerEnvironment = {
    mode: "serial",
    key: ({ environmentId }: { readonly environmentId: string }) => environmentId,
  } as const;

  return {
    snapshot: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:scheduled-tasks:snapshot",
      tag: WS_METHODS.scheduledTasksGetSnapshot,
      staleTimeMs: 1_000,
    }),
    dispatch: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:scheduled-tasks:dispatch",
      tag: WS_METHODS.scheduledTasksDispatch,
      scheduler,
      concurrency: serialPerEnvironment,
    }),
    fireExternal: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:scheduled-tasks:fire-external",
      tag: WS_METHODS.scheduledTasksFireExternal,
      scheduler,
      concurrency: serialPerEnvironment,
    }),
  };
}
