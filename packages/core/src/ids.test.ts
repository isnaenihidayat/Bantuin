import { expect, test } from "bun:test";
import { createId } from "./ids";

test("createId returns opaque prefixed identifiers", () => {
  const id = createId("session");

  expect(id).toMatch(/^ses_[a-f0-9]{32}$/);
});
