export const labels = {
  lecture: "Ligjëratë",
  lab: "Ushtrime",
  pending: "Në pritje",
  present: "I pranishëm",
  rejected: "Nuk u konfirmua",
  excused: "E arsyetuar",
  open: "Hapur",
  closed: "Skanimet mbyllur",
  finalized: "Përfunduar",
  cancelled: "Anuluar",
  absent: "Mungesë",
};
export function eligible(person, session) {
  return (
    person.semester_id === session.semester_id &&
    (session.group_name === "*" || session.group_name === person.group_name) &&
    Date.parse(person.joined_at) <= Date.parse(session.created_at)
  );
}
export function totals(person, sessions, records, kind) {
  const held = sessions.filter(
    (s) => s.state === "finalized" && s.kind === kind && eligible(person, s),
  );
  const status = (id) =>
    records.find((r) => r.session_id === id && r.roster_id === person.id)
      ?.status;
  const count = held.filter((s) => status(s.id) !== "excused").length;
  const present = held.filter((s) => status(s.id) === "present").length;
  return `${present}/${count} · ${count ? Math.round((present / count) * 100) + "%" : "—"}`;
}
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function csv(rows) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function parseRoster(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line, i) => {
      const p = line.split(";").map((s) => s.trim());
      if (
        p.length !== 4 ||
        p.some((s) => !s) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p[2])
      )
        throw new Error(`Rreshti ${i + 1}: përdor numri; emri; emaili; grupi.`);
      if (p[3] === "*")
        throw new Error("Grupi i studentit duhet të ketë emër, p.sh. G1.");
      return {
        student_number: p[0],
        name: p[1],
        email: p[2].toLowerCase(),
        group_name: p[3],
      };
    });
}
