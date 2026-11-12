"use client";
import { useState } from "react";
import type { ProgressCard } from "../lib/attendance/progress";
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sq")
    .trim();
export function StudentProgress({
  cards,
  viewerId,
}: {
  cards: ProgressCard[];
  viewerId: string | null;
}) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState(""),
    [registration, setRegistration] = useState(""),
    [test, setTest] = useState(""),
    [selection, setSelection] = useState<string | null>(viewerId);
  const filtered = cards.filter(
    (c) =>
      normalize(c.name).includes(normalize(query)) &&
      (!group || c.group === group) &&
      (!registration || (registration === "linked" ? c.linked : !c.linked)) &&
      (!test ||
        (test === "unknown"
          ? c.tests === null
          : test === "taken"
            ? !!c.tests?.length
            : c.tests !== null && c.tests.length === 0)),
  );
  const current =
    filtered.find((c) => c.id === selection) ??
    (filtered.length === 1 ? filtered[0] : null);
  function change() {
    setSelection(null);
  }
  return (
    <>
      <details className="progress-search" open={!viewerId}>
        <summary>Kërko studentin dhe filtro regjistrin</summary>
        <section
          className="admin-section progress-filters"
          aria-label="Filtro studentët"
        >
          <label>
            Kërko emrin ose mbiemrin
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                change();
              }}
              placeholder="p.sh. Arta Krasniqi"
            />
          </label>
          <label>
            Grupi
            <select
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                change();
              }}
            >
              <option value="">Të gjitha grupet</option>
              {[...new Set(cards.map((c) => c.group))].sort().map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Regjistrimi
            <select
              value={registration}
              onChange={(e) => {
                setRegistration(e.target.value);
                change();
              }}
            >
              <option value="">Të gjithë të regjistruarit</option>
              <option value="linked">Me GitHub të lidhur</option>
              <option value="unlinked">Pa GitHub të lidhur</option>
            </select>
          </label>
          <label>
            Testi i mbajtur
            <select
              value={test}
              onChange={(e) => {
                setTest(e.target.value);
                change();
              }}
            >
              <option value="">Të gjithë</option>
              <option value="taken">Me rezultat të publikuar</option>
              <option value="missing">Pa rezultat të publikuar</option>
              <option value="unknown">Të dhënat të padisponueshme</option>
            </select>
          </label>
          <div className="progress-actions">
            <button
              onClick={() => {
                setQuery("");
                setGroup("");
                setRegistration("");
                setTest("");
                setSelection(viewerId);
              }}
            >
              Pastro filtrat{viewerId ? " · Karta ime" : ""}
            </button>
          </div>
        </section>
      </details>
      <p role="status">
        {filtered.length} nga {cards.length} studentë të regjistruar
      </p>
      {current && (
        <article className="identity-card" aria-labelledby="identity-name">
          <p className="eyebrow">AAB · Karta akademike · Mobile 2026/2027</p>
          <div className="identity-avatar" aria-hidden="true">
            {current.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")}
          </div>
          <h2 id="identity-name">{current.name}</h2>
          <p>Grupi {current.group}</p>{current.possibleDuplicate&&<p role="status">Në regjistër ekziston edhe një profil me këtë emër. Profesori duhet të verifikojë identifikuesit para se të bashkojë të dhënat.</p>}{current.githubLogin&&<p>Llogaria e dorëzimeve: <a href={`https://github.com/${current.githubLogin}`}>{current.githubLogin}</a></p>}{current.total===0&&<p>Nuk u gjet check-in i konfirmuar për këtë profil. Nëse ke marrë pjesë, kërko verifikimin e profesorit; mos krijo profil tjetër.</p>}
          <dl className="identity-metrics">
            <div>
              <dt>Ligjërata</dt>
              <dd>{current.lecture}</dd>
            </div>
            <div>
              <dt>Ushtrime</dt>
              <dd>{current.lab}</dd>
            </div>
            <div>
              <dt>Pjesëmarrje totale</dt>
              <dd>{current.total}</dd>
            </div>
            <div>
              <dt>Pikë në teste</dt>
              <dd>
                {current.tests === null
                  ? "E panjohur"
                  : current.tests.length
                    ? `${current.tests.reduce((n, t) => n + t.score, 0)}/${current.tests.reduce((n, t) => n + t.maxScore, 0)}`
                    : "Pa rezultat"}
              </dd>
            </div>
            <div>
              <dt>Detyra të dorëzuara</dt>
              <dd>
                {current.percentage === null
                  ? "E panjohur"
                  : `${current.percentage}%`}
              </dd>
            </div>
          </dl>
          <p>
            Numërohen check-in-et me status “i pranishëm”.{" "}
            {current.percentage === null
              ? "Dorëzimet nuk mund të përcaktohen për këtë profil."
              : `Përqindja tregon ${current.submitted}/${current.work.length} javë të dorëzuara deri sot; nuk është vlerësim i zgjidhjes.`}
          </p>
          <h3>Testet</h3>
          {current.tests === null ? (
            <p role="alert">
              Rezultatet nuk mund të lexohen tani. Provo përsëri më vonë.
            </p>
          ) : current.tests.length ? (
            <ul>
              {current.tests.map((t) => (
                <li key={t.week}>
                  Java {t.week} · {t.score}/{t.maxScore} pikë
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Nuk ka rezultat të publikuar për këtë student. Kjo nuk është e
              barabartë me zero pikë.
            </p>
          )}
          <h3>Detyrat sipas javëve</h3>
          <ul className="progress-work">
            {current.work.map((w) => (
              <li
                key={w.week}
                className={
                  !w.known
                    ? "work-unknown"
                    : w.submission
                      ? "work-done"
                      : "work-missing"
                }
              >
                {w.submission ? (
                  <a href={w.submission.url}>Java {w.week} · ✓ Dorëzuar</a>
                ) : (
                  <>
                    Java {w.week} · {w.known ? "✕ Pa dorëzim" : "? E panjohur"}
                  </>
                )}
              </li>
            ))}
          </ul>
          {!current.linked && (
            <p>
              Për të lidhur dorëzimet me profilin, kërko ndihmën e profesorit.
              Nuk i bashkojmë llogaritë vetëm nga emri.
            </p>
          )}
          <details>
            <summary>Vijueshmëria sipas orëve</summary>
            <ul className="history-list">
              {current.attendance.map((s) => (
                <li key={s.id}>
                  <span>
                    Java {s.week} ·{" "}
                    {s.kind === "lecture" ? "Ligjëratë" : "Ushtrime"} ·{" "}
                    {s.groupName}
                  </span>
                  <strong>
                    {s.present ? "Po" : s.state === "open" ? "Në pritje" : "Jo"}
                  </strong>
                </li>
              ))}
            </ul>
          </details>
        </article>
      )}
      {!filtered.length ? (
        <p>Nuk u gjet student. Ndrysho ose pastro filtrat.</p>
      ) : (
        <section className="admin-section">
          <h2>Studentët e regjistruar</h2>
          <p>Zgjidh emrin për të hapur kartën.</p>
          <div className="progress-roster">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelection(c.id);
                  document
                    .querySelector(".identity-card")
                    ?.scrollIntoView({ block: "start" });
                }}
                aria-pressed={current?.id === c.id}
              >
                <strong>{c.name}</strong>
                <span>
                  {c.group} · {c.total} pjesëmarrje
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
