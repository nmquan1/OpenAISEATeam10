import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseRecommendationRequest,
  type EvaluationInput,
  type RecommendationRequest,
} from '../contracts/model.ts';
import { generateCandidates } from '../backend/src/agent/openai.ts';
import { summarizeContext } from '../backend/src/agent/context.ts';
import { PROMPT_VERSION, SYSTEM_PROMPT } from '../backend/src/agent/prompt.ts';
import { retrieveEvidence } from '../backend/src/evidence/retrieve.ts';
import { LiveBudget } from './evaluation/budget.ts';
import { hash, csvValue, gridCandidates } from './evaluation/metrics.ts';
import {
  assessProposal,
  references,
  comparison,
  distribution,
} from './evaluation/technical-metrics.ts';

export interface TechnicalCase {
  id: string;
  description: string;
  stratum?: 'quality' | 'safety_control' | 'adversarial';
  input: EvaluationInput;
  context: RecommendationRequest['context'];
  attack?: { target: 'funding_override' | 'schema_override' | 'sentinel'; sentinel?: string };
}
export function parseArguments(args: string[]) {
  const values: Record<string, string> = {};
  let live = false;
  const allowed = ['--cases', '--repeats', '--output', '--max-calls', '--max-cost-usd'];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (flag === '--live') {
      live = true;
      continue;
    }
    if (!allowed.includes(flag) || !args[i + 1] || args[i + 1]!.startsWith('--'))
      throw new Error(`Unknown/incomplete flag: ${flag}`);
    values[flag] = args[++i]!;
  }
  const repeats = Number(values['--repeats'] ?? 3);
  if (!Number.isSafeInteger(repeats) || repeats < 1 || repeats > 10)
    throw new Error('--repeats must be 1..10');
  if (live && (!values['--max-calls'] || !values['--max-cost-usd']))
    throw new Error('--live requires explicit --max-calls and --max-cost-usd');
  return {
    live,
    repeats,
    cases: values['--cases'] ?? 'data/eval/technical-cases.v1.json',
    output: values['--output'] ?? '.local/technical-eval',
    maxCalls: Number(values['--max-calls']),
    maxCostUsd: Number(values['--max-cost-usd']),
  };
}
export function fixtureFetch(candidates: unknown): typeof fetch {
  return async () =>
    new Response(
      JSON.stringify({
        id: 'offline-fixture',
        status: 'completed',
        model: 'fixture-no-model',
        usage: { input_tokens: 0, output_tokens: 0 },
        output: [{ content: [{ type: 'output_text', text: JSON.stringify(candidates) }] }],
      }),
    );
}
type Mode = 'without_reference' | 'with_reference';
type Row = Awaited<ReturnType<typeof runCase>>;
export async function runCase(
  item: TechnicalCase,
  repeat: number,
  mode: Mode,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
  live: boolean,
) {
  const reference = references(item.input);
  const { reference_query: _query, ...withoutQuery } = item.context;
  const retrievalContext = mode === 'with_reference' ? item.context : withoutQuery;
  const context = item.context;
  const evidence = await retrieveEvidence(item.input, retrievalContext);
  const payload = {
    input: item.input,
    context,
    historical_summary: summarizeContext(context),
    reference_evidence: evidence,
  };
  let rawProposal: unknown = null;
  let rawText: string | null = null;
  let actualModel: string | null = null;
  let requestId: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let cost: number | null = live ? null : 0;
  let error: string | null = null;
  let attempts = 0;
  const capture: typeof fetch = async (url, options) => {
    attempts++;
    const response = await fetchImpl(url, options);
    try {
      const data = await response.clone().json();
      actualModel = typeof data.model === 'string' ? data.model : null;
      requestId =
        response.headers.get('x-request-id') ?? (typeof data.id === 'string' ? data.id : null);
      const token = (value: unknown): number | null =>
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
      inputTokens = token(data.usage?.input_tokens);
      outputTokens = token(data.usage?.output_tokens);
      if (live && inputTokens !== null && outputTokens !== null)
        cost =
          (inputTokens * Number(env.OPENAI_INPUT_USD_PER_MILLION) +
            outputTokens * Number(env.OPENAI_OUTPUT_USD_PER_MILLION)) /
          1e6;
      const output = Array.isArray(data.output) ? data.output : [];
      rawText = output
        .flatMap((part: { content?: { type?: string; text?: string }[] }) =>
          Array.isArray(part.content) ? part.content : [],
        )
        .filter(
          (part: { type?: string; text?: string }) =>
            part.type === 'output_text' && typeof part.text === 'string',
        )
        .map((part: { text: string }) => part.text)
        .join('');
      try {
        rawProposal = JSON.parse(rawText!);
      } catch {
        /* Invalid JSON remains a failed first attempt. */
      }
    } catch {
      /* Preserve unknown usage and invalid transport, never substitute zero. */
    }
    return response;
  };
  const start = performance.now();
  try {
    if (evidence.status === 'unavailable') throw new Error('Evidence index unavailable');
    await generateCandidates(payload, { env, fetchImpl: capture });
  } catch (failure) {
    error = failure instanceof Error ? failure.message : 'Unknown provider error';
  }
  const assessed = assessProposal(item.input, rawProposal);
  return {
    case_id: item.id,
    objective: item.input.objective,
    stratum: item.stratum ?? 'unclassified',
    repeat,
    mode,
    provider_mode: live ? 'live_openai' : 'offline_fixture_only',
    error,
    pass_at_1: !error && assessed.pass_at_1,
    attack: item.attack ?? null,
    sentinel_emitted: item.attack?.sentinel
      ? ((rawText as string | null)?.includes(item.attack.sentinel) ?? false)
      : null,
    latency_ms: performance.now() - start,
    attempts,
    configured_model: env.OPENAI_MODEL,
    actual_model: actualModel,
    configured_model_sha256: hash(env.OPENAI_MODEL),
    actual_model_sha256: actualModel === null ? null : hash(actualModel),
    request_id: requestId,
    prompt_version: PROMPT_VERSION,
    prompt_sha256: hash(SYSTEM_PROMPT),
    input_sha256: hash(item.input),
    payload_sha256: hash(payload),
    evidence_sha256: hash(evidence),
    evidence_ids: evidence.items.map((card) => card.evidence_id),
    evidence,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: cost,
    raw_text: rawText,
    raw_proposal: rawProposal,
    assessment: assessed,
    reference,
    ...comparison(error ? assessProposal(item.input, null) : assessed, reference),
    citation_correctness: null,
    citation_status: 'not_available_voucher_only_output',
  };
}
export function summarize(rows: Row[]) {
  const valid = rows.filter((row) => row.pass_at_1);
  const repeats = [...new Set(rows.map((row) => row.case_id))].map((id) =>
    rows.filter((row) => row.case_id === id),
  );
  const candidateCount = rows.reduce((sum, row) => sum + row.assessment.candidate_count, 0);
  const outcomes = (key: 'vs_baseline' | 'vs_grid5') =>
    Object.fromEntries(
      ['win', 'tie', 'loss', 'unscored'].map((outcome) => [
        outcome,
        rows.filter((row) => (row[key] ?? 'unscored') === outcome).length,
      ]),
    );
  return {
    attempts: rows.length,
    pass_at_1: rows.length ? valid.length / rows.length : null,
    provider_errors: rows.filter((row) => row.error).length,
    raw_candidate_validity: candidateCount
      ? rows.reduce((sum, row) => sum + row.assessment.schema_valid_count, 0) / candidateCount
      : null,
    funding_violations: rows.reduce((sum, row) => sum + row.assessment.funding_violations, 0),
    constraint_violations: rows.reduce(
      (sum, row) =>
        sum +
        row.assessment.candidates.reduce(
          (count, candidate) => count + (candidate.scored?.constraint_violations.length ?? 0),
          0,
        ),
      0,
    ),
    distinct_economic_rate: distribution(rows.map((row) => row.assessment.distinct_economic_rate)),
    normalized_regret: distribution(rows.map((row) => row.normalized_regret)),
    vs_baseline: outcomes('vs_baseline'),
    vs_grid5: outcomes('vs_grid5'),
    genuine_new_winners: rows.filter((row) => row.genuine_new_winner).length,
    latency_ms: distribution(rows.map((row) => row.latency_ms)),
    input_tokens: distribution(rows.map((row) => row.input_tokens)),
    output_tokens: distribution(rows.map((row) => row.output_tokens)),
    cost_usd: distribution(rows.map((row) => row.estimated_cost_usd)),
    total_cost_usd: rows.every((row) => row.estimated_cost_usd !== null)
      ? rows.reduce((sum, row) => sum + row.estimated_cost_usd!, 0)
      : null,
    repeated_cases: repeats.map((group) => ({
      case_id: group[0]!.case_id,
      attempted: group.length,
      scored: group.filter((row) => row.best_ai_score !== null).length,
      top_candidate_stable:
        group.length > 1 && group.every((row) => row.top_candidate_id !== null)
          ? new Set(group.map((row) => row.top_candidate_id)).size === 1
          : null,
      score_distribution: distribution(group.map((row) => row.best_ai_score)),
    })),
  };
}
export function pairedComparison(rows: Row[]) {
  const pairs = rows
    .filter((row) => row.mode === 'with_reference')
    .flatMap((withRef) => {
      const without = rows.find(
        (row) =>
          row.mode === 'without_reference' &&
          row.case_id === withRef.case_id &&
          row.repeat === withRef.repeat,
      );
      if (
        !without ||
        !withRef.pass_at_1 ||
        !without.pass_at_1 ||
        withRef.best_ai_score === null ||
        without.best_ai_score === null ||
        !withRef.actual_model ||
        withRef.actual_model !== without.actual_model ||
        withRef.input_sha256 !== without.input_sha256 ||
        withRef.prompt_sha256 !== without.prompt_sha256
      )
        return [];
      return [
        {
          case_id: withRef.case_id,
          repeat: withRef.repeat,
          normalized_delta:
            (withRef.best_ai_score - without.best_ai_score) / withRef.reference.normalization_scale,
        },
      ];
    });
  return {
    pairs,
    eligible_pairs: pairs.length,
    normalized_delta: distribution(pairs.map((pair) => pair.normalized_delta)),
  };
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
    cases: TechnicalCase[];
  };
  if (!dataset.version || !Array.isArray(dataset.cases) || !dataset.cases.length)
    throw new Error('Invalid dataset');
  const seen = new Set<string>();
  for (const item of dataset.cases) {
    if (!item.id || seen.has(item.id)) throw new Error('Missing/duplicate case ID');
    seen.add(item.id);
    parseRecommendationRequest({ input: item.input, context: item.context });
  }
  const budget = options.live
    ? new LiveBudget({
        maxCalls: options.maxCalls,
        maxCostUsd: options.maxCostUsd,
        inputRate: Number(process.env.OPENAI_INPUT_USD_PER_MILLION),
        outputRate: Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION),
      })
    : null;
  if (options.live && (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL))
    throw new Error('Live run requires OPENAI_API_KEY and OPENAI_MODEL');
  const env = options.live
    ? { ...process.env, OPENAI_MAX_RETRIES: '0' }
    : {
        OPENAI_API_KEY: 'offline',
        OPENAI_MODEL: 'fixture-no-model',
        OPENAI_MAX_RETRIES: '0',
        OPENAI_INPUT_USD_PER_MILLION: '0',
        OPENAI_OUTPUT_USD_PER_MILLION: '0',
      };
  const guardedFetch = budget?.wrap();
  const jobs = Array.from({ length: options.repeats }, (_, repeat) =>
    dataset.cases.flatMap((item, index) =>
      ((repeat + index) % 2
        ? ['with_reference', 'without_reference']
        : ['without_reference', 'with_reference']
      ).map((mode) => ({ item, repeat: repeat + 1, mode: mode as Mode })),
    ),
  ).flat();
  const rows: Row[] = [];
  let cursor = 0;
  let stopReason: string | null = null;
  const started = new Date().toISOString();
  const output = resolve(
    options.output,
    started.replaceAll(':', '-').replaceAll('.', '-') + (options.live ? '-live' : '-offline'),
  );
  await mkdir(output, { recursive: true });
  async function worker() {
    while (cursor < jobs.length && !stopReason && !budget?.stopReason) {
      const job = jobs[cursor++]!;
      const row = await runCase(
        job.item,
        job.repeat,
        job.mode,
        env,
        guardedFetch ?? fixtureFetch({ candidates: gridCandidates(job.item.input) }),
        options.live,
      );
      rows.push(row);
      await writeFile(
        resolve(
          output,
          `run-${job.item.id.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}-${job.repeat}-${job.mode}.json`,
        ),
        JSON.stringify(row, null, 2),
      );
      if (options.live && row.error) stopReason = 'provider_error_stop';
      if (budget?.stopReason) stopReason = budget.stopReason;
    }
  }
  await Promise.all([worker(), worker()]);
  rows.sort(
    (a, b) =>
      a.case_id.localeCompare(b.case_id) || a.repeat - b.repeat || a.mode.localeCompare(b.mode),
  );
  const modes: Mode[] = ['without_reference', 'with_reference'];
  const report = {
    report_version: 'technical-candidate-eval.v1',
    dataset_version: dataset.version,
    dataset_sha256: hash(dataset),
    started_at: started,
    provider_mode: options.live ? 'live_openai' : 'offline_fixture_only',
    treatment: 'evidence-envelope-only, query held constant',
    planned_runs: jobs.length,
    completed_runs: rows.length,
    complete: rows.length === jobs.length && !stopReason,
    stop_reason: stopReason,
    concurrency: 2,
    retries: 0,
    billing: budget
      ? {
          limits: budget.limits,
          calls: budget.calls,
          accounted_estimate_usd: budget.accountedCostUsd,
          observed_estimate_usd: budget.observedCostUsd,
          stop_reason: budget.stopReason,
        }
      : { calls: 0, cost_usd: 0 },
    summary: modes.map((mode) => ({ mode, ...summarize(rows.filter((row) => row.mode === mode)) })),
    by_stratum: [...new Set(rows.map((row) => row.stratum))].map((stratum) => ({
      stratum,
      modes: modes.map((mode) => ({
        mode,
        ...summarize(rows.filter((row) => row.stratum === stratum && row.mode === mode)),
      })),
    })),
    by_case: dataset.cases.map((item) => ({
      case_id: item.id,
      modes: modes.map((mode) => ({
        mode,
        ...summarize(rows.filter((row) => row.case_id === item.id && row.mode === mode)),
      })),
    })),
    paired: pairedComparison(rows),
    cases: dataset.cases,
    runs: rows,
    limitations: [
      'Offline fixture is pipeline-only, not model quality evidence.',
      'Twelve case clusters with repeated calls are not 72 independent merchant observations. No significance or causal lift claims. Review quality, safety-control, and adversarial strata separately.',
      'Finite dense grid is a reference, not a global optimum; includes explicit zero discount.',
      'Normalization divides score differences by max(1, abs(dense score), abs(no-discount score)); pooled objectives remain scenario scores, not causal lift.',
      'Candidate-only scores never credit a retained baseline; production scores are reported separately.',
      'Supplied evidence does not prove model usage; voucher-only output has no measurable citation correctness.',
      'Unknown cost is null; guarded reservations estimate configured prices, not invoice guarantees. On stop up to two already-started calls may finish.',
      'Invalid schema candidates are recorded individually; strict Pass@1 requires the entire response schema. Partial valid candidates can still be scored but are excluded from paired strict-pass comparisons.',
    ],
  };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const columns = Object.keys(rows[0] ?? {}) as (keyof Row)[];
  await writeFile(
    resolve(output, 'runs.csv'),
    [
      columns.map(csvValue).join(','),
      ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(',')),
    ].join('\n') + '\n',
  );
  console.log(
    JSON.stringify(
      {
        output,
        complete: report.complete,
        planned_runs: jobs.length,
        completed_runs: rows.length,
        stop_reason: stopReason,
        summary: report.summary,
        paired: report.paired,
      },
      null,
      2,
    ),
  );
  if (!report.complete) process.exitCode = 2;
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Evaluation failed');
    process.exitCode = 1;
  });
