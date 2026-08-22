import * as Schema from "effect/Schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ProfessionalRolePicker } from "./ProfessionalRolePicker";
import {
  isProfessionalRoleComplete,
  PROFESSIONAL_ROLES,
  PROFESSIONAL_ROLE_OTHER_STORAGE_KEY,
  PROFESSIONAL_ROLE_STORAGE_KEY,
  ProfessionalRoleSchema,
} from "./professionalRole";

const decodeProfessionalRole = Schema.decodeUnknownSync(ProfessionalRoleSchema);

describe("professional roles", () => {
  it("keeps the stored role contract stable", () => {
    expect(PROFESSIONAL_ROLE_STORAGE_KEY).toBe("kairo:professional-role:v1");
    expect(PROFESSIONAL_ROLE_OTHER_STORAGE_KEY).toBe("kairo:professional-role-other:v1");
    expect(decodeProfessionalRole("content-creator")).toBe("content-creator");
    expect(decodeProfessionalRole("other")).toBe("other");
    expect(() => decodeProfessionalRole("employee")).toThrow();
  });

  it("requires details for the other profession", () => {
    expect(isProfessionalRoleComplete("founder", "")).toBe(true);
    expect(isProfessionalRoleComplete("other", "")).toBe(false);
    expect(isProfessionalRoleComplete("other", "  Product designer  ")).toBe(true);
  });

  it("renders every role as a selectable radio option", () => {
    const html = renderToStaticMarkup(
      <ProfessionalRolePicker
        value="founder"
        otherValue=""
        onChange={() => undefined}
        onOtherValueChange={() => undefined}
      />,
    );

    expect(html.match(/type="radio"/g)).toHaveLength(PROFESSIONAL_ROLES.length);
    expect(html).toContain("Student");
    expect(html).toContain("Founder");
    expect(html).toContain("Freelancer");
    expect(html).toContain("Content creator");
    expect(html).toContain("Other");
    expect(html).toContain("checked");
  });

  it("shows a profession field when other is selected", () => {
    const html = renderToStaticMarkup(
      <ProfessionalRolePicker
        value="other"
        otherValue="Product designer"
        onChange={() => undefined}
        onOtherValueChange={() => undefined}
      />,
    );

    expect(html).toContain("Your profession");
    expect(html).toContain("Product designer");
  });
});
