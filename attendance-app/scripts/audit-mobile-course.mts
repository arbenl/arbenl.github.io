import { readFile, writeFile, chmod } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  auditCourse,
  type IntegritySnapshot,
} from "../lib/attendance/integrity";
const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const source = option("--snapshot"),
  output = option("--out");
if (!source || !output || source === output)
  throw new Error(
    "Usage: node --import tsx scripts/audit-mobile-course.mts --snapshot /private/path/mobile-2026-course-audit.json --out /private/path/audit-result.json [--verify-github]",
  );
const snapshot = JSON.parse(
  await readFile(source, "utf8"),
) as IntegritySnapshot;
const result = auditCourse(snapshot);
type Check = {
  status: "verified" | "missing" | "different-account" | "unavailable";
  login?: string;
};
const checks = new Map<string, Check>();
if (args.includes("--verify-github")) {
  const run = promisify(execFile);
  const profiles = snapshot.profiles.filter(
    (p) => p.github_id && p.github_username,
  );
  // Small read-only GraphQL batches; credentials remain managed by gh, never read/exported.
  const batches = Array.from(
    { length: Math.ceil(profiles.length / 20) },
    (_, i) => profiles.slice(i * 20, (i + 1) * 20),
  );
  for (let start = 0; start < batches.length; start += 3)
    await Promise.all(
      batches.slice(start, start + 3).map(async (batch) => {
        const query =
          "query { " +
          batch
            .map(
              (p, i) =>
                `u${i}:user(login:${JSON.stringify(p.github_username)}) { login databaseId }`,
            )
            .join(" ") +
          " }";
        let stdout = "";
        try {
          stdout = (
            await run("gh", ["api", "graphql", "-f", `query=${query}`], {
              timeout: 45000,
              maxBuffer: 1024 * 1024,
            })
          ).stdout;
        } catch (e) {
          stdout = String((e as { stdout?: string }).stdout ?? "");
        }
        let response: {
          data?: Record<string, { login: string; databaseId: number } | null>;
          errors?: { type?: string; path?: string[] }[];
        } = {};
        try {
          response = JSON.parse(stdout);
        } catch {
          // Missing or non-JSON API output remains unavailable, never zero/missing.
        }
        batch.forEach((p, i) => {
          const account = response.data?.[`u${i}`];
          checks.set(
            p.id,
            account
              ? {
                  status:
                    String(account.databaseId) === p.github_id
                      ? "verified"
                      : "different-account",
                  login: account.login,
                }
              : response.errors?.some(
                    (e) => e.type === "NOT_FOUND" && e.path?.[0] === `u${i}`,
                  )
                ? { status: "missing" }
                : { status: "unavailable" },
          );
        });
      }),
    );
}
const students = result.students.map((s) => {
  const verification = checks.get(s.id);
  const flags = [...s.flags];
  if (verification && verification.status !== "verified")
    flags.push({
      kind: "review",
      detail:
        verification.status === "missing"
          ? "GitHub nuk e gjen llogarinë e ruajtur; kërko lidhjen me OAuth nga pajisja ekzistuese"
          : verification.status === "different-account"
            ? "Emri GitHub tani i përket një ID-je tjetër; kërko verifikim me OAuth"
            : "GitHub nuk mund të verifikohet tani; mos e trajto si llogari të fshirë",
    });
  return {
    ...s,
    githubVerification: verification?.status ?? "not-checked",
    flags,
  };
});
const final = {
  ...result,
  summary: {
    ...result.summary,
    reviewNeeded: students.filter((s) =>
      s.flags.some((f) => f.kind === "review"),
    ).length,
    githubVerified: students.filter((s) => s.githubVerification === "verified")
      .length,
    githubMissing: students.filter((s) => s.githubVerification === "missing")
      .length,
    githubDifferentAccount: students.filter(
      (s) => s.githubVerification === "different-account",
    ).length,
    githubUnverified: students.filter(
      (s) => s.githubVerification === "unavailable",
    ).length,
  },
  students,
};
await writeFile(output, JSON.stringify(final, null, 2) + "\n", { mode: 0o600 });
await chmod(output, 0o600);
const escape = (v: unknown) =>
  String(v ?? "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const rows = [...students]
  .sort(
    (a, b) =>
      Number(!!b.flags.length) - Number(!!a.flags.length) ||
      a.name.localeCompare(b.name, "sq"),
  )
  .map(
    (s) =>
      `<tr data-review="${!!s.flags.length}"><td><strong>${escape(s.name)}</strong><br>${escape(s.group)}</td><td>${escape(s.github)}<br>${escape(s.githubVerification)}</td><td>${s.lecture} + ${s.lab} = <strong>${s.total}</strong></td><td>${escape(s.testPoints)}</td><td>${escape(s.percentage === null ? null : s.percentage + "%")} (${escape(s.submitted)}/${final.summary.weeksDue})</td><td>${s.flags.map((f) => escape(f.detail)).join("<br>") || "Në përputhje me burimet"}${s.candidates.map((c) => `<br>Kandidat për verifikim: ${escape(c.login)} · ${escape(c.source)}`).join("")}</td></tr>`,
  )
  .join("");
const html = `<!doctype html><html lang="sq"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Auditimi Mobile 2026/2027</title><style>body{font:16px system-ui;line-height:1.5;margin:24px;color:#182335;background:#f4f7fb}main{max-width:1500px;margin:auto}h1{font-size:28px}input{padding:12px;font:inherit;margin:10px 0;border:1px solid #68768b;border-radius:8px}table{border-collapse:collapse;width:100%;background:white}td,th{padding:14px;border:1px solid #c7d2df;text-align:left;vertical-align:top}th{background:#15243a;color:white}tr[data-review=true]{background:#fff6da}.scroll{overflow:auto}small{color:#43536b}</style><main><p>Vetëm për profesorin · Të dhëna private</p><h1>Auditimi i Programimit për Pajisje Mobile 2026/2027</h1><p>${escape(final.generatedAt)} · ${final.summary.students} profile · ${final.summary.dataErrors} mospërputhje në llogaritje · ${final.summary.reviewNeeded} profile për verifikim.</p><p>${checks.size ? `${final.summary.githubVerified} llogari GitHub të verifikuara publikisht; ${final.summary.githubMissing} nuk gjenden.` : "Verifikimi publik i llogarive GitHub nuk është ekzekutuar."} ${final.summary.students - final.summary.githubReady} profile ende pa GitHub të lidhur.</p><p>Kontrollohen regjistrimet ekzistuese, pikët e publikuara dhe javët unike të dorëzuara. Përqindja e dorëzimeve nuk është notë. Kontrolli publik i GitHub-it nuk konfirmon që studenti mban kredencialet; hyrja vërtetohet me OAuth. Emrat e ngjashëm nuk bashkohen automatikisht.</p><label>Kërko studentin ose problemin<br><input id="search" type="search" placeholder="Emri, GitHub, problemi…"></label> <label><input id="review" type="checkbox"> Vetëm për verifikim</label><p id="count" role="status"></p><div class="scroll"><table><thead><tr><th>Studenti</th><th>GitHub</th><th>Ligjërata + ushtrime</th><th>Pikë në test</th><th>Dorëzime</th><th>Gjetjet</th></tr></thead><tbody>${rows}</tbody></table></div><p>Nëse mungojnë dorëzime, në kartën e studentit profesori mund të lidhë një Issue të verifikuar. Për llogarinë e hyrjes studenti konfirmon vetë GitHub-in nga pajisja ku është i kyçur. Të dhënat e dyfishuara kërkojnë verifikim të identitetit; ky skript nuk ndryshon regjistrin.</p></main><script>const search=document.querySelector('#search'),review=document.querySelector('#review'),rows=[...document.querySelectorAll('tbody tr')];function filter(){const q=search.value.toLocaleLowerCase();let n=0;for(const row of rows){row.hidden=!row.textContent.toLocaleLowerCase().includes(q)||(review.checked&&row.dataset.review!=='true');if(!row.hidden)n++;}document.querySelector('#count').textContent=n+' profile të shfaqura';}search.addEventListener('input',filter);review.addEventListener('change',filter);filter();</script></html>`;
const htmlOutput = output.replace(/\.json$/i, "") + ".html";
await writeFile(htmlOutput, html, { mode: 0o600 });
await chmod(htmlOutput, 0o600);
console.log(JSON.stringify(final.summary));
// Reads the snapshot/public GitHub only. Never changes accounts, attendance, grades or submissions.
