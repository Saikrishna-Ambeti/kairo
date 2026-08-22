import * as Schema from "effect/Schema";

export const PROFESSIONAL_ROLE_STORAGE_KEY = "kairo:professional-role:v1";
export const PROFESSIONAL_ROLE_OTHER_STORAGE_KEY = "kairo:professional-role-other:v1";

export const ProfessionalRoleSchema = Schema.Literals([
  "student",
  "founder",
  "freelancer",
  "content-creator",
  "other",
]);

export const ProfessionalRoleOtherSchema = Schema.String;

export type ProfessionalRole = typeof ProfessionalRoleSchema.Type;

export const PROFESSIONAL_ROLES: ReadonlyArray<{
  readonly value: ProfessionalRole;
  readonly label: string;
  readonly description: string;
}> = [
  {
    value: "student",
    label: "Student",
    description: "Learning, researching, or building coursework",
  },
  {
    value: "founder",
    label: "Founder",
    description: "Building and shipping a company",
  },
  {
    value: "freelancer",
    label: "Freelancer",
    description: "Working across client projects",
  },
  {
    value: "content-creator",
    label: "Content creator",
    description: "Creating content and growing an audience",
  },
  {
    value: "other",
    label: "Other",
    description: "Tell us what kind of work you do",
  },
];

export function isProfessionalRoleComplete(
  role: ProfessionalRole | null,
  otherRole: string,
): boolean {
  return role !== null && (role !== "other" || otherRole.trim().length > 0);
}
