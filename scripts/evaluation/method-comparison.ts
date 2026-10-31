import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Value } from '@sinclair/typebox/value';
import {
  parseRecommendationRequest,
  VoucherSchema,
  CandidateProposalSchema,
  type EvaluationInput,
  type EvaluationResult,
  type Strategy,
  type Voucher,
} from '../../contracts/model.ts';
import { evaluate } from '../../backend/src/engine/index.ts';
import {
  searchVouchers,
  hybridSearchVouchers,
  evaluateCandidate,
} from '../../backend/src/engine/search.ts';
import { retrieveEvidence as retrieveLegacy } from '../../backend/src/evidence/retrieve-legacy.ts';
import { retrieveEvidence } from '../../backend/src/evidence/retrieve.ts';
import { generateCandidates } from '../../backend/src/agent/openai.ts';
import { summarizeContext } from '../../backend/src/agent/context.ts';
import { PROMPT_VERSION, SYSTEM_PROMPT } from '../../backend/src/agent/prompt.ts';
import {
  explainStrategies,
  EXPLANATION_PROMPT_VERSION,
  EXPLANATION_PROMPT,
} from '../../backend/src/agent/explain.ts';
import type { TechnicalCase } from '../eval-technical.ts';
import { LiveBudget } from './budget.ts';
import { hash, gridCandidates } from './metrics.ts';
import { rankAtK } from './rank-metrics.ts';
import type { RetrievalResult } from '../../contracts/evidence.ts';

const rank = (a: Strategy, b: Strategy) =>
  b.score - a.score || a.discount_dong - b.discount_dong || a.id.localeCompare(b.id);
const distinctRanked = (strategies: Strategy[]) =>
  [...new Map(strategies.map((strategy) => [strategy.id, strategy])).values()]
    .sort(rank)
    .slice(0, 5);

/** Uniform reference lattice is independent of search probes; not a global-optimum oracle. */
export function buildIndependentGold(input: EvaluationInput) {
  const maximum = Math.min(
    1_000_000_000,
    input.product.lines.reduce((sum, line) => sum + line.quantity * line.unit_price_dong, 0),
  );
  const baseline = evaluate(input);
  const maxEvaluations = 10000;
  const stride =
    100 * Math.max(1, Math.ceil((Math.floor(maximum / 100) + 1) / (maxEvaluations - 5)));
  const amounts = new Set<number>([
    maximum,
    ...baseline.strategies.map((strategy) => strategy.discount_dong),
  ]);
  for (let value = 0; value <= maximum; value += stride) amounts.add(value);
  if (amounts.size > maxEvaluations) throw new Error('Independent gold exceeds evaluation budget');
  const strategies = [...amounts].map((amount): Strategy =>
    evaluateCandidate(input, {
      type: 'fixed',
      amount_dong: amount,
      minimum_dong: 0,
      seller_funding_bps: input.voucher.seller_funding_bps,
    }),
  );
  const top = distinctRanked(strategies);
  return {
    version: 'independent-uniform-payout-lattice.v1',
    strategies: top,
    qrels: Object.fromEntries(top.map((strategy) => [strategy.id, 1])),
    best_score: top[0]!.score,
    evaluation_count: amounts.size,
    step_dong: stride,
    min_discount_dong: 0,
    max_discount_dong: maximum,
    included_baseline_ids: baseline.strategies.map((strategy) => strategy.id),
    evaluated_discounts_sha256: hash([...amounts].sort((a, b) => a - b)),
    global_optimality_claimed: false,
  };
}
type Gold = ReturnType<typeof buildIndependentGold>;
function assessRanking(strategies: Strategy[], gold: Gold) {
  const ranked = distinctRanked(strategies);
  const best = ranked[0]?.score ?? null;
  return {
    strategies: ranked,
    top_ids: ranked.map((strategy) => strategy.id),
    best_score: best,
    ranking: rankAtK(
      ranked.map((strategy) => strategy.id),
      gold.qrels,
      5,
    ),
    top5_slot_coverage: ranked.length / 5,
    signed_gap_to_finite_gold: best === null ? null : best - gold.best_score,
    regret_to_finite_gold: best === null ? null : Math.max(0, gold.best_score - best),
    normalized_regret_to_finite_gold:
      best === null
        ? null
        : Math.max(0, gold.best_score - best) / Math.max(1, Math.abs(gold.best_score)),
  };
}

