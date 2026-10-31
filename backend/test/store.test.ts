import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonRunStore, SupabaseRunStore } from '../src/store/index.ts';
test('shared local store reloads runs and serializes global daily quota updates', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'market-maker-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'workspace-runs.json');
  const store = new JsonRunStore(file);
  const run = await store.save('evaluate', { sample: 1 }, { sample: 2 });
  assert.equal((await store.list()).length, 1);
  assert.deepEqual((await new JsonRunStore(file).get(run.id))?.result, { sample: 2 });
  const attempts = await Promise.all(Array.from({ length: 20 }, () => store.consumeAi(3)));
  assert.equal(attempts.filter(Boolean).length, 3);
  assert.equal(await new JsonRunStore(file).consumeAi(3), false);
});
test('Supabase database adapter uses only server service-role credentials and the shared workspace', async (t) => {
  const seen: { url: string; headers: Record<string, string>; body?: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => {
    seen.push({
      url: String(url),
      headers: options?.headers as Record<string, string>,
      ...(options?.body ? { body: String(options.body) } : {}),
    });
    return Response.json(String(url).includes('/rpc/') ? true : []);
  });
  const store = new SupabaseRunStore('https://project.supabase.co', 'server-only-key');
  assert.deepEqual(await store.list(), []);
  assert.equal(await store.get('run-1'), undefined);
  assert.equal(await store.consumeAi(5), true);
  assert.ok(seen.slice(0, 2).every((call) => call.url.includes('workspace_id=eq.workspace')));
  assert.ok(seen.every((call) => call.headers.Authorization === 'Bearer server-only-key'));
  assert.equal(seen[2]?.body, '{"daily_limit":5}');
});
test('storage outages fail safely and malformed quota responses cannot authorize paid work', async (t) => {
  const store = new SupabaseRunStore('https://project.supabase.co', 'server-only-key');
  const malformed = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ allowed: true }),
  );
  await assert.rejects(
    store.consumeAi(20),
    (error: unknown) => (error as { status: number }).status === 503,
  );
  malformed.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('private transport detail');
  });
  await assert.rejects(
    store.list(),
    (error: unknown) =>
      (error as { status: number; message: string }).status === 503 &&
      (error as Error).message === 'Run store unavailable',
  );
});
