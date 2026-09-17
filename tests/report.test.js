import test from "node:test";
import assert from "node:assert/strict";
import { totals, csvCell, parseRoster } from "../src/report.js";
const person = {
  id: "p",
  semester_id: "s",
  group_name: "G1",
  joined_at: "2026-09-01",
};
const session = (id, more = {}) => ({
  id,
  semester_id: "s",
  group_name: "*",
  created_at: "2026-09-02",
  kind: "lecture",
  state: "finalized",
  ...more,
});
test("Only finalized eligible sessions count; excused, cancelled, other groups and pre-enrollment excluded", () => {
  const sessions = [
    session("yes"),
    session("absent"),
    session("pending"),
    session("excused"),
    session("cancelled", { state: "cancelled" }),
    session("open", { state: "open" }),
    session("other", { group_name: "G2" }),
    session("early", { created_at: "2026-08-01" }),
    session("lab", { kind: "lab" }),
  ];
  const records = ["yes", "pending", "excused"].map((id, i) => ({
    session_id: id,
    roster_id: "p",
    status: ["present", "pending", "excused"][i],
  }));
  assert.equal(totals(person, sessions, records, "lecture"), "1/3 · 33%");
  assert.equal(totals(person, [], [], "lab"), "0/0 · —");
});
test("CSV quotes escaped and spreadsheet formulas neutralized", () => {
  assert.equal(csvCell('"quoted"'), '"""quoted"""');
  for (const v of ["=cmd", " +SUM(A1)", "@sum", "-2", "\t=cmd"])
    assert.ok(csvCell(v).startsWith("\"'"));
});
test("Roster requires valid email and group; preserves Albanian names", () => {
  assert.deepEqual(parseRoster("1; Ëndrra Çela; E@example.com; G1")[0], {
    student_number: "1",
    name: "Ëndrra Çela",
    email: "e@example.com",
    group_name: "G1",
  });
  assert.throws(() => parseRoster("1; test; no-email; G1"));
  assert.throws(() => parseRoster("1; test; x@y.com; *"));
});
