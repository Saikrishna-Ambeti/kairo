import { useAuth } from "@clerk/expo";
import { AuthView, type UserProfileCustomPage, UserProfileView } from "@clerk/expo/native";
import { StackActions, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { View } from "react-native";

import { hasCloudIdentityConfig, hasManagedRelayConfig } from "../cloud/publicConfig";
import { KairoConnectProfilePage } from "../cloud/KairoConnectProfilePage";

// Custom rows in Clerk's native profile. Mirrors the web UserButton pages.
const USER_PROFILE_CUSTOM_PAGES = [
  {
    path: "kairo-connect",
    label: "Kairo Connect",
    icon: "globe",
    content: <KairoConnectProfilePage />,
  },
] satisfies UserProfileCustomPage[];

export function SettingsAuthRouteScreen() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    if (!hasCloudIdentityConfig()) {
      navigation.dispatch(StackActions.replace("SettingsContent"));
    }
  }, [navigation]);

  return hasCloudIdentityConfig() ? <ConfiguredSettingsAuthRouteScreen /> : null;
}

function ConfiguredSettingsAuthRouteScreen() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const navigation = useNavigation();
  const handleHostBack = useCallback(
    () => navigation.dispatch(StackActions.popTo("SettingsContent")),
    [navigation],
  );
  const hasBeenSignedIn = useRef(isSignedIn);
  if (isSignedIn) {
    hasBeenSignedIn.current = true;
  }

  useEffect(() => {
    if (hasBeenSignedIn.current && isLoaded && isSignedIn === false) {
      navigation.dispatch(StackActions.popTo("SettingsContent"));
    }
  }, [isLoaded, isSignedIn, navigation]);

  return (
    <View collapsable={false} className="flex-1 overflow-hidden bg-sheet">
      {isLoaded ? (
        hasBeenSignedIn.current ? (
          <UserProfileView
            customPages={hasManagedRelayConfig() ? USER_PROFILE_CUSTOM_PAGES : []}
            isDismissible={false}
            onHostBack={handleHostBack}
          />
        ) : (
          <AuthView isDismissible={false} onHostBack={handleHostBack} />
        )
      ) : null}
    </View>
  );
}
