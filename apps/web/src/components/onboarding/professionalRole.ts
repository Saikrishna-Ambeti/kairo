import { msg } from "gt-react";
import {
  ProfessionalRole as ProfessionalRoleSchema,
  type ProfessionalRole,
} from "@kairo/contracts/settings";
import * as Schema from "effect/Schema";

export const PROFESSIONAL_ROLE_STORAGE_KEY = "kairo:professional-role:v1";
export const PROFESSIONAL_ROLE_OTHER_STORAGE_KEY = "kairo:professional-role-other:v1";

export const ProfessionalRoleOtherSchema = Schema.String;
export { ProfessionalRoleSchema };
export type { ProfessionalRole };

export const PROFESSIONAL_ROLES: ReadonlyArray<{
  readonly value: ProfessionalRole;
  readonly label: string;
  readonly description: string;
}> = [
  {
    value: "student",
    label: msg("Student"),
    description: msg("Learning, researching, or building coursework"),
  },
  {
    value: "founder",
    label: msg("Founder"),
    description: msg("Building and shipping a company"),
  },
  {
    value: "freelancer",
    label: msg("Freelancer"),
    description: msg("Working across client projects"),
  },
  {
    value: "content-creator",
    label: msg("Content creator"),
    description: msg("Creating content and growing an audience"),
  },
  {
    value: "other",
    label: msg("Other"),
    description: msg("Tell us what kind of work you do"),
  },
];

export function isProfessionalRoleComplete(
  role: ProfessionalRole | null,
  otherRole: string,
): boolean {
  return role !== null && (role !== "other" || otherRole.trim().length > 0);
}
