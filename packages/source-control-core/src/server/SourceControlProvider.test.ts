import { assert, it } from "@effect/vitest";

import {
  repositoryPathFromRemoteUrl,
  transportSafeSourceControlErrorValue,
} from "./SourceControlProvider.ts";

it("removes URL credentials, query parameters, and fragments from error transport values", () => {
  assert.strictEqual(
    transportSafeSourceControlErrorValue(
      "https://user:secret@example.test/org/repo/pull/42?token=secret#discussion",
    ),
    "https://example.test/org/repo/pull/42",
  );
});

it.each([
  ["git@github.com:T3Tools/kairo.git", "T3Tools/kairo"],
  ["github.com:T3Tools/kairo.git", "T3Tools/kairo"],
  ["gitlab.com:T3Tools/platform/kairo", "T3Tools/platform/kairo"],
  ["https://github.com/T3Tools/kairo.git", "T3Tools/kairo"],
  ["https://github.com/T3Tools/kairo.git?view=compact", "T3Tools/kairo"],
  ["https://github.com/T3Tools/kairo.git#section", "T3Tools/kairo"],
  ["C:/repos/kairo", null],
])("reads the repository path of %s", (remoteUrl, expected) => {
  assert.strictEqual(repositoryPathFromRemoteUrl(remoteUrl), expected);
});
