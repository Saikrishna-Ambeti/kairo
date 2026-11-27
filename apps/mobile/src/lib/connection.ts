import { EnvironmentId } from "@kairo/contracts";
import { type EnvironmentConnectionPhase } from "@kairo/client-runtime/connection";

export interface SavedRemoteConnection {
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly pairingUrl: string;
  readonly displayUrl: string;
  readonly httpBaseUrl: string;
  readonly wsBaseUrl: string;
  readonly bearerToken: string | null;
  readonly authenticationMethod?: "bearer" | "dpop";
  readonly dpopAccessToken?: string;
  readonly relayManaged?: true;
}

export type RemoteClientConnectionState = EnvironmentConnectionPhase;
