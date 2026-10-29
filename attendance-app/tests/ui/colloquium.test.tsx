import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('next-auth/react', () => ({ signIn: auth.signIn }));
vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));
import { ColloquiumStudent } from '../../components/colloquium/student';
import { ColloquiumStaff } from '../../components/colloquium/staff';
import { AnswerQueue } from '../../components/colloquium/answer-queue';
const room = { id: 'room-one', groupName: 'G1', weekNumber: 7, state: 'lobby', startedAt: null, deadline: null };
const state = { serverTime: new Date().toISOString(), room, authenticated: false, registered: false, attempt: null, questions: [], results: [], rooms: [] };
const json = (value: unknown) => new Response(JSON.stringify(value));
beforeEach(() => { vi.restoreAllMocks(); auth.signIn.mockReset(); sessionStorage.clear(); window.history.replaceState({}, '', '/colloquium#room=room-one&token=abc'); });
afterEach(cleanup);
it('takes a room fragment out of the address and registers inline without group or password', async () => {
 vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(state));
 auth.signIn.mockResolvedValue({ ok: true });
 const view = render(<ColloquiumStudent />);
 const form = await view.findByRole('form', { name: 'Hyr në kolokvium' });
 expect(window.location.hash).toBe('');
 expect(view.queryByLabelText(/Grupi/)).toBeNull();
 expect(view.container.querySelector('input[type=password]')).toBeNull();
 for (const [label, value] of [['Emri', 'Arta'], ['Mbiemri', 'Kola'], ['Indeksi', 'A100'], ['Emaili i fakultetit ose privat', 'arta@example.com']]) fireEvent.change(view.getByLabelText(label, { exact: true }), { target: { value } });
 fireEvent.submit(form);
 await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('colloquium', expect.objectContaining({ token: 'abc', studentId: 'A100', email: 'arta@example.com' })));
});
it('automatically joins a remembered student and waits without showing questions', async () => {
 const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => json(String(url).endsWith('/join') ? { ...state, registered: true, authenticated: true, attempt: { id: 'a', submitted: false, answers: {}, revisions: {}, revision: 0 } } : { ...state, registered: true, authenticated: true }));
 const view = render(<ColloquiumStudent />);
 await view.findByText('Je në pritje të profesorit');
 expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/join'))).toBe(true);
 expect(view.queryByRole('radio')).toBeNull();
});
it('never starts a teacher lobby automatically and renders both group controls', async () => {
 const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => json(String(url).endsWith('/results') ? [] : { serverTime: state.serverTime, rooms: [{ ...room, token: 'abc', joinedCount: 1, participants: [{ fullName: 'Arta Kola', submitted: false }] }] }));
 const view = render(<ColloquiumStaff />);
 await view.findByRole('button', { name: 'Fillo G1 · 10 minuta' });
 expect(view.getByRole('button', { name: 'Hap pritjen për G2' })).toBeTruthy();
 expect(view.getByText('Arta Kola')).toBeTruthy();
 expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
});
it('shows published points before a slow professor group request completes', async () => {
 vi.spyOn(globalThis, 'fetch').mockImplementation(async url => String(url).endsWith('/results')
  ? json([{ fullName: 'Arta Kola', groupName: 'G1', score: 8 }])
  : new Promise<Response>(() => {}));
 const view = render(<ColloquiumStaff />);
 await view.findByText('8/10');
 expect(view.getByText('Arta Kola')).toBeTruthy();
 expect(view.getByRole('link', { name: 'Shiko rezultatet' }).getAttribute('href')).toBe('#cq-results');
 expect(view.getByText('Duke ngarkuar grupet…')).toBeTruthy();
});
it('shows a result loading failure honestly and recovers on explicit retry', async () => {
 let failed = true;
 vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
  if (String(url).endsWith('/results')) return failed
   ? new Response(JSON.stringify({ error: { code: 'internal_error' } }), { status: 500 })
   : json([{ fullName: 'Arta Kola', groupName: 'G1', score: 8 }]);
  return json({ serverTime: state.serverTime, rooms: [] });
 });
 const view = render(<ColloquiumStaff />);
 await view.findByRole('button', { name: 'Provo rezultatet përsëri' });
 expect(view.queryByText('Rezultatet shfaqen këtu kur përfundon koha e grupit.')).toBeNull();
 failed = false;
 fireEvent.click(view.getByRole('button', { name: 'Provo rezultatet përsëri' }));
 await view.findByText('8/10');
 expect(view.queryByRole('alert')).toBeNull();
});
it('keeps published points visible while refresh fails, then clears the error on recovery', async () => {
 let failed = false;
 vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
  if (String(url).endsWith('/results')) {
   if (failed) throw new Error('offline');
   return json([{ fullName: 'Arta Kola', groupName: 'G1', score: 8 }]);
  }
  return json({ serverTime: state.serverTime, rooms: [] });
 });
 const view = render(<ColloquiumStaff />);
 await view.findByText('8/10');
 failed = true;
 fireEvent.click(view.getByRole('button', { name: 'Rifresko rezultatet' }));
 await view.findByRole('button', { name: 'Provo rezultatet përsëri' });
 expect(view.getByText('8/10')).toBeTruthy();
 failed = false;
 fireEvent.click(view.getByRole('button', { name: 'Provo rezultatet përsëri' }));
 await waitFor(() => expect(view.queryByRole('alert')).toBeNull());
 expect(view.getByText('8/10')).toBeTruthy();
});
it('serializes same-question writes, preserves the last click through polling, and flushes latest global revision', async () => {
 let release!: (value: { questionRevision: number; revision: number }) => void;
 const save = vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValue({ questionRevision: 2, revision: 4 });
 const queue = new AnswerQueue(save, () => {});
 queue.hydrate({ answers: {}, revisions: {}, revision: 0 });
 queue.choose('q', 'first');
 queue.choose('q', 'latest');
 queue.hydrate({ answers: { q: null }, revisions: { q: 0 }, revision: 0 });
 expect(queue.answers.q).toBe('latest');
 release({ questionRevision: 1, revision: 3 });
 expect(await queue.flush()).toBe(4);
 expect(save.mock.calls).toEqual([['q', 'first', 0], ['q', 'latest', 1]]);
 expect(queue.status).toBe('saved');
});
it('keeps a failed answer visible and requires retry before submit can flush', async () => {
 const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ questionRevision: 1, revision: 1 });
 const queue = new AnswerQueue(save, () => {});
 queue.choose('q', 'latest');
 await expect(queue.flush()).rejects.toThrow();
 expect(queue.answers.q).toBe('latest');
 expect(queue.status).toBe('error');
 await queue.retry();
 expect(await queue.flush()).toBe(1);
});
it('retains a failed visible answer through polling and flushes its retry before confirming submit', async () => {
 const questions = [{ id: 'q', prompt: 'Pyetja provë', options: [{ id: 'one', text: 'Një' }, { id: 'two', text: 'Dy' }, { id: 'three', text: 'Tre' }] }];
 const attempt = { id: 'a', submitted: false, answers: {}, revisions: {}, revision: 0 };
 const live = { ...state, room: { ...room, state: 'live', deadline: new Date(Date.now() + 600000).toISOString() }, authenticated: true, registered: true, attempt, questions };
 let offline = true;
 const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
  if (String(url).endsWith('/answer')) {
   if (offline) throw new Error('offline');
   return json({ questionRevision: 1, revision: 1 });
  }
  if (String(url).endsWith('/submit')) return json({ ...live, questions: [], attempt: { ...attempt, submitted: true, revision: 1 } });
  return json(live);
 });
 const view = render(<ColloquiumStudent />);
 fireEvent.click(await view.findByRole('radio', { name: 'B. Dy' }));
 await view.findByText(/Ruajtja dështoi/);
 expect((view.getByRole('radio', { name: 'B. Dy' }) as HTMLInputElement).checked).toBe(true);
 offline = false;
 fireEvent.click(view.getByRole('button', { name: 'Provo ruajtjen përsëri' }));
 await view.findByText('Të gjitha përgjigjet u ruajtën');
 fireEvent.click(view.getByRole('button', { name: 'Dorëzo para përfundimit' }));
 expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/submit'))).toHaveLength(0);
 fireEvent.click(view.getByRole('button', { name: 'Po, dorëzo përgjigjet' }));
 await view.findByRole('heading', { name: 'Përgjigjet u dorëzuan' });
 const submission = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/submit'));
 expect(JSON.parse(submission![1]!.body as string).revision).toBe(1);
});

