import { UserButton, useAuth } from "@clerk/react";
import { LogInIcon } from "lucide-react";

import { hasCloudIdentityConfig, hasManagedRelayConfig } from "../../cloud/publicConfig";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { KAIRO_CONNECT_ACCOUNT_PAGES } from "./KairoConnectAccountPages";
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
      {managedRelayEnabled
        ? KAIRO_CONNECT_ACCOUNT_PAGES.map((page) => (
            <UserButton.UserProfilePage
              key={page.url}
              label={page.label}
              labelIcon={page.icon}
              url={page.url}
            >
              {page.content}
            </UserButton.UserProfilePage>
          ))
        : null}
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
