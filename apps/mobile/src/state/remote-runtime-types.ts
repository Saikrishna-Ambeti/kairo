import type {
  EnvironmentConnection,
  EnvironmentConnectionState,
  WsRpcClient,
} from "@kairo/client-runtime";
import { EnvironmentId, ThreadId } from "@kairo/contracts";

export type { EnvironmentRuntimeState } from "@kairo/client-runtime";

export interface ConnectedEnvironmentSummary {
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly displayUrl: string;
  readonly isRelayManaged: boolean;
  readonly connectionState: EnvironmentConnectionState;
  readonly connectionError: string | null;
}

export interface SelectedThreadRef {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}

export interface EnvironmentSession {
  readonly client: WsRpcClient;
  readonly connection: EnvironmentConnection;
}
