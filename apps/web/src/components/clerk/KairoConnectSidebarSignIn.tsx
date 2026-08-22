import { UserButton, useAuth } from "@clerk/react";
import { LogInIcon, ServerIcon, SmartphoneIcon } from "lucide-react";

import { hasCloudPublicConfig } from "../../cloud/publicConfig";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { MobileClientsUserProfilePage } from "./MobileClientsUserProfilePage";
import { KairoConnectUserProfilePage } from "./KairoConnectUserProfilePage";
import { useKairoConnectAuthPrompt } from "./useKairoConnectAuthPrompt";

export function KairoConnectSidebarSignIn() {
  if (!hasCloudPublicConfig()) return null;

  return <ConfiguredKairoConnectSidebarSignIn />;
}

export function KairoConnectSidebarAvatar() {
  if (!hasCloudPublicConfig()) return null;

  return <ConfiguredKairoConnectSidebarAvatar />;
}

function ConfiguredKairoConnectSidebarAvatar() {
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
      <UserButton.UserProfilePage
        label="Mobile clients"
        labelIcon={<SmartphoneIcon className="size-4" />}
        url="mobile-clients"
      >
        <MobileClientsUserProfilePage />
      </UserButton.UserProfilePage>
      <UserButton.UserProfilePage
        label="Kairo Connect"
        labelIcon={<ServerIcon className="size-4" />}
        url="kairo-connect"
      >
        <KairoConnectUserProfilePage />
      </UserButton.UserProfilePage>
    </UserButton>
  );
}

function ConfiguredKairoConnectSidebarSignIn() {
  const { isLoaded, isSignedIn } = useAuth();
  const { authPrompt, openAuthPrompt } = useKairoConnectAuthPrompt();

  if (!isLoaded || isSignedIn) return null;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={openAuthPrompt}>
            <LogInIcon />
            <span>Sign in to Kairo Connect</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      {authPrompt}
    </>
  );
}
