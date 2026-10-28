import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ColloquiumPreview } from '../../components/colloquium/preview';
const json = (body: unknown) => new Response(JSON.stringify(body));
const makeRun = (proof = 'opaque-proof', deadline = Date.now() + 600000) => ({ private: true, studentId: 'GABIM', proof, serverTime: new Date().toISOString(), deadline: new Date(deadline).toISOString(), questions: Array.from({ length: 10 }, (_, i) => ({ id: `q-${proof}-${i}`, prompt: `Synthetic question ${i}`, options: [{ id: 'first', text: 'Synthetic one' }, { id: 'second', text: 'Synthetic two' }, { id: 'third', text: 'Synthetic three' }] })) });
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function start(view: ReturnType<typeof render>) {
 fireEvent.change(view.getByLabelText('Indeksi i provës'), { target: { value: 'GABIM' } });
 fireEvent.click(view.getByRole('button', { name: 'Fillo provën private' }));
 await view.findAllByRole('radio');
}
it('starts any label without registration, finishes score/10, and resets only private state', async () => {
 const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(makeRun())).mockResolvedValueOnce(json({ private: true, studentId: 'GABIM', score: 1, maxScore: 10 })).mockResolvedValueOnce(json(makeRun('new-proof')));
 const view = render(<ColloquiumPreview />);
 expect(view.getByText(/Provë private e profesorit/)).toBeTruthy();
 expect(fetchMock).not.toHaveBeenCalled();
 await start(view);
 expect(view.getAllByRole('radio')).toHaveLength(30);
 expect(view.getByLabelText('Koha e mbetur').textContent).toBe('10:00');
 expect(view.getAllByRole('radio').slice(0, 3).map(radio => radio.closest('label')?.textContent)).toEqual(['A. Synthetic one', 'B. Synthetic two', 'C. Synthetic three']);
 fireEvent.click(view.getAllByRole('radio')[0]);
 fireEvent.click(view.getByRole('button', { name: 'Përfundo provën' }));
 await view.findByText('1/10');
 const finish = JSON.parse(fetchMock.mock.calls[1][1]!.body as string);
 expect(finish).toEqual({ action: 'grade', proof: 'opaque-proof', answers: { 'q-opaque-proof-0': 'first' } });
 fireEvent.click(view.getByRole('button', { name: 'Rifillo provën' }));
 await waitFor(() => expect(view.getAllByRole('radio')).toHaveLength(30));
 expect(view.queryByText('1/10')).toBeNull();
 expect(view.getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
 expect(fetchMock.mock.calls.every(([url]) => url === '/api/staff/colloquium/preview')).toBe(true);
 expect(JSON.parse(fetchMock.mock.calls[2][1]!.body as string)).toEqual({ action: 'start', studentId: 'GABIM' });
 expect(sessionStorage.length + localStorage.length).toBe(0);
 view.unmount();
 const refreshed = render(<ColloquiumPreview />);
 expect(refreshed.getByRole('button', { name: 'Fillo provën private' })).toBeTruthy();
 expect(refreshed.queryByRole('radio')).toBeNull();
});
it('expires once, locks choices, and allows a manual grade retry after failure', async () => {
 vi.useFakeTimers();
 const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(makeRun('expiry', Date.now() + 1000))).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json({ private: true, studentId: 'GABIM', score: 0, maxScore: 10 }));
 const view = render(<ColloquiumPreview />);
 await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Fillo provën private' })); });
 await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
 expect(fetchMock).toHaveBeenCalledTimes(2);
 expect(view.getAllByRole('radio').every(radio => (radio as HTMLInputElement).disabled || (radio.closest('fieldset') as HTMLFieldSetElement).disabled)).toBe(true);
 expect(view.getByRole('alert')).toBeTruthy();
 await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
 expect(fetchMock).toHaveBeenCalledTimes(2);
 fireEvent.click(view.getByRole('button', { name: 'Provo vlerësimin përsëri' }));
 await act(async () => {});
 expect(view.getByText('0/10')).toBeTruthy();
});
it('serializes double clicks and ignores a response after unmount', async () => {
 let release!: (response: Response) => void;
 const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { release = resolve; }));
 const view = render(<ColloquiumPreview />);
 const button = view.getByRole('button', { name: 'Fillo provën private' });
 fireEvent.click(button); fireEvent.click(button);
 expect(fetchMock).toHaveBeenCalledTimes(1);
 view.unmount();
 const fresh = render(<ColloquiumPreview />);
 await act(async () => { release(json(makeRun())); });
 expect(fresh.queryByRole('radio')).toBeNull();
 expect(fresh.getByRole('button', { name: 'Fillo provën private' })).toBeTruthy();
});
it('clears old proof and result before a restart failure and exposes an explicit retry', async () => {
 const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(makeRun())).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json(makeRun('retried')));
 const view = render(<ColloquiumPreview />);
 await start(view);
 fireEvent.click(view.getByRole('button', { name: 'Rifillo provën' }));
 await view.findByRole('alert');
 expect(view.queryByRole('radio')).toBeNull();
 fireEvent.click(view.getByRole('button', { name: 'Fillo provën private' }));
 await view.findAllByRole('radio');
 expect(fetchMock).toHaveBeenCalledTimes(3);
});

it.each(['before expiry', 'across expiry'])('keeps one automatic deadline attempt after an early manual grade fails %s', async timing => {
 vi.useFakeTimers();
 let rejectEarly!: (error: Error) => void;
 const fetchMock = vi.spyOn(globalThis, 'fetch')
  .mockResolvedValueOnce(json(makeRun('early-failure', Date.now() + 1000)))
  .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectEarly = reject; }))
  .mockRejectedValueOnce(new Error('deadline offline'))
  .mockResolvedValueOnce(json({ private: true, studentId: 'GABIM', score: 0, maxScore: 10 }));
 const view = render(<ColloquiumPreview />);
 await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Fillo provën private' })); });
 fireEvent.click(view.getByRole('button', { name: 'Përfundo provën' }));
 expect(fetchMock).toHaveBeenCalledTimes(2);
 if (timing === 'across expiry') {
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
 }
 await act(async () => { rejectEarly(new Error('early offline')); });
 await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
 expect(fetchMock).toHaveBeenCalledTimes(3);
 expect(fetchMock.mock.calls.slice(1).map(([, init]) => JSON.parse(init!.body as string).action)).toEqual(['grade', 'grade']);
 expect(view.getAllByRole('radio').every(radio => (radio.closest('fieldset') as HTMLFieldSetElement).disabled)).toBe(true);
 expect(view.getByRole('alert')).toBeTruthy();
 await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
 expect(fetchMock).toHaveBeenCalledTimes(3);
 await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Provo vlerësimin përsëri' })); });
 expect(fetchMock).toHaveBeenCalledTimes(4);
 expect(view.getByText('0/10')).toBeTruthy();
});
