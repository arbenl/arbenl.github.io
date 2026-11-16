import {act,cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../../lib/auth/session',async original=>({...await original<object>(),requireCurrentStaff:async()=>({role:'professor'})}));
import StaffPage from '../../app/staff/page';
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('moves the professor material overview and QR section to the same next week across midnight',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-19T22:59:45Z'));
 vi.spyOn(globalThis,'fetch').mockImplementation(async input=>Response.json(String(input)==='/api/admin/course-setup'?{}:[]));
 let view:ReturnType<typeof render>;
 await act(async()=>{view=render(await StaffPage());});
 expect(view!.container.querySelector('[data-focus-week]')?.getAttribute('data-focus-week')).toBe('10');
 await act(async()=>{vi.advanceTimersByTime(60_000);});
 expect(view!.container.querySelector('[data-focus-week]')?.getAttribute('data-focus-week')).toBe('11');
 expect(view!.container.querySelector('[data-current-qr-week]')?.getAttribute('data-current-qr-week')).toBe('11');
});
