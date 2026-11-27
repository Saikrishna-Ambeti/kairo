import {
  type AtomCommandResult,
  squashAtomCommandFailure,
} from "@kairo/client-runtime/state/runtime";
import type {
  ConfigureComposioInput,
  ConfigureMemoryInput,
  ProviderInstanceId,
  ServerProviderUpdateInput,
  TestComposioConnectionInput,
} from "@kairo/contracts";

import { usePrimaryEnvironment } from "./environments";
import { serverEnvironment } from "./server";
import { useAtomCommand } from "./use-atom-command";

function unwrapCommandResult<A, E>(result: AtomCommandResult<A, E>): A {
  if (result._tag === "Success") return result.value;
  throw squashAtomCommandFailure(result);
}

async function runCommand<A, E>(promise: Promise<AtomCommandResult<A, E>>): Promise<A> {
  return unwrapCommandResult(await promise);
}

export function usePrimaryServerApi() {
  const environmentId = usePrimaryEnvironment()?.environmentId ?? null;
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const startProviderAuth = useAtomCommand(serverEnvironment.startProviderAuth, {
    reportFailure: false,
  });
  const updateProvider = useAtomCommand(serverEnvironment.updateProvider, { reportFailure: false });
  const getMemoryStatus = useAtomCommand(serverEnvironment.getMemoryStatus, {
    reportFailure: false,
  });
  const configureMemory = useAtomCommand(serverEnvironment.configureMemory, {
    reportFailure: false,
  });
  const disableMemory = useAtomCommand(serverEnvironment.disableMemory, { reportFailure: false });
  const getComposioStatus = useAtomCommand(serverEnvironment.getComposioStatus, {
    reportFailure: false,
  });
  const configureComposio = useAtomCommand(serverEnvironment.configureComposio, {
    reportFailure: false,
  });
  const testComposioConnection = useAtomCommand(serverEnvironment.testComposioConnection, {
    reportFailure: false,
  });
  const disableComposio = useAtomCommand(serverEnvironment.disableComposio, {
    reportFailure: false,
  });

  const requireEnvironmentId = () => {
    if (environmentId === null) throw new Error("No primary environment is connected.");
    return environmentId;
  };

  return {
    refreshProviders: (input: { readonly instanceId?: ProviderInstanceId } = {}) =>
      runCommand(refreshProviders({ environmentId: requireEnvironmentId(), input })),
    startProviderAuth: (input: { readonly instanceId: ProviderInstanceId }) =>
      runCommand(
        startProviderAuth({
          environmentId: requireEnvironmentId(),
          input: { instanceId: input.instanceId },
        }),
      ),
    updateProvider: (input: ServerProviderUpdateInput) =>
      runCommand(updateProvider({ environmentId: requireEnvironmentId(), input })),
    getMemoryStatus: () =>
      runCommand(getMemoryStatus({ environmentId: requireEnvironmentId(), input: {} })),
    configureMemory: (input: ConfigureMemoryInput) =>
      runCommand(configureMemory({ environmentId: requireEnvironmentId(), input })),
    disableMemory: () =>
      runCommand(disableMemory({ environmentId: requireEnvironmentId(), input: {} })),
    getComposioStatus: () =>
      runCommand(getComposioStatus({ environmentId: requireEnvironmentId(), input: {} })),
    configureComposio: (input: ConfigureComposioInput) =>
      runCommand(configureComposio({ environmentId: requireEnvironmentId(), input })),
    testComposioConnection: (input: TestComposioConnectionInput = {}) =>
      runCommand(testComposioConnection({ environmentId: requireEnvironmentId(), input })),
    disableComposio: () =>
      runCommand(disableComposio({ environmentId: requireEnvironmentId(), input: {} })),
  };
}
