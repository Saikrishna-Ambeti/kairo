import { useAtomValue } from "@effect/atom-react";

import { primaryServerProvidersAtom, primaryServerSettingsAtom } from "../state/server";

export function useServerProviders() {
  return useAtomValue(primaryServerProvidersAtom);
}

export function useServerSettings() {
  return useAtomValue(primaryServerSettingsAtom);
}
