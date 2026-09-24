import { expect, it } from "vitest";
import { issueRegistrationPermit, readRegistrationPermit } from "../lib/attendance/registration";
it("binds registration to a signed identity and expires after ten minutes", () => {
  const input = { githubId: "200", semesterId: "semester", groupName: "G1", kind: "lab" };
  const token = issueRegistrationPermit(input, "secret", 1000);
  expect(readRegistrationPermit(token, "secret", 2000)).toMatchObject(input);
  expect(readRegistrationPermit(token, "wrong", 2000)).toBeNull();
  expect(readRegistrationPermit(`x${token}`, "secret", 2000)).toBeNull();
  expect(readRegistrationPermit(token, "secret", 601000)).toBeNull();
});
