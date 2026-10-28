"use client";
import { useEffect, useState } from 'react';
import type { ColloquiumResult } from '../../lib/colloquium/types';
export class QuizError extends Error { constructor(public code: string) { super(code); } }
const messages: Record<string, string> = {
  profile_conflict: 'Të dhënat nuk përputhen me profilin ekzistues. Kontrollo emrin, indeksin dhe emailin.',
  invalid_registration: 'Kontrollo emrin, mbiemrin, indeksin dhe emailin.',
  staff_forbidden: 'Kjo hyrje është vetëm për studentët.',
  attempt_exists: 'Ke hyrë tashmë në grupin tjetër. Vazhdo nga lidhja e atij grupi.',
  invalid_room: 'Lidhja e grupit nuk është e vlefshme. Përdor lidhjen e profesorit.',
  room_finished: 'Koha e këtij grupi ka përfunduar.',
  attempt_closed: 'Koha ka përfunduar ose përgjigjet janë dorëzuar.',
  stale_answer: 'Ka ndryshime nga një faqe tjetër. Provo ruajtjen përsëri.',
  stale_attempt: 'Ka përgjigje më të reja. Kontrollo dhe provo dorëzimin përsëri.',
  question_bank_unavailable: 'Pyetjet nuk janë gati. Kontrolloni konfigurimin para fillimit.',
  rate_limited: 'Prit pak dhe provo përsëri.',
  course_unavailable: 'Lënda nuk është hapur ende. Kontakto profesorin.',
};
export function quizMessage(error: unknown) { return error instanceof QuizError ? messages[error.code] ?? 'Veprimi nuk u krye. Kontrollo lidhjen dhe provo përsëri.' : 'Lidhja dështoi. Kontrollo internetin dhe provo përsëri.'; }
export async function quizApi<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, { method: data === undefined ? 'GET' : 'POST', cache: 'no-store', headers: data === undefined ? undefined : { 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const body = await response.json();
  if (!response.ok) throw new QuizError(body.error?.code ?? 'unavailable');
  return body as T;
}
export function Timer({ deadline, offset }: { deadline: string; offset: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now - offset) / 1000));
  return <time className="cq-time" aria-label="Koha e mbetur" dateTime={deadline}>{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</time>;
}
export function Results({ results }: { results: ColloquiumResult[] }) {
  return <section className="cq-panel" aria-labelledby="cq-results"><p className="eyebrow">Pas përfundimit të kohës</p><h2 id="cq-results">Rezultatet · Kolokviumi I</h2>{results.length ? <table className="cq-results"><thead><tr><th scope="col">Emri dhe mbiemri</th><th scope="col">Grupi</th><th scope="col">Pikët</th></tr></thead><tbody>{results.map((result, index) => <tr key={`${result.groupName}-${index}`}><th scope="row">{result.fullName}</th><td>{result.groupName}</td><td><strong>{result.score}/10</strong></td></tr>)}</tbody></table> : <p>Rezultatet shfaqen këtu kur përfundon koha e grupit.</p>}</section>;
}
