import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './api/app.ts';
import { JsonRunStore, SupabaseRunStore } from './store/index.ts';
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
try {
  process.loadEnvFile(resolve(root, '.env'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535');
const dailyAiLimit = Number(process.env.AI_DAILY_CALL_LIMIT ?? 20);
if (!Number.isInteger(dailyAiLimit) || dailyAiLimit < 1 || dailyAiLimit > 20)
  throw new Error('AI_DAILY_CALL_LIMIT must be 1..20');
const aiBudgetUsd = Number(process.env.AI_TRIAL_BUDGET_USD ?? 10);
if (!Number.isFinite(aiBudgetUsd) || aiBudgetUsd < 0)
  throw new Error('AI_TRIAL_BUDGET_USD must be a non-negative number');
if (!process.env.OPENAI_INPUT_USD_PER_MILLION || !process.env.OPENAI_OUTPUT_USD_PER_MILLION)
  console.warn(
    'OPENAI_*_USD_PER_MILLION unset: AI cost is unknown and the trial budget cannot be enforced',
  );
const storeMode = process.env.RUN_STORE ?? 'local';
if (!['local', 'supabase'].includes(storeMode))
  throw new Error('RUN_STORE must be local or supabase');
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (storeMode === 'supabase') {
  if (!supabaseUrl || !serviceRoleKey)
    throw new Error(
      'Supabase database requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server',
    );
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Supabase database requires HTTPS outside local development');
}
const store =
  storeMode === 'supabase'
    ? new SupabaseRunStore(supabaseUrl!, serviceRoleKey!)
    : new JsonRunStore(resolve(root, process.env.RUN_STORE_PATH ?? '.local/workspace-runs.json'));
const app = await buildApp({
  host,
  store,
  dailyAiLimit,
  aiBudgetUsd,
  allowedHosts: (process.env.ALLOWED_HOSTS ?? 'localhost,127.0.0.1,[::1]')
    .split(',')
    .map((x) => x.trim()),
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS ??
    'http://localhost:4173,http://127.0.0.1:4173,http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((x) => x.trim()),
  aiConfigured: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL),
  modelConfigured: Boolean(process.env.OPENAI_MODEL),
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
await app.listen({ host, port });