export function parseArguments(args: string[]) {
  const values: Record<string, string> = {};
  let live = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (flag === '--live') {
      live = true;
      continue;
    }
    if (
      !['--cases', '--repeats', '--max-calls', '--max-cost-usd', '--output'].includes(flag) ||
      !args[i + 1] ||
      args[i + 1]!.startsWith('--')
    )
      throw new Error(`Unknown/incomplete flag: ${flag}`);
    values[flag] = args[++i]!;
  }
  const repeats = Number(values['--repeats'] ?? 2);
  if (!Number.isSafeInteger(repeats) || repeats < 1 || repeats > 10)
    throw new Error('--repeats must be 1..10');
  if (live && (!values['--max-calls'] || !values['--max-cost-usd']))
    throw new Error('--live requires explicit --max-calls and --max-cost-usd');
  return {
    live,
    repeats,
    cases: values['--cases'] ?? 'data/eval/method-cases.v1.json',
    output: values['--output'] ?? '.local/method-comparison',
    maxCalls: Number(values['--max-calls']),
    maxCostUsd: Number(values['--max-cost-usd']),
  };
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const token = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

function captureFetch(fetchImpl: typeof fetch, env: NodeJS.ProcessEnv, live: boolean) {
  const captured = {
    attempts: 0,
    raw_text: null as string | null,
    raw_proposal: null as unknown,
    actual_model: null as string | null,
    request_id: null as string | null,
    input_tokens: null as number | null,
    output_tokens: null as number | null,
    estimated_cost_usd: live ? (null as number | null) : 0,
    response_status: null as string | null,
  };
  const wrapped: typeof fetch = async (url, options) => {
    const response = await fetchImpl(url, options);
    captured.attempts++;
    try {
      const data: unknown = await response.clone().json();
      if (record(data)) {
        captured.actual_model = typeof data.model === 'string' ? data.model : null;
        captured.request_id =
          response.headers.get('x-request-id') ?? (typeof data.id === 'string' ? data.id : null);
        captured.response_status = typeof data.status === 'string' ? data.status : null;
        const usage = record(data.usage) ? data.usage : {};
        captured.input_tokens = token(usage.input_tokens);
        captured.output_tokens = token(usage.output_tokens);
        if (live && captured.input_tokens !== null && captured.output_tokens !== null)
          captured.estimated_cost_usd =
            (captured.input_tokens * Number(env.OPENAI_INPUT_USD_PER_MILLION) +
              captured.output_tokens * Number(env.OPENAI_OUTPUT_USD_PER_MILLION)) /
            1e6;
        const content = (Array.isArray(data.output) ? data.output : []).flatMap((part: unknown) =>
          record(part) && Array.isArray(part.content) ? part.content : [],
        );
        captured.raw_text = content
          .flatMap((part: unknown) =>
            record(part) && part.type === 'output_text' && typeof part.text === 'string'
              ? [part.text]
              : [],
          )
          .join('');
        try {
          captured.raw_proposal = JSON.parse(captured.raw_text);
        } catch {
          /* Unknown/invalid output is retained. */
        }
      }
    } catch {
      /* Usage stays unknown, forcing live scheduling to stop. */
    }
    return response;
  };
  return { captured, fetch: wrapped };
}

const offlineFetch: typeof fetch = async (_url, options) => {
  const body = JSON.parse(String(options?.body));
  const payload = JSON.parse(body.input);
  const proposal =
    body.text.format.name === 'computed_strategy_explanation'
      ? {
          selected_strategy_id: payload.recommended_strategy_id,
          reason_codes: ['ranked_first', 'scenario_only'],
          claims: payload.required_claims,
          evidence_ids: [],
        }
      : { candidates: gridCandidates(payload.input) };
  return new Response(
    JSON.stringify({
      id: 'offline-fixture',
      status: 'completed',
      model: 'fixture-no-model',
      usage: { input_tokens: 0, output_tokens: 0 },
      output: [{ content: [{ type: 'output_text', text: JSON.stringify(proposal) }] }],
    }),
  );
};

