"use client";
import { signIn } from 'next-auth/react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { ColloquiumState } from '../../lib/colloquium/types';
import { AnswerQueue } from './answer-queue';
import { QuizError, quizApi, quizMessage, Results, Timer } from './shared';
type Entry = { roomId: string; token: string };
const storageKey = 'colloquium-room';
function roomEntry(): Entry | null {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const roomId = fragment.get('room'); const token = fragment.get('token');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (roomId && token) {
    const entry = { roomId, token };
    try { sessionStorage.setItem(storageKey, JSON.stringify(entry)); } catch { /* Memory is enough until refresh. */ }
    return entry;
  }
  try {
    const entry = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    return typeof entry?.roomId === 'string' && typeof entry?.token === 'string' ? entry : null;
  } catch { return null; }
}
export function ColloquiumStudent() {
  const [state, setState] = useState<ColloquiumState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pollMessage, setPollMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [offset, setOffset] = useState(0);
  const [queueView, setQueueView] = useState<{ answers: Record<string, string | null>; status: string }>({ answers: {}, status: 'saved' });
  const entry = useRef<Entry | null>(null);
  const current = useRef<ColloquiumState | null>(null);
  const queue = useRef<AnswerQueue | null>(null);
  const locked = useRef(false);
  const apply = useCallback((next: ColloquiumState) => {
    const previous = current.current;
    if (previous?.attempt?.id === next.attempt?.id && previous?.attempt?.submitted && !next.attempt?.submitted) return;
    if (previous?.room?.id === next.room?.id && previous?.room?.state === 'finished' && next.room?.state !== 'finished') return;
    current.current = next;
    if (next.attempt) queue.current?.hydrate(next.attempt);
    if (queue.current) setQueueView({ answers: { ...queue.current.answers }, status: queue.current.status });
    setOffset(Date.parse(next.serverTime) - Date.now());
    setState(next);
  }, []);
  const refresh = useCallback(async (join = true) => {
    let next = await quizApi<ColloquiumState>('/api/colloquium/state', entry.current ?? {});
    if (join && entry.current && next.registered && !next.attempt && next.room?.state !== 'finished') {
      try { next = await quizApi<ColloquiumState>('/api/colloquium/join', entry.current); }
      catch (error) {
        if (!(error instanceof QuizError) || error.code !== 'attempt_exists') throw error;
        entry.current = null;
        try { sessionStorage.removeItem(storageKey); } catch { /* The remembered session still identifies the attempt. */ }
        next = await quizApi<ColloquiumState>('/api/colloquium/state', {});
      }
    }
    apply(next);
    return next;
  }, [apply]);
  useEffect(() => {
    let active = true;
    entry.current = roomEntry();
    queue.current = new AnswerQueue(async (questionId, optionId, revision) => {
      try { return await quizApi('/api/colloquium/answer', { roomId: current.current?.room?.id, questionId, optionId, revision }); }
      catch (error) {
        if (error instanceof QuizError && error.code === 'stale_answer') {
          const latest = await refresh(false);
          if (latest.attempt && !latest.attempt.submitted && latest.room?.state === 'live') return quizApi('/api/colloquium/answer', { roomId: latest.room.id, questionId, optionId, revision: latest.attempt.revisions[questionId] ?? 0 });
        }
        if (error instanceof QuizError && error.code === 'attempt_closed') await refresh(false);
        throw error;
      }
    }, () => { if (active && queue.current) setQueueView({ answers: { ...queue.current.answers }, status: queue.current.status }); });
    let fetching = false;
    const poll = async () => {
      if (fetching) return;
      fetching = true;
      try { await refresh(); if (active) setPollMessage(null); }
      catch (error) { if (active) setPollMessage(quizMessage(error)); }
      finally { fetching = false; }
    };
    void poll();
    const handoff = () => { if (location.hash) { entry.current = roomEntry(); void poll(); } };
    window.addEventListener('hashchange', handoff);
    const timer = setInterval(() => { void poll(); }, 2500);
    return () => { active = false; clearInterval(timer); window.removeEventListener('hashchange', handoff); };
  }, [refresh]);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || !entry.current || !event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    locked.current = true; setBusy(true); setMessage(null);
    try {
      const result = await signIn('colloquium', { redirect: false, token: entry.current.token, firstName: String(data.get('firstName') ?? '').trim(), lastName: String(data.get('lastName') ?? '').trim(), studentId: String(data.get('studentId') ?? '').trim(), email: String(data.get('email') ?? '').trim() });
      if (!result?.ok || result.error) throw new QuizError(result?.error ?? 'invalid_registration');
      apply(await quizApi<ColloquiumState>('/api/colloquium/join', entry.current));
    } catch (error) { setMessage(quizMessage(error)); }
    finally { locked.current = false; setBusy(false); }
  }
  async function submit() {
    if (locked.current || !state?.room || !queue.current) return;
    locked.current = true; setBusy(true); setMessage(null);
    try {
      const revision = await queue.current.flush();
      apply(await quizApi<ColloquiumState>('/api/colloquium/submit', { roomId: state.room.id, revision }));
      setConfirming(false);
    } catch (error) {
      setMessage(queue.current.status === 'error' ? 'Përgjigjet nuk janë ruajtur. Provo ruajtjen përsëri para dorëzimit.' : quizMessage(error));
      try { await refresh(false); } catch { /* Keep local pending answers. */ }
    } finally { locked.current = false; setBusy(false); }
  }
  const room = state?.room;
  const live = room?.state === 'live' && state?.attempt && !state.attempt.submitted;
  const answered = state?.questions.filter(question => queueView.answers[question.id]).length ?? 0;
  const saveStatus = queueView.status;
  return <main className="cq-shell" id="permbajtja-kryesore"><header className="cq-header"><a href="/student">← Profili i studentit</a><p className="eyebrow">Programimi për Pajisje Mobile · Java 7</p><h1>Kolokviumi I</h1><p>10 pyetje · 10 minuta · 10 pikë</p></header>
    {(message || pollMessage) && <div className="cq-notice" role="alert">{message || pollMessage} <button type="button" onClick={() => { void refresh().then(() => { setMessage(null); setPollMessage(null); }).catch(error => setMessage(quizMessage(error))); }}>Provo përsëri</button></div>}
    {!state && <p role="status">Duke ngarkuar kolokviumin…</p>}
    {state && room && !state.attempt && !state.registered && room.state !== 'finished' && <section className="cq-panel"><p className="cq-badge">Grupi {room.groupName}</p><h2>Hyr në kolokvium</h2><p>Plotëso profilin një herë. Pranohet emaili i fakultetit ose privat. Grupi caktohet nga lidhja e profesorit.</p><form className="student-form" aria-label="Hyr në kolokvium" onSubmit={register}>
      <label htmlFor="cq-first">Emri</label><input id="cq-first" name="firstName" autoComplete="given-name" maxLength={100} required disabled={busy} />
      <label htmlFor="cq-last">Mbiemri</label><input id="cq-last" name="lastName" autoComplete="family-name" maxLength={100} required disabled={busy} />
      <label htmlFor="cq-index">Indeksi</label><input id="cq-index" name="studentId" autoComplete="off" maxLength={100} required disabled={busy} />
      <label htmlFor="cq-email">Emaili i fakultetit ose privat</label><input id="cq-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required disabled={busy} />
      <p className="form-guidance">Profili mbahet mend në këtë shfletues për hyrjen tjetër.</p><button className="cq-primary" disabled={busy}>{busy ? 'Duke hyrë…' : 'Hyr në grup'}</button></form></section>}
    {state?.attempt && room?.state === 'lobby' && <section className="cq-panel cq-wait"><span className="cq-badge">Grupi {room.groupName} · Je regjistruar</span><h2>Je në pritje të profesorit</h2><p>Mbaje këtë faqe hapur. Pyetjet shfaqen automatikisht kur profesori fillon kolokviumin.</p><p>Koha është e përbashkët: 10 minuta për të gjithë grupin.</p><span className="cq-pulse" aria-hidden="true" /></section>}
    {live && <><div className="cq-quizbar"><div><strong>Grupi {room.groupName}</strong><span>{answered}/10 të përgjigjura</span></div>{room.deadline && <Timer deadline={room.deadline} offset={offset} />}<p role="status">{saveStatus === 'error' ? 'Ruajtja dështoi. Zgjedhjet e tua mbeten në këtë faqe.' : saveStatus === 'saving' ? 'Duke ruajtur…' : 'Të gjitha përgjigjet u ruajtën'}</p>{saveStatus === 'error' && <button onClick={() => { void queue.current?.retry().catch(() => {}); }}>Provo ruajtjen përsëri</button>}</div>
      <p className="cq-guidance">Zgjidh një përgjigje për çdo pyetje. E saktë = 1 pikë; e pasaktë ose bosh = 0. Përgjigjet ruhen automatikisht.</p>
      {state.questions.map((question, index) => <fieldset className="cq-question" key={question.id} disabled={busy}><legend><span>Pyetja {index + 1} / 10</span>{question.prompt}</legend>{question.options.map((option, optionIndex) => <label className={`cq-option${queueView.answers[question.id] === option.id ? ' cq-selected' : ''}`} key={option.id}><input type="radio" name={question.id} value={option.id} checked={queueView.answers[question.id] === option.id} onChange={() => queue.current?.choose(question.id, option.id)} /><span><strong>{['A', 'B', 'C'][optionIndex]}.</strong> {option.text}</span></label>)}</fieldset>)}
      <section className="cq-panel"><h2>Përfundo kolokviumin</h2><p>Në fund të kohës dorëzohen automatikisht përgjigjet e ruajtura.</p>{confirming ? <div role="group" aria-label="Konfirmo dorëzimin"><p><strong>Dëshiron të dorëzosh tani?</strong> Ke {answered}/10 përgjigje. Pas dorëzimit nuk mund t’i ndryshosh.</p><button className="cq-primary" disabled={busy} onClick={() => { void submit(); }}>{busy ? 'Duke dorëzuar…' : 'Po, dorëzo përgjigjet'}</button><button disabled={busy} onClick={() => setConfirming(false)}>Vazhdo punën</button></div> : <button onClick={() => setConfirming(true)}>Dorëzo para përfundimit</button>}</section></>}
    {state?.attempt?.submitted && room?.state !== 'finished' && <section className="cq-panel"><h2>Përgjigjet u dorëzuan</h2><p>Rezultati shfaqet këtu kur përfundon koha e grupit. Mund ta rihapësh këtë faqe.</p>{room?.deadline && <Timer deadline={room.deadline} offset={offset} />}</section>}
    {state && !room && <section className="cq-panel"><h2>Hyr nga lidhja e grupit</h2><p>Skano QR-në ose hap lidhjen që ndan profesori. Nëse ke hyrë më parë, përdor të njëjtin shfletues.</p>{state.rooms.filter(item => item.state !== 'finished').map(item => <p key={item.id}>Grupi {item.groupName} · {item.state === 'lobby' ? 'Në pritje' : 'Në zhvillim'}</p>)}</section>}
    {state && !live && <Results results={state.results} />}<footer className="cq-footer"><a href="https://arbenl.github.io/lendet/2026-2027/mobile/">Materialet e lëndës</a><p>Kolokviumi II · Java 14 · 10 pikë</p></footer></main>;
}
