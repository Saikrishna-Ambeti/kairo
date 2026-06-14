import type { AuthClientPresentationMetadata } from "@kairo/contracts";
import { Platform } from "react-native";

export function mobileAuthClientMetadata(): AuthClientPresentationMetadata {
  return {
    label: "Kairo Mobile",
    deviceType: "mobile",
    ...(Platform.OS === "ios" ? { os: "iOS" } : Platform.OS === "android" ? { os: "Android" } : {}),
  };
}
