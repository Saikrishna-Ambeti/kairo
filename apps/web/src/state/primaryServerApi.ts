import {
  type AtomCommandResult,
  squashAtomCommandFailure,
} from "@kairo/client-runtime/state/runtime";
import type {
  ComposioOperationProgressEvent,
  ConfigureMemoryInput,
  InstallComposioAgentSupportInput,
  InstallComposioInput,
  InstallMemoryProvidersInput,
  LinkComposioToolkitInput,
  ListComposioToolkitsInput,
  ProviderInstanceId,
  ServerProviderUpdateInput,
  TestMemoryConnectionInput,
} from "@kairo/contracts";
import { useCallback } from "react";

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
  const loginProvider = useAtomCommand(serverEnvironment.loginProvider, { reportFailure: false });
  const updateProvider = useAtomCommand(serverEnvironment.updateProvider, { reportFailure: false });
  const getMemoryStatus = useAtomCommand(serverEnvironment.getMemoryStatus, {
    reportFailure: false,
  });
  const configureMemory = useAtomCommand(serverEnvironment.configureMemory, {
    reportFailure: false,
  });
  const testMemoryConnection = useAtomCommand(serverEnvironment.testMemoryConnection, {
    reportFailure: false,
  });
  const installMemoryProviders = useAtomCommand(serverEnvironment.installMemoryProviders, {
    reportFailure: false,
  });
  const disableMemory = useAtomCommand(serverEnvironment.disableMemory, { reportFailure: false });
  const getComposioStatus = useAtomCommand(serverEnvironment.getComposioStatus, {
    reportFailure: false,
  });
  const listComposioToolkits = useAtomCommand(serverEnvironment.listComposioToolkits, {
    reportFailure: false,
  });
  const installAndLoginComposio = useAtomCommand(serverEnvironment.composioInstallAndLogin, {
    reportFailure: false,
  });
  const loginComposio = useAtomCommand(serverEnvironment.composioLogin, { reportFailure: false });
  const linkComposioToolkit = useAtomCommand(serverEnvironment.composioLinkToolkit, {
    reportFailure: false,
  });
  const installComposioAgentSupport = useAtomCommand(
    serverEnvironment.installComposioAgentSupport,
    { reportFailure: false },
  );
  const disableComposio = useAtomCommand(serverEnvironment.disableComposio, {
    reportFailure: false,
  });

  const requireEnvironmentId = useCallback(() => {
    if (environmentId === null) throw new Error("No primary environment is connected.");
    return environmentId;
  }, [environmentId]);

  return {
    refreshProviders: (input: { readonly instanceId?: ProviderInstanceId } = {}) =>
      runCommand(refreshProviders({ environmentId: requireEnvironmentId(), input })),
    loginProvider: (input: ServerProviderUpdateInput) =>
      runCommand(loginProvider({ environmentId: requireEnvironmentId(), input })),
    updateProvider: (input: ServerProviderUpdateInput) =>
      runCommand(updateProvider({ environmentId: requireEnvironmentId(), input })),
    getMemoryStatus: () =>
      runCommand(getMemoryStatus({ environmentId: requireEnvironmentId(), input: {} })),
    configureMemory: (input: ConfigureMemoryInput) =>
      runCommand(configureMemory({ environmentId: requireEnvironmentId(), input })),
    testMemoryConnection: (input: TestMemoryConnectionInput = {}) =>
      runCommand(testMemoryConnection({ environmentId: requireEnvironmentId(), input })),
    installMemoryProviders: (input: InstallMemoryProvidersInput) =>
      runCommand(installMemoryProviders({ environmentId: requireEnvironmentId(), input })),
    disableMemory: () =>
      runCommand(disableMemory({ environmentId: requireEnvironmentId(), input: {} })),
    getComposioStatus: () =>
      runCommand(getComposioStatus({ environmentId: requireEnvironmentId(), input: {} })),
    listComposioToolkits: (input: ListComposioToolkitsInput) =>
      runCommand(listComposioToolkits({ environmentId: requireEnvironmentId(), input })),
    installAndLoginComposio: (
      input: InstallComposioInput,
      onProgress?: (event: ComposioOperationProgressEvent) => void,
    ) =>
      runCommand(
        installAndLoginComposio({
          environmentId: requireEnvironmentId(),
          input: { input, ...(onProgress ? { onProgress } : {}) },
        }),
      ),
    loginComposio: (
      input: InstallComposioInput,
      onProgress?: (event: ComposioOperationProgressEvent) => void,
    ) =>
      runCommand(
        loginComposio({
          environmentId: requireEnvironmentId(),
          input: { input, ...(onProgress ? { onProgress } : {}) },
        }),
      ),
    linkComposioToolkit: (
      input: LinkComposioToolkitInput,
      onProgress?: (event: ComposioOperationProgressEvent) => void,
    ) =>
      runCommand(
        linkComposioToolkit({
          environmentId: requireEnvironmentId(),
          input: { input, ...(onProgress ? { onProgress } : {}) },
        }),
      ),
    installComposioAgentSupport: (input: InstallComposioAgentSupportInput) =>
      runCommand(installComposioAgentSupport({ environmentId: requireEnvironmentId(), input })),
    disableComposio: () =>
      runCommand(disableComposio({ environmentId: requireEnvironmentId(), input: {} })),
  };
}
