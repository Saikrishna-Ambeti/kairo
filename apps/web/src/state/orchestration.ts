import { ORCHESTRATION_V2_WS_METHODS } from "@kairo/contracts";
import { createOrchestrationEnvironmentAtoms } from "@kairo/client-runtime/state/orchestration";
import { createEnvironmentRpcCommand } from "@kairo/client-runtime/state/runtime";

import { connectionAtomRuntime } from "../connection/runtime";
import { environmentShell } from "./shell";

export const orchestrationEnvironment = createOrchestrationEnvironmentAtoms(connectionAtomRuntime, {
  shellState: environmentShell.stateValueAtom,
});

export const threadTitlesRead = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:orchestration:thread-titles-read",
  tag: ORCHESTRATION_V2_WS_METHODS.getThreadTitles,
});
