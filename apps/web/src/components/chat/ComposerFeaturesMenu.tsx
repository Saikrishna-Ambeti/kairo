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
      <MenuGroupLabel>Features</MenuGroupLabel>
      <MenuItem onClick={props.onDeepResearchSelect}>
        <SearchIcon aria-hidden="true" />
        <span>Deep Research</span>
        <MenuShortcut>/research</MenuShortcut>
      </MenuItem>
    </MenuGroup>
  );
});

export const ComposerFeaturesMenu = memo(function ComposerFeaturesMenu(props: {
  onDeepResearchSelect: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 px-2 text-muted-foreground/70 hover:text-foreground/80"
            aria-label="Composer features"
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
