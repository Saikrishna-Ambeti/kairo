import {
  BriefcaseBusinessIcon,
  CheckIcon,
  GraduationCapIcon,
  RocketIcon,
  ShapesIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { PROFESSIONAL_ROLES, type ProfessionalRole } from "./professionalRole";

const ROLE_ICONS: Record<ProfessionalRole, LucideIcon> = {
  student: GraduationCapIcon,
  founder: RocketIcon,
  freelancer: BriefcaseBusinessIcon,
  "content-creator": VideoIcon,
  other: ShapesIcon,
};

export function ProfessionalRolePicker({
  value,
  otherValue,
  onChange,
  onOtherValueChange,
}: {
  readonly value: ProfessionalRole | null;
  readonly otherValue: string;
  readonly onChange: (role: ProfessionalRole) => void;
  readonly onOtherValueChange: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-2 text-left sm:grid-cols-2">
      <legend className="sr-only">Professional role</legend>
      {PROFESSIONAL_ROLES.map((role) => {
        const Icon = ROLE_ICONS[role.value];
        const selected = value === role.value;

        return (
          <label
            key={role.value}
            className={cn(
              "group relative min-h-24 cursor-pointer rounded-xl border p-3.5 text-left outline-none transition-[border-color,background-color,box-shadow,transform] has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-card",
              selected
                ? "border-primary/55 bg-primary/8 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                : "border-border/80 bg-background/65 hover:-translate-y-px hover:border-primary/30 hover:bg-accent/45",
            )}
          >
            <input
              className="sr-only"
              type="radio"
              name="professional-role"
              value={role.value}
              checked={selected}
              onChange={() => onChange(role.value)}
            />
            <span
              className={cn(
                "mb-3 flex size-8 items-center justify-center rounded-lg border",
                selected
                  ? "border-primary/25 bg-primary/12 text-primary"
                  : "border-border bg-card text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="block pr-6 text-sm font-semibold text-foreground">{role.label}</span>
            <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
              {role.description}
            </span>
            <span
              aria-hidden
              className={cn(
                "absolute right-3 top-3 flex size-5 items-center justify-center rounded-full border transition-opacity",
                selected
                  ? "border-primary bg-primary text-primary-foreground opacity-100"
                  : "border-border bg-card opacity-0",
              )}
            >
              <CheckIcon className="size-3" />
            </span>
          </label>
        );
      })}
      {value === "other" ? (
        <label className="space-y-2 sm:col-span-2" htmlFor="professional-role-other">
          <span className="text-sm font-medium text-foreground">Your profession</span>
          <input
            required
            autoFocus
            id="professional-role-other"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="e.g. Product designer"
            value={otherValue}
            onChange={(event) => onOtherValueChange(event.currentTarget.value)}
          />
        </label>
      ) : null}
    </fieldset>
  );
}
