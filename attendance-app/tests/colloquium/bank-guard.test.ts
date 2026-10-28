import { expect, it } from 'vitest';
import { permitsSyntheticBank } from '../../lib/colloquium/bank';
const isolated = { E2E_TEST_AUTH: '1', E2E_DISPOSABLE_DATABASE: '1', DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/attendance_e2e' };
it('permits synthetic questions only for explicit disposable loopback E2E harness', () => {
  expect(permitsSyntheticBank(isolated)).toBe(true);
});
it.each([{ VERCEL: '1' }, { VERCEL: '' }, { E2E_TEST_AUTH: undefined }, { E2E_DISPOSABLE_DATABASE: undefined }, { DATABASE_URL: 'postgresql://test:test@db.example.test/attendance_e2e' }, { DATABASE_URL: 'postgresql://test:test@127.0.0.1/production' }, { DATABASE_URL: 'invalid' }])('denies fixture bank under %j', patch => {
  expect(permitsSyntheticBank({ ...isolated, ...patch })).toBe(false);
});
