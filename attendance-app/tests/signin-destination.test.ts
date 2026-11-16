import { describe, expect, it } from "vitest";
import { signInDestination } from "../lib/auth/destination";
describe("sign-in destination", () => {
  it("preserves professor week, activity and group through OAuth", () => {
    expect(signInDestination("https://course.example/staff/qr?week=10&kind=lab&group=G2", "https://course.example")).toBe("/staff/qr?week=10&kind=lab&group=G2");
  });
  for (const target of ["https://evil.example/staff", "//evil.example/staff", "/\\evil.example/staff", "/api/auth/signin", "/signin?callbackUrl=/signin", "javascript:alert(1)", "/%5cevil.example/staff"]) {
    it(`rejects unsafe or recursive target ${target}`, () => {
      expect(signInDestination(target, "https://course.example")).toBe("/progress");
    });
  }
  it("keeps an internal student destination", () => expect(signInDestination("/student", "https://course.example")).toBe("/student"));
});
