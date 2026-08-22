import { UserButton, useAuth } from "@clerk/react";
import { LogInIcon, ServerIcon, SmartphoneIcon } from "lucide-react";

import { hasCloudIdentityConfig, hasManagedRelayConfig } from "../../cloud/publicConfig";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { MobileClientsUserProfilePage } from "./MobileClientsUserProfilePage";
import { KairoConnectUserProfilePage } from "./KairoConnectUserProfilePage";
import { useKairoConnectAuthPrompt } from "./useKairoConnectAuthPrompt";

export function KairoConnectSidebarSignIn() {
  if (!hasCloudIdentityConfig()) return null;

  return <ConfiguredKairoConnectSidebarSignIn managedRelayEnabled={hasManagedRelayConfig()} />;
}

export function KairoConnectSidebarAvatar() {
  if (!hasCloudIdentityConfig()) return null;

  return <ConfiguredKairoConnectSidebarAvatar managedRelayEnabled={hasManagedRelayConfig()} />;
}

function ConfiguredKairoConnectSidebarAvatar({
  managedRelayEnabled,
}: {
  readonly managedRelayEnabled: boolean;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded || !isSignedIn) return null;

  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: "size-7",
          userButtonTrigger: "rounded-lg p-1 hover:bg-sidebar-row-hover",
        },
      }}
    >
      {managedRelayEnabled ? (
        <UserButton.UserProfilePage
          label="Mobile clients"
          labelIcon={<SmartphoneIcon className="size-4" />}
          url="mobile-clients"
        >
          <MobileClientsUserProfilePage />
        </UserButton.UserProfilePage>
      ) : null}
      {managedRelayEnabled ? (
        <UserButton.UserProfilePage
          label="Kairo Connect"
          labelIcon={<ServerIcon className="size-4" />}
          url="kairo-connect"
        >
          <KairoConnectUserProfilePage />
        </UserButton.UserProfilePage>
      ) : null}
    </UserButton>
  );
}

function ConfiguredKairoConnectSidebarSignIn({
  managedRelayEnabled,
}: {
  readonly managedRelayEnabled: boolean;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { authPrompt, openAuthPrompt } = useKairoConnectAuthPrompt();

  if (!isLoaded || isSignedIn) return null;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={openAuthPrompt}>
            <LogInIcon />
            <span>{managedRelayEnabled ? "Sign in to Kairo Connect" : "Sign in to Kairo"}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      {authPrompt}
    </>
  );
}
