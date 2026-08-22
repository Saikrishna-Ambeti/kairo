import { createRelayEnvironmentDiscoveryAtoms } from "@kairo/client-runtime/state/relay";

import { connectionAtomRuntime } from "../connection/runtime";

export const relayEnvironmentDiscovery: ReturnType<typeof createRelayEnvironmentDiscoveryAtoms> =
  createRelayEnvironmentDiscoveryAtoms(connectionAtomRuntime);
