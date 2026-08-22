import * as Schema from "effect/Schema";

import { useLocalStorage } from "../../hooks/useLocalStorage";
import {
  PROFESSIONAL_ROLE_STORAGE_KEY,
  ProfessionalRoleSchema,
  type ProfessionalRole,
} from "./professionalRole";

export function useProfessionalRole(): ProfessionalRole | null {
  const [role] = useLocalStorage<ProfessionalRole | null, ProfessionalRole | null>(
    PROFESSIONAL_ROLE_STORAGE_KEY,
    null,
    ProfessionalRoleSchema.pipe(Schema.NullOr),
  );
  return role;
}
