'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColloquiumPreviewResult, ColloquiumPreviewRun } from '../../lib/colloquium/types';
import { quizApi, quizMessage, Timer } from './shared';

const endpoint = '/api/staff/colloquium/preview';
export function ColloquiumPreview() {
  const [studentId, setStudentId] = useState('PROVE-001');
  const [run, setRun] = useState<ColloquiumPreviewRun | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ColloquiumPreviewResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [offset, setOffset] = useState(0);
  const generation = useRef(0);
  const locked = useRef(false);
  const autoAttempted = useRef(false);
  const currentRun = useRef<ColloquiumPreviewRun | null>(null);
  const currentAnswers = useRef<Record<string, string>>({});
  useEffect(() => () => { generation.current++; }, []);

  async function start() {
    if (locked.current) return;
    locked.current = true;
    const requestGeneration = ++generation.current;
    currentRun.current = null; currentAnswers.current = {}; autoAttempted.current = false;
    setRun(null); setAnswers({}); setResult(null); setExpired(false); setMessage(null); setBusy(true);
    try {
      const next = await quizApi<ColloquiumPreviewRun>(endpoint, { action: 'start', studentId });
      if (generation.current !== requestGeneration) return;
      currentRun.current = next; setRun(next); setStudentId(next.studentId);
      setOffset(Date.parse(next.serverTime) - Date.now());
    } catch (error) { if (generation.current === requestGeneration) setMessage(quizMessage(error)); }
    finally { if (generation.current === requestGeneration) { locked.current = false; setBusy(false); } }
  }
  const finish = useCallback(async () => {
    const active = currentRun.current;
    if (!active || locked.current) return;
    locked.current = true;
    const requestGeneration = generation.current;
    setBusy(true); setMessage(null);
    try {
      const next = await quizApi<ColloquiumPreviewResult>(endpoint, { action: 'grade', proof: active.proof, answers: currentAnswers.current });
      if (generation.current === requestGeneration) setResult(next);
    } catch (error) { if (generation.current === requestGeneration) setMessage(quizMessage(error)); }
    finally { if (generation.current === requestGeneration) { locked.current = false; setBusy(false); } }
  }, []);
  useEffect(() => {
    if (!run || result) return;
    const tick = () => {
      if (Date.now() + offset < Date.parse(run.deadline)) return;
      setExpired(true);
      if (!autoAttempted.current && !locked.current) { autoAttempted.current = true; void finish(); }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [run, result, offset, finish]);

  return <main className="cq-shell" id="permbajtja-kryesore">
    <header className="cq-header"><a href="/staff/colloquium">← Paneli i kolokviumit</a><p className="eyebrow">Vetëm për profesorin</p><h1>Provë private e profesorit</h1></header>
    <section className="cq-panel" aria-label="Njoftim për provën private"><strong>Provë private · 10 pyetje · 600 sekonda</strong><p>Indeksi është vetëm etiketë prove. Kjo provë nuk regjistron studentë, nuk ndryshon G1/G2 dhe nuk ruan nota zyrtare.</p><p>Përgjigjet mbahen vetëm në këtë faqe. Rifreskimi i faqes i fshin ato.</p></section>
    {message && <p className="cq-notice" role="alert">{message}</p>}
    {!run && <form className="cq-panel cq-form" aria-label="Fillo provën private" onSubmit={event => { event.preventDefault(); void start(); }}><label>Indeksi i provës<input value={studentId} maxLength={100} required disabled={busy} onChange={event => setStudentId(event.target.value)} /></label><p>Mund të përdorni çfarëdo etikete, për shembull GABIM.</p><button className="cq-primary" disabled={busy || !studentId.trim()} type="submit">Fillo provën private</button></form>}
    {run && <><section className="cq-panel"><p>Indeksi i provës: <strong>{run.studentId}</strong></p>{!result && <Timer deadline={run.deadline} offset={offset} />}{expired && !result && <p>Koha përfundoi. Përgjigjet janë mbyllur.</p>}{result && <><h2>Rezultati privat</h2><p><strong>{result.score}/10</strong></p><p>Vlerësim vetëm për këtë provë private.</p></>}<button type="button" disabled={busy} onClick={() => { void start(); }}>Rifillo provën</button></section>
      {!result && <>{run.questions.map((question, index) => <fieldset className="cq-question" key={question.id} disabled={busy || expired}><legend><span>Pyetja {index + 1} / 10</span>{question.prompt}</legend>{question.options.map((option, optionIndex) => <label className={`cq-option${answers[question.id] === option.id ? ' cq-selected' : ''}`} key={option.id}><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => {
        if (locked.current || Date.now() + offset >= Date.parse(run.deadline)) return;
        const next = { ...currentAnswers.current, [question.id]: option.id }; currentAnswers.current = next; setAnswers(next);
      }} /><span><strong>{['A', 'B', 'C'][optionIndex]}.</strong> {option.text}</span></label>)}</fieldset>)}<button className="cq-primary" type="button" disabled={busy} onClick={() => { void finish(); }}>{message ? 'Provo vlerësimin përsëri' : 'Përfundo provën'}</button></>}
    </>}
    {busy && <p role="status">Duke përpunuar provën private…</p>}
  </main>;
}
