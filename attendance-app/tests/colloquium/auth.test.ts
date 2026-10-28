import { expect, it, vi } from 'vitest';
import { createAuthOptions } from '../../lib/auth/options';
const environment = { GITHUB_ID: 'test', GITHUB_SECRET: 'test', NEXTAUTH_SECRET: 'test' };
it('colloquium credentials return canonical scoped identity without accepting group/user/staff claims', async () => {
  const person = { id: '00000000-0000-4000-8000-000000000001', name: 'Arta Test', email: 'arta@example.test', authMethod: 'classroom' as const, rosterId: '00000000-0000-4000-8000-000000000002', semesterId: '00000000-0000-4000-8000-000000000003' };
  const registerColloquiumStudent = vi.fn().mockResolvedValue(person);
  const options = createAuthOptions(environment, { registerColloquiumStudent });
  const provider = options.providers.find(p => p.id === 'colloquium') as unknown as {
    options: {
      authorize: (credentials: unknown, request: unknown) => Promise<unknown>;
    };
  };
  const input = { token: 'room', email: person.email, firstName: 'Arta', lastName: 'Test', studentId: 'S-1', userId: 'forged', githubId: '100', groupName: 'G2', role: 'professor' };
  const authorized = await provider.options.authorize(input, { headers: { 'x-forwarded-for': '192.0.2.1, 127.0.0.1' } });
  expect(authorized).toMatchObject({ userId: person.id, authMethod: 'classroom' });
  expect(registerColloquiumStudent).toHaveBeenCalledWith({ token: 'room', email: person.email, firstName: 'Arta', lastName: 'Test', studentId: 'S-1' }, '192.0.2.1');
  const jwt = options.callbacks!.jwt!;
  const args = { token: { githubId: '100', githubLogin: 'professor' }, user: authorized, account: { provider: 'colloquium', providerAccountId: person.id, type: 'credentials' }, trigger: 'signIn' } as Parameters<typeof jwt>[0];
  const token = await jwt(args);
  expect(token).toMatchObject({ userId: person.id, authMethod: 'classroom' });
  expect(token.githubId).toBeUndefined();
});
it('does not disclose private error messages', async () => {
  const registerColloquiumStudent = vi.fn().mockRejectedValue(new Error('private@example.test secret'));
  const options = createAuthOptions(environment, { registerColloquiumStudent });
  const provider = options.providers.find(p => p.id === 'colloquium') as unknown as {
    options: {
      authorize: (c: unknown, r: unknown) => Promise<unknown>;
    };
  };
  await expect(provider.options.authorize({}, { headers: {} })).rejects.toThrow(/^registration_failed$/);
});
