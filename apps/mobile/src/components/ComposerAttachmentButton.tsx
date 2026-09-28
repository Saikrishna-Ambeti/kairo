import type { MenuAction } from "@react-native-menu/menu";
import {
  ARTIFACT_CREATION_COMMANDS,
  isArtifactCreationKind,
  type ArtifactCreationKind,
} from "@kairo/client-runtime/artifact-creation";
import { Pressable } from "react-native";

import { SymbolView } from "./AppSymbol";
import { ControlPillMenu } from "./ControlPill";

const ATTACHMENT_MENU_ACTIONS: MenuAction[] = [
  { id: "photos", title: "Photo Library", image: "photo" },
  { id: "files", title: "Choose Files", image: "folder" },
];
const FILE_CREATION_MENU_ACTIONS: MenuAction[] = ARTIFACT_CREATION_COMMANDS.map(
  ({ kind, label }) => ({ id: kind, title: `Create ${label.toLowerCase()}` }),
);

export function ComposerAttachmentButton(props: {
  readonly disabled?: boolean;
  readonly supportsFiles: boolean;
  readonly onPickMedia: () => Promise<void>;
  readonly onPickFiles: () => Promise<void>;
  readonly onCreateFile?: (kind: ArtifactCreationKind) => void;
}) {
  const button = (
    <Pressable
      accessibilityLabel="Add attachment"
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      className="size-[44px] shrink-0 items-center justify-center rounded-full active:opacity-70 disabled:opacity-50"
      disabled={props.disabled}
      onPress={
        props.supportsFiles || props.onCreateFile ? undefined : () => void props.onPickMedia()
      }
    >
      <SymbolView
        name="plus"
        size={20}
        weight="regular"
        tintColorClassName="accent-icon"
        type="monochrome"
      />
    </Pressable>
  );

  if (props.disabled || (!props.supportsFiles && !props.onCreateFile)) {
    return button;
  }

  return (
    <ControlPillMenu
      actions={[
        ...ATTACHMENT_MENU_ACTIONS.filter((action) => action.id !== "files" || props.supportsFiles),
        ...(props.onCreateFile ? FILE_CREATION_MENU_ACTIONS : []),
      ]}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === "photos") {
          void props.onPickMedia();
        } else if (nativeEvent.event === "files") {
          void props.onPickFiles();
        } else if (isArtifactCreationKind(nativeEvent.event)) {
          props.onCreateFile?.(nativeEvent.event);
        }
      }}
    >
      {button}
    </ControlPillMenu>
  );
}
