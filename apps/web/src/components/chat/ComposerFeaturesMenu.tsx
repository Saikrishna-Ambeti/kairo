import { T, useGT } from "gt-react";
import { EllipsisIcon, SearchIcon } from "lucide-react";
import { memo } from "react";

import { Button } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuShortcut,
  MenuTrigger,
} from "../ui/menu";

export const ComposerFeaturesMenuContent = memo(function ComposerFeaturesMenuContent(props: {
  onDeepResearchSelect: () => void;
}) {
  return (
    <MenuGroup>
      <MenuGroupLabel>
        <T>Features</T>
      </MenuGroupLabel>
      <MenuItem onClick={props.onDeepResearchSelect}>
        <SearchIcon aria-hidden="true" />
        <span>
          <T>Deep Research</T>
        </span>
        <MenuShortcut>/research</MenuShortcut>
      </MenuItem>
    </MenuGroup>
  );
});

export const ComposerFeaturesMenu = memo(function ComposerFeaturesMenu(props: {
  onDeepResearchSelect: () => void;
}) {
  const gt = useGT();
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost-muted"
            className="shrink-0"
            aria-label={gt("Composer features")}
          />
        }
      >
        <EllipsisIcon aria-hidden="true" className="size-4" />
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-56">
        <ComposerFeaturesMenuContent onDeepResearchSelect={props.onDeepResearchSelect} />
      </MenuPopup>
    </Menu>
  );
});
