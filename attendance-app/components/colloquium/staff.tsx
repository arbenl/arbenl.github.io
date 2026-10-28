"use client";
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColloquiumGroup, ColloquiumResult, ColloquiumStaffState } from '../../lib/colloquium/types';
import { quizApi, quizMessage, Results, Timer } from './shared';
function RoomLink({ roomId, token }: { roomId: string; token: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [link] = useState(() => `${typeof location === 'undefined' ? '' : location.origin}/colloquium#${new URLSearchParams({ room: roomId, token })}`);
  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, link, { width: 240, margin: 2, errorCorrectionLevel: 'M' }).catch(() => {});
  }, [link]);
  return <div className="cq-share"><canvas ref={canvas} role="img" aria-label="QR-ja e grupit për kolokviumin" /><label>Lidhja për studentët<input readOnly value={link} onFocus={event => event.currentTarget.select()} /></label><button onClick={() => { void navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Lidhja u kopjua' : 'Kopjo lidhjen'}</button><a href={link} target="_blank" rel="noreferrer">Hap lidhjen e grupit ↗</a></div>;
}
export function ColloquiumStaff() {
  const [state, setState] = useState<ColloquiumStaffState | null>(null);
  const [results, setResults] = useState<ColloquiumResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const locked = useRef(false);
  const apply = useCallback((next: ColloquiumStaffState) => { setState(next); setOffset(Date.parse(next.serverTime) - Date.now()); }, []);
  useEffect(() => {
    let active = true; let fetching = false;
    const poll = async () => {
      if (fetching || locked.current) return;
      fetching = true;
      try {
        const next = await quizApi<ColloquiumStaffState>('/api/staff/colloquium');
        if (active) apply(next);
        if (next.rooms.some(room => room.state === 'finished')) {
          const scores = await quizApi<ColloquiumResult[]>('/api/colloquium/results');
          if (active) setResults(scores);
        }
      } catch (error) { if (active) setMessage(quizMessage(error)); }
      finally { fetching = false; }
    };
    void poll(); const timer = setInterval(() => { void poll(); }, 2500);
    return () => { active = false; clearInterval(timer); };
  }, [apply]);
  async function action(groupName: ColloquiumGroup, roomId?: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage(null);
    try { apply(await quizApi<ColloquiumStaffState>(roomId ? `/api/staff/colloquium/${roomId}/start` : '/api/staff/colloquium', roomId ? {} : { groupName })); }
    catch (error) { setMessage(quizMessage(error)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <main className="cq-shell cq-staff" id="permbajtja-kryesore"><header className="cq-header"><a href="/staff">← Paneli i profesorit</a><p className="eyebrow">Programimi për Pajisje Mobile · Java 7</p><h1>Kolokviumi I</h1><p>Hapni pritjen për grupin, ndani lidhjen dhe filloni kur studentët të jenë gati.</p></header>{message && <p className="cq-notice" role="alert">{message}</p>}{!state && <p role="status">Duke ngarkuar grupet…</p>}
    {state && <div className="cq-groups">{(['G1', 'G2'] as const).map(groupName => {
      const room = state.rooms.find(item => item.groupName === groupName);
      return <section className="cq-panel" key={groupName} aria-labelledby={`cq-${groupName}`}><p className="eyebrow">Java 7 · 10 pikë</p><h2 id={`cq-${groupName}`}>Grupi {groupName}</h2>{!room ? <><p>Hapja e pritjes lejon hyrjen e studentëve. Koha fillon vetëm me butonin Fillo.</p><button className="cq-primary" disabled={busy} onClick={() => { void action(groupName); }}>Hap pritjen për {groupName}</button></> : <><p className="cq-badge">{room.state === 'lobby' ? 'Pritja është e hapur' : room.state === 'live' ? 'Kolokviumi në zhvillim' : 'Koha përfundoi'}</p>{room.state !== 'finished' && <RoomLink roomId={room.id} token={room.token} />}<h3>{room.joinedCount} studentë të regjistruar</h3>{room.participants.length ? <ul className="cq-participants">{room.participants.map((student, index) => <li key={index}>{student.fullName}{student.submitted ? <span>U dorëzua</span> : null}</li>)}</ul> : <p>Studentët shfaqen këtu pasi hyjnë në grup.</p>}{room.state === 'lobby' && <><p>Të gjithë marrin të njëjtën kohë: 600 sekonda. Fillimi nuk mund të kthehet prapa.</p><button className="cq-primary" disabled={busy} onClick={() => { void action(groupName, room.id); }}>Fillo {groupName} · 10 minuta</button></>}{room.state === 'live' && room.deadline && <Timer deadline={room.deadline} offset={offset} />}</>}</section>;
    })}</div>}{state && <Results results={results} />}</main>;
}