it('recovers the existing attempt when a remembered student opens the other group link', async () => {
 const attempt = { id: 'a', submitted: false, answers: {}, revisions: {}, revision: 0 };
 vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
  if (String(url).endsWith('/join')) return new Response(JSON.stringify({ error: { code: 'attempt_exists' } }), { status: 409 });
  if (init?.body === '{}') return json({ ...state, room: { ...room, groupName: 'G2' }, registered: true, authenticated: true, attempt });
  return json({ ...state, registered: true, authenticated: true });
 });
 const view = render(<ColloquiumStudent />);
 await view.findByRole('heading', { name: 'Je në pritje të profesorit' });
 expect(view.getByText('Grupi G2 · Je regjistruar')).toBeTruthy();
 expect(sessionStorage.getItem('colloquium-room')).toBeNull();
});
it('labels shuffled choices A/B/C by display position and retains text and opaque values after remount', async () => {
 const questions = [{ id: 'q', prompt: 'Pyetja me renditje të ruajtur', options: [{ id: 'opaque-z', text: 'Alternativa C' }, { id: 'opaque-x', text: 'Alternativa A' }, { id: 'opaque-y', text: 'Alternativa B' }] }];
 const attempt = { id: 'a', submitted: false, answers: {}, revisions: {}, revision: 0 };
 vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ ...state, room: { ...room, state: 'live', deadline: new Date(Date.now() + 600000).toISOString() }, authenticated: true, registered: true, attempt, questions }));
 const expectedLabels = ['A. Alternativa C', 'B. Alternativa A', 'C. Alternativa B'];
 let view = render(<ColloquiumStudent />);
 await view.findByRole('radio', { name: 'A. Alternativa C' });
 expect(view.getAllByRole('radio').map(radio => radio.closest('label')?.textContent)).toEqual(expectedLabels);
 expect(view.getAllByRole('radio').map(radio => (radio as HTMLInputElement).value)).toEqual(['opaque-z', 'opaque-x', 'opaque-y']);
 view.unmount();
 view = render(<ColloquiumStudent />);
 await view.findByRole('radio', { name: 'A. Alternativa C' });
 expect(view.getAllByRole('radio').map(radio => radio.closest('label')?.textContent)).toEqual(expectedLabels);
 expect(view.getAllByRole('radio').map(radio => (radio as HTMLInputElement).value)).toEqual(['opaque-z', 'opaque-x', 'opaque-y']);
});
it('ends initial loading after a failed request and recovers when retry succeeds', async () => {
 vi.spyOn(globalThis, 'fetch')
  .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'internal_error' } }), { status: 500 }))
  .mockImplementation(async () => json({ ...state, room: null }));
 const view = render(<ColloquiumStudent />);
 await view.findByRole('alert');
 expect(view.queryByRole('status')).toBeNull();
 fireEvent.click(view.getByRole('button', { name: 'Provo përsëri' }));
 await view.findByRole('heading', { name: 'Hyr nga lidhja e grupit' });
 expect(view.queryByRole('alert')).toBeNull();
});
