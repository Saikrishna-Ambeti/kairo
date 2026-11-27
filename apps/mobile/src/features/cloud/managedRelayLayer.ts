import { DpopProof, ManagedRelay } from "@kairo/client-runtime/relay";
import { RelayMobileClientId } from "@kairo/contracts/relay";
import * as Layer from "effect/Layer";

import { loadOrCreateProofKey } from "./dpop";
import { managedRelayAccessTokenStore } from "./managedRelayTokenStore";

const layerRelayDpopSigner = DpopProof.layerSigner({
  keyStore: "expo-secure-store",
  loadOrCreateKey: loadOrCreateProofKey(),
});

export const layer = (relayUrl: string | null) =>
  ManagedRelay.layer({
    relayUrl,
    clientId: RelayMobileClientId,
    accessTokenStore: managedRelayAccessTokenStore,
  }).pipe(Layer.provideMerge(layerRelayDpopSigner));
