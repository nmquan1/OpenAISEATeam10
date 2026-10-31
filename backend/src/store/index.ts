import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export interface RunRecord {
  id: string;
  createdAt: string;
  kind: 'evaluate' | 'recommend';
  schemaVersion: '2.0';
  input: unknown;
  result: unknown;
}
/** One paid AI call, kept per client so the UI can show model, usage, cost and context. */
export interface AiUsageRecord {
  id: string;
  createdAt: string;
  clientId: string;
  runId: string;
  model: string;
  requestId: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  attempts: number;
  context: unknown;
}
export interface RunStore {
  save(kind: RunRecord['kind'], input: unknown, result: unknown): Promise<RunRecord>;
  list(): Promise<RunRecord[]>;
  get(id: string): Promise<RunRecord | undefined>;
  consumeAi(limit: number): Promise<boolean>;
  aiSpentUsd(clientId: string): Promise<number>;
  recordAi(entry: Omit<AiUsageRecord, 'id' | 'createdAt'>): Promise<AiUsageRecord>;
  listAi(clientId: string): Promise<AiUsageRecord[]>;
}
interface State {
  version: 2;
  runs: RunRecord[];
  usage: { day: string; count: number };
  ai?: AiUsageRecord[];
}
const newAiRecord = (entry: Omit<AiUsageRecord, 'id' | 'createdAt'>): AiUsageRecord => ({
  id: randomUUID(),
  createdAt: new Date().toISOString(),
  ...entry,
});
/** One shared workspace, one writer process per file. Use Supabase for multiple instances. */
export class JsonRunStore implements RunStore {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}
  private async read(): Promise<State> {
    try {
      const state = JSON.parse(await readFile(this.file, 'utf8')) as State;
      if (state.version !== 2 || !Array.isArray(state.runs) || !state.usage)
        throw new Error('Unsupported workspace store format; choose a new RUN_STORE_PATH');
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { version: 2, runs: [], usage: { day: '', count: 0 } };
      throw error;
    }
  }
  private update<T>(mutate: (state: State) => T): Promise<T> {
    const operation = this.pending.then(async () => {
      const state = await this.read();
      const result = mutate(state);
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
      await rename(temporary, this.file);
      return result;
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }
  save(kind: RunRecord['kind'], input: unknown, result: unknown): Promise<RunRecord> {
    return this.update((state) => {
      const row: RunRecord = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        kind,
        schemaVersion: '2.0',
        input,
        result,
      };
      state.runs.push(row);
      return row;
    });
  }
  async list(): Promise<RunRecord[]> {
    await this.pending;
    return (await this.read()).runs.slice(-50).reverse();
  }
  async get(id: string): Promise<RunRecord | undefined> {
    await this.pending;
    return (await this.read()).runs.find((row) => row.id === id);
  }
  consumeAi(limit: number): Promise<boolean> {
    return this.update((state) => {
      const day = new Date().toISOString().slice(0, 10);
      if (state.usage.day !== day) state.usage = { day, count: 0 };
      if (state.usage.count >= limit) return false;
      state.usage.count++;
      return true;
    });
  }
  async aiSpentUsd(clientId: string): Promise<number> {
    await this.pending;
    return ((await this.read()).ai ?? [])
      .filter((row) => row.clientId === clientId)
      .reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  }
  recordAi(entry: Omit<AiUsageRecord, 'id' | 'createdAt'>): Promise<AiUsageRecord> {
    return this.update((state) => {
      const row = newAiRecord(entry);
      (state.ai ??= []).push(row);
      return row;
    });
  }
  async listAi(clientId: string): Promise<AiUsageRecord[]> {
    await this.pending;
    return ((await this.read()).ai ?? [])
      .filter((row) => row.clientId === clientId)
      .slice(-50)
      .reverse();
  }
}
/** Database-only adapter: service-role key stays on the server; all runs share one workspace. */
export class SupabaseRunStore implements RunStore {
  constructor(
    private url: string,
    private serviceRoleKey: string,
  ) {}
  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    try {
      const response = await fetch(`${this.url}/rest/v1/${path}`, {
        ...init,
        signal: AbortSignal.timeout(10000),
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
      if (!response.ok) throw new Error('Storage rejected request');
      return response.status === 204 ? undefined : await response.json();
    } catch {
      throw Object.assign(new Error('Run store unavailable'), { status: 503 });
    }
  }
  private decode(row: Record<string, unknown>): RunRecord {
    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      kind: row.kind as RunRecord['kind'],
      schemaVersion: '2.0',
      input: row.input,
      result: row.result,
    };
  }
  async save(kind: RunRecord['kind'], input: unknown, result: unknown): Promise<RunRecord> {
    const rows = (await this.request('market_maker_runs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        workspace_id: 'workspace',
        kind,
        schema_version: '2.0',
        input,
        result,
      }),
    })) as Record<string, unknown>[];
    return this.decode(rows[0]!);
  }
  async list(): Promise<RunRecord[]> {
    const rows = (await this.request(
      'market_maker_runs?workspace_id=eq.workspace&order=created_at.desc&limit=50',
    )) as Record<string, unknown>[];
    return rows.map((row) => this.decode(row));
  }
  async get(id: string): Promise<RunRecord | undefined> {
    const rows = (await this.request(
      `market_maker_runs?id=eq.${encodeURIComponent(id)}&workspace_id=eq.workspace&limit=1`,
    )) as Record<string, unknown>[];
    return rows[0] ? this.decode(rows[0]) : undefined;
  }
  async consumeAi(limit: number): Promise<boolean> {
    const result = await this.request('rpc/market_maker_consume_ai', {
      method: 'POST',
      body: JSON.stringify({ daily_limit: limit }),
    });
    if (typeof result !== 'boolean')
      throw Object.assign(new Error('Invalid quota store response'), { status: 503 });
    return result;
  }
  async aiSpentUsd(clientId: string): Promise<number> {
    const rows = (await this.request(
      `market_maker_ai_calls?client_id=eq.${encodeURIComponent(clientId)}&select=cost_usd`,
    )) as { cost_usd: number | null }[];
    return rows.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
  }
  async recordAi(entry: Omit<AiUsageRecord, 'id' | 'createdAt'>): Promise<AiUsageRecord> {
    const row = newAiRecord(entry);
    await this.request('market_maker_ai_calls', {
      method: 'POST',
      body: JSON.stringify({
        id: row.id,
        created_at: row.createdAt,
        client_id: row.clientId,
        run_id: row.runId,
        model: row.model,
        request_id: row.requestId,
        prompt_version: row.promptVersion,
        input_tokens: row.inputTokens,
        output_tokens: row.outputTokens,
        cost_usd: row.costUsd,
        attempts: row.attempts,
        context: row.context,
      }),
    });
    return row;
  }
  async listAi(clientId: string): Promise<AiUsageRecord[]> {
    const rows = (await this.request(
      `market_maker_ai_calls?client_id=eq.${encodeURIComponent(clientId)}&order=created_at.desc&limit=50`,
    )) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      clientId: String(row.client_id),
      runId: String(row.run_id),
      model: String(row.model),
      requestId: String(row.request_id),
      promptVersion: String(row.prompt_version),
      inputTokens: row.input_tokens as number | null,
      outputTokens: row.output_tokens as number | null,
      costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
      attempts: Number(row.attempts),
      context: row.context,
    }));
  }
}
