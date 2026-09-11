import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface AndroidAgentNotifications {
  configure(deviceId: string, userId: string, scheme: string, ongoingEnabled: boolean): void;
  clear(): void;
}

const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<AndroidAgentNotifications>("KairoAgentNotifications")
    : null;

export function supportsAndroidAgentNotifications(): boolean {
  return typeof native?.configure === "function" && typeof native?.clear === "function";
}

export function configureAndroidAgentNotifications(
  deviceId: string,
  userId: string,
  ongoingEnabled: boolean,
): void {
  const scheme = Constants.expoConfig?.scheme;
  native?.configure?.(
    deviceId,
    userId,
    (Array.isArray(scheme) ? scheme[0] : scheme) ?? "kairo",
    ongoingEnabled,
  );
}

export function clearAndroidAgentNotifications(): void {
  native?.clear?.();
}