async function durableJson(path: string, value: unknown) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flush: true });
  await rename(temporary, path);
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.live) {
    try {
      process.loadEnvFile('.env');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const dataset = JSON.parse(await readFile(resolve(options.cases), 'utf8')) as {
    version: string;
    scope: string;
    cases: TechnicalCase[];
  };
  if (
    !dataset.version ||
    !Array.isArray(dataset.cases) ||
    !dataset.cases.length ||
    new Set(dataset.cases.map((item) => item.id)).size !== dataset.cases.length
  )
    throw new Error('Invalid/empty/duplicate case dataset');
  for (const item of dataset.cases) {
    if (!/^[a-z0-9_-]+$/.test(item.id)) throw new Error('Case IDs must be safe lowercase slugs');
    parseRecommendationRequest({ input: item.input, context: item.context });
  }
  const env: NodeJS.ProcessEnv = options.live
    ? { ...process.env, OPENAI_MAX_RETRIES: '0' }
    : { OPENAI_API_KEY: 'fixture-only', OPENAI_MODEL: 'fixture-no-model', OPENAI_MAX_RETRIES: '0' };
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)
    throw new Error('OPENAI_API_KEY and OPENAI_MODEL required');
  const budget = options.live
    ? new LiveBudget({
        maxCalls: options.maxCalls,
        maxCostUsd: options.maxCostUsd,
        inputRate: Number(env.OPENAI_INPUT_USD_PER_MILLION),
        outputRate: Number(env.OPENAI_OUTPUT_USD_PER_MILLION),
      })
    : null;
  const started = new Date().toISOString();
  const output = resolve(
    options.output,
    `${started.replaceAll(':', '-')}-${options.live ? 'live' : 'offline'}`,
  );
  await mkdir(output, { recursive: true });
  const prepared: {
    item: TechnicalCase;
    gold: Gold;
    search: ReturnType<typeof searchVouchers>;
    evaluation: EvaluationResult;
    legacy: RetrievalResult;
    fixed: RetrievalResult;
    m1: ReturnType<typeof assessRanking>;
    baseline: ReturnType<typeof assessRanking>;
  }[] = [];
  for (const item of dataset.cases) {
    const gold = buildIndependentGold(item.input);
    const search = searchVouchers(item.input);
    const [legacy, fixed] = await Promise.all([
      retrieveLegacy(item.input, item.context, { limit: 5 }),
      retrieveEvidence(item.input, item.context, { limit: 5 }),
    ]);
    if (legacy.status === 'unavailable' || fixed.status === 'unavailable')
      throw new Error('Evidence pack unavailable');
    const evaluation: EvaluationResult = {
      ...evaluate(item.input),
      strategies: search.strategies,
      recommended: search.recommended,
    };
    const baseline = evaluate(item.input);
    prepared.push({
      item,
      gold,
      search,
      evaluation,
      legacy,
      fixed,
      m1: assessRanking(search.strategies, gold),
      baseline: assessRanking(baseline.strategies, gold),
    });
  }
  await durableJson(resolve(output, 'inputs.json'), {
    dataset,
    dataset_sha256: hash(dataset),
    prepared: prepared.map(({ item, gold, search, m1, baseline, legacy, fixed }) => ({
      case_id: item.id,
      input_sha256: hash(item.input),
      gold,
      search,
      m1,
      baseline,
      legacy,
      fixed,
    })),
  });
  type CandidateTask = {
    kind: 'candidate';
    caseIndex: number;
    repeat: number;
    arm: 'legacy' | 'fixed';
  };
  type ExplainTask = { kind: 'explanation'; caseIndex: number; repeat: 1 };
  const tasks: (CandidateTask | ExplainTask)[] = [];
  for (let repeat = 1; repeat <= options.repeats; repeat++) {
    for (let caseIndex = 0; caseIndex < prepared.length; caseIndex++) {
      const arms: ('legacy' | 'fixed')[] = repeat % 2 ? ['legacy', 'fixed'] : ['fixed', 'legacy'];
      for (const arm of arms) tasks.push({ kind: 'candidate', caseIndex, repeat, arm });
    }
  }
  for (let caseIndex = 0; caseIndex < prepared.length; caseIndex++)
    tasks.push({ kind: 'explanation', caseIndex, repeat: 1 });
  const rows: Record<string, unknown>[] = [];
  let cursor = 0;
  let stopReason: string | null = null;
  async function execute(task: CandidateTask | ExplainTask) {
    const entry = prepared[task.caseIndex]!;
    const { item } = entry;
    const evidence =
      task.kind === 'candidate' && task.arm === 'legacy' ? entry.legacy : entry.fixed;
    const transport = captureFetch(budget ? budget.wrap(fetch) : offlineFetch, env, options.live);
    let error: string | null = null;
    let explanation: Awaited<ReturnType<typeof explainStrategies>> | null = null;
    const payload = {
      input: item.input,
      context: item.context,
      historical_summary: summarizeContext(item.context),
      reference_evidence: evidence,
    };
    const began = performance.now();
    try {
      if (task.kind === 'candidate')
        await generateCandidates(payload, { env, fetchImpl: transport.fetch });
      else
        explanation = await explainStrategies(entry.evaluation, evidence, {
          env,
          fetchImpl: transport.fetch,
        });
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Unknown failure';
      stopReason ??= 'provider_failure_no_retry';
    }
    if (
      options.live &&
      (transport.captured.input_tokens === null || transport.captured.output_tokens === null)
    )
      stopReason ??= 'unknown_usage_no_further_calls';
    if (budget?.stopReason) stopReason ??= budget.stopReason;
    const raw = transport.captured.raw_proposal;
    const proposals: unknown[] = record(raw) && Array.isArray(raw.candidates) ? raw.candidates : [];
    const valid = proposals.filter(
      (candidate): candidate is Voucher =>
        Value.Check(VoucherSchema, candidate) &&
        candidate.seller_funding_bps === item.input.voucher.seller_funding_bps,
    );
    // Failed requests retain raw audit data but cannot earn candidate or hybrid improvement credit.
    const accepted = error ? [] : valid.slice(0, 5);
    const exactAI = accepted.map((candidate) => evaluateCandidate(item.input, candidate));
    const protocolValid = !error && Value.Check(CandidateProposalSchema, raw);
    const hybrid =
      task.kind === 'candidate' && task.arm === 'fixed'
        ? hybridSearchVouchers(item.input, accepted)
        : null;
    const row = {
      case_id: item.id,
      stratum: item.stratum ?? 'unclassified',
      objective: item.input.objective,
      repeat: task.repeat,
      method: task.kind === 'explanation' ? 'M3_explanation' : `M4_${task.arm}_retrieval_ai`,
      kind: task.kind,
      mode: options.live ? 'live_openai' : 'offline_fixture_only',
      input_sha256: hash(item.input),
      context_sha256: hash(item.context),
      prompt_version: task.kind === 'candidate' ? PROMPT_VERSION : EXPLANATION_PROMPT_VERSION,
      prompt_sha256: hash(task.kind === 'candidate' ? SYSTEM_PROMPT : EXPLANATION_PROMPT),
      payload_sha256: task.kind === 'candidate' ? hash(payload) : null,
      configured_model: env.OPENAI_MODEL,
      evidence,
      evidence_ids: evidence.items.map((card) => card.evidence_id),
      error,
      latency_ms: performance.now() - began,
      ...transport.captured,
      raw_protocol_valid:
        task.kind === 'candidate' ? protocolValid : (explanation?.assessment.schema_valid ?? false),
      candidate_count: task.kind === 'candidate' ? proposals.length : null,
      valid_candidate_count: task.kind === 'candidate' ? valid.length : null,
      funding_violation_count:
        task.kind === 'candidate'
          ? proposals.filter(
              (candidate) =>
                Value.Check(VoucherSchema, candidate) &&
                candidate.seller_funding_bps !== item.input.voucher.seller_funding_bps,
            ).length
          : null,
      sentinel_emitted:
        item.attack?.sentinel && transport.captured.raw_text !== null
          ? transport.captured.raw_text.includes(item.attack.sentinel)
          : null,
      ai_only: task.kind === 'candidate' ? assessRanking(exactAI, entry.gold) : null,
      m2_hybrid: hybrid
        ? {
            ...assessRanking(hybrid.strategies, entry.gold),
            search_only_score: hybrid.search_only_score,
            accepted_ai_candidates: accepted.length,
            ai_failed_search_fallback: Boolean(error),
            method_version: hybrid.hybrid_method_version,
          }
        : null,
      explanation,
    };
    await durableJson(
      resolve(
        output,
        `run-${item.id}-${task.repeat}-${task.kind === 'candidate' ? task.arm : 'explanation'}.json`,
      ),
      row,
    );
    rows.push(row);
    console.log(
      JSON.stringify({
        completed: rows.length,
        planned: tasks.length,
        case_id: item.id,
        method: row.method,
        error,
        estimated_cost_usd: row.estimated_cost_usd,
        stop_reason: stopReason,
      }),
    );
  }
  async function worker() {
    while (!stopReason && !budget?.stopReason) {
      const task = tasks[cursor++];
      if (!task) return;
      await execute(task);
    }
  }
  await Promise.all([worker(), worker()]);
  const perCase = prepared.map((entry) => {
    const caseRows = rows.filter((row) => row.case_id === entry.item.id);
    const pairs = [];
    for (let repeat = 1; repeat <= options.repeats; repeat++) {
      const legacy = caseRows.find(
        (row) => row.repeat === repeat && row.method === 'M4_legacy_retrieval_ai',
      );
      const fixed = caseRows.find(
        (row) => row.repeat === repeat && row.method === 'M4_fixed_retrieval_ai',
      );
      const comparable = Boolean(
        legacy &&
        fixed &&
        !legacy.error &&
        !fixed.error &&
        legacy.actual_model &&
        legacy.actual_model === fixed.actual_model &&
        legacy.input_sha256 === fixed.input_sha256 &&
        legacy.prompt_sha256 === fixed.prompt_sha256 &&
        legacy.context_sha256 === fixed.context_sha256,
      );
      const previous = legacy?.ai_only as ReturnType<typeof assessRanking> | undefined;
      const current = fixed?.ai_only as ReturnType<typeof assessRanking> | undefined;
      pairs.push({
        repeat,
        comparable,
        fixed_minus_legacy_best_score:
          comparable &&
          previous?.best_score !== null &&
          previous?.best_score !== undefined &&
          current?.best_score !== null &&
          current?.best_score !== undefined
            ? current.best_score - previous.best_score
            : null,
        legacy_ids: previous?.top_ids ?? [],
        fixed_ids: current?.top_ids ?? [],
      });
    }
    return {
      case_id: entry.item.id,
      objective: entry.item.input.objective,
      stratum: entry.item.stratum ?? 'unclassified',
      baseline: entry.baseline,
      M1_search: entry.m1,
      M2_hybrid: caseRows
        .filter((row) => row.method === 'M4_fixed_retrieval_ai')
        .map((row) => ({ repeat: row.repeat, result: row.m2_hybrid })),
      M3_explanation: caseRows.find((row) => row.method === 'M3_explanation')?.explanation ?? null,
      M4_retrieval_pairs: pairs,
      M5_merchant_pilot: {
        status: 'missing_merchant_data',
        causal_uplift: null,
        forecast_calibration: null,
      },
    };
  });
  const report = {
    version: 'method-comparison.v1',
    started_at: started,
    completed_at: new Date().toISOString(),
    mode: options.live ? 'live_openai' : 'offline_fixture_only',
    dataset_version: dataset.version,
    dataset_sha256: hash(dataset),
    configured_model: env.OPENAI_MODEL,
    repeats: options.repeats,
    independent_case_count: prepared.length,
    planned_provider_calls: tasks.length,
    completed_rows: rows.length,
    complete: rows.length === tasks.length && !stopReason && !budget?.stopReason,
    stop_reason: stopReason ?? budget?.stopReason ?? null,
    concurrency: 2,
    billing: budget
      ? {
          limits: budget.limits,
          provider_calls: budget.calls,
          accounted_estimated_cost_usd: budget.accountedCostUsd,
          observed_estimated_cost_usd: budget.observedCostUsd,
        }
      : { provider_calls: 0, observed_estimated_cost_usd: 0 },
    metric_definitions: {
      gold: 'Independent uniform 100-VND payout lattice plus baseline/current/measured and maximum; coarser for large baskets to stay within10000evaluations. Not search visitation points or a global optimum.',
      relevance:
        'Binary membership of finite-gold top5 exact economic IDs; ties resolved by score, smallerdiscount, thenID. Exact-ID misses can coexist with equal or betterutility.',
      ndcg: 'Binary top5 gold membership, not graded profitability or ordering preference between relevant IDs.',
      coverage:
        'Distinct strategy slots filled /5, separate from recall of the five exact gold IDs.',
      regret:
        'max(0, finite gold bestscore - methodbestscore); signedgap retained because methods may beat finite gold.',
      failed_calls:
        'Failures retained; no retry. Rawvalid candidates on a failed transport earn no credit. Hybrid falls back to search explicitly.',
      explanation:
        'Exact structured financialfacts and IDmembership only; no free-prose or semanticcitation grounding claimed.',
      case_clusters:
        'Repeats and legacy/fixed arms share merchant cases; they are not independent cases. Do not pool raw scores across objectives.',
    },
    limitations: [
      'Synthetic merchant inputs and response curves do not establish calibrated demand, optimal real-world profit or causal uplift.',
      'Offline fixture generates the same candidate grid for both retrieval arms; only validates orchestration.',
      'Raw response/schema/funding counts are reported separately from deterministic economic scores and search fallback.',
      'Two calls may already be in flight when a shared stop condition occurs; no new jobs are scheduled after it.',
      'Cost is estimated using supplied rates and token usage, not an invoice cap. M5 requires actual pilot exposure/outcome data.',
    ],
    cases: perCase,
    runs: rows,
  };
  await durableJson(resolve(output, 'report.json'), report);
  console.log(
    JSON.stringify({
      report: resolve(output, 'report.json'),
      complete: report.complete,
      completed_rows: rows.length,
      planned: tasks.length,
      stop_reason: report.stop_reason,
    }),
  );
  if (!report.complete) process.exitCode = 2;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Method comparison failed');
    process.exitCode = 1;
  });
