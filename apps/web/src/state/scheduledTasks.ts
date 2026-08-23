import { createScheduledTaskEnvironmentAtoms } from "@kairo/client-runtime/state/scheduled-tasks";

import { connectionAtomRuntime } from "../connection/runtime";

export const scheduledTaskEnvironment = createScheduledTaskEnvironmentAtoms(connectionAtomRuntime);
