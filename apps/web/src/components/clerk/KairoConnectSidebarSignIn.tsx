import { UserButton, useAuth } from "@clerk/react";
import { LogInIcon } from "lucide-react";

import { hasCloudPublicConfig } from "../../cloud/publicConfig";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
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
          userButtonTrigger: "rounded-lg p-1 hover:bg-sidebar-accent",
        },
      }}
    />
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
          <SidebarMenuButton
            size="sm"
            className="gap-2 px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={openAuthPrompt}
          >
            <LogInIcon className="size-4" />
            <span>Sign in to Kairo Connect</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      {authPrompt}
    </>
  );
}
