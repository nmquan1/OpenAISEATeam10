import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  parseRecommendationRequest,
  parseRecommendationResult,
  type EvaluationInput,
  type RecommendationRequest,
} from '../contracts/model.ts';
import type { EvidenceCard, RetrievalResult } from '../contracts/evidence.ts';
import { evaluate } from '../backend/src/engine/index.ts';
import { recommend } from '../backend/src/agent/recommend.ts';
import { retrieveEvidence } from '../backend/src/evidence/retrieve.ts';
import { PROMPT_VERSION } from '../backend/src/agent/prompt.ts';
import { LiveBudget, BudgetStop } from './evaluation/budget.ts';
import {
  hash,
  quantile,
  gridCandidates,
  gridScore,
  constraintViolations,
  newWinner,
  csvValue,
} from './evaluation/metrics.ts';

export interface EvidenceCase {
  id: string;
  description: string;
  input: EvaluationInput;
  context: RecommendationRequest['context'];
  expected: {
    status: 'matched' | 'no_match';
    source: EvidenceCard['source_dataset'] | null;
    kinds: EvidenceCard['kind'][];
    label_terms: string[];
    allowed_inferences: string[];
    forbidden_inferences: string[];
  };
}
export function retrievalAssessment(result: RetrievalResult, expected: EvidenceCase['expected']) {
  const relevant = (card: EvidenceCard) =>
    card.source_dataset === expected.source &&
    expected.kinds.includes(card.kind) &&
    (!expected.label_terms.length ||
      expected.label_terms.some((term) => card.label.toLowerCase().includes(term.toLowerCase())));
  return {
    status_matches: result.status === expected.status,
    family_precision: result.items.length
      ? result.items.filter(relevant).length / result.items.length
      : null,
    family_hit: result.items.some(relevant),
    negative_control_pass:
      expected.status === 'no_match'
        ? result.status === 'no_match' && result.items.length === 0
        : null,
  };
}
export function parseArguments(args: string[]) {
  const values: Record<string, string> = {};
  let live = false;
  const flags = new Set([
    '--cases',
    '--repeats',
    '--output',
    '--max-calls',
    '--max-cost-usd',
    '--case',
  ]);
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]!;
    if (flag === '--live') {
      live = true;
      continue;
    }
    if (!flags.has(flag) || !args[index + 1] || args[index + 1]!.startsWith('--'))
      throw new Error(`Unknown or incomplete flag: ${flag}`);
    values[flag] = args[++index]!;
  }
  const repeats = Number(values['--repeats'] ?? 3);
  if (!Number.isSafeInteger(repeats) || repeats < 1 || repeats > 10)
    throw new Error('--repeats must be 1..10');
  if (live && (!values['--max-calls'] || !values['--max-cost-usd']))
    throw new Error('--live requires explicit --max-calls and --max-cost-usd');
  return {
    live,
    repeats,
    cases: values['--cases'] ?? 'data/eval/evidence-cases.v1.json',
    output: values['--output'] ?? '.local/evidence-eval',
    caseId: values['--case'],
    maxCalls: Number(values['--max-calls']),
    maxCostUsd: Number(values['--max-cost-usd']),
  };
}
interface RunRow {
  case_id: string;
  repeat: number;
  mode: 'without_reference' | 'with_reference';
  provider_mode: 'live_openai' | 'fixture_no_provider';
  valid: boolean;
  error: string | null;
  latency_ms: number;
  input_sha256: string;
  evidence_sha256: string;
  evidence_ids: string[];
  dataset_version: string | null;
  index_sha256: string | null;
  retrieval_version: string;
  retrieval_status: string;
  retrieval: ReturnType<typeof retrievalAssessment>;
  model: string | null;
  prompt_version: string;
  request_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  provider_attempts: number | null;
  baseline_score: number;
  grid5_score: number;
  dense_grid_score: number;
  candidate_score: number | null;
  gap_to_dense_grid: number | null;
  sampled_grid_regret_score: number | null;
  baseline_preserved: boolean | null;
  new_ai_winner: boolean | null;
  selected_strategy_id: string | null;
  rejected_candidates: number | null;
  constraint_violations: string[];
  citation_correctness: null;
  unsupported_inference_rate: null;
  evidence_effect_claim: string;
}
export function evaluationComplete(expected: number, actual: number, stopReason: string | null) {
  return actual === expected && stopReason === null;
}
export function pairedSummary(
  rows: Pick<
    RunRow,
    | 'case_id'
    | 'repeat'
    | 'mode'
    | 'valid'
    | 'input_sha256'
    | 'model'
    | 'prompt_version'
    | 'candidate_score'
  >[],
) {
  const pairs: number[] = [];
  let excludedMismatchedPairs = 0;
  for (const withReference of rows.filter(
    (row) => row.mode === 'with_reference' && row.valid && row.candidate_score !== null,
  )) {
    const withoutReference = rows.find(
      (row) =>
        row.mode === 'without_reference' &&
        row.case_id === withReference.case_id &&
        row.repeat === withReference.repeat &&
        row.valid &&
        row.candidate_score !== null,
    );
    if (!withoutReference) continue;
    if (
      withoutReference.input_sha256 !== withReference.input_sha256 ||
      withoutReference.model !== withReference.model ||
      withoutReference.prompt_version !== withReference.prompt_version
    ) {
      excludedMismatchedPairs++;
      continue;
    }
    pairs.push(withReference.candidate_score! - withoutReference.candidate_score!);
  }
  return {
    valid_paired_repetitions: pairs.length,
    excluded_input_model_or_prompt_mismatch: excludedMismatchedPairs,
    mean_score_delta_with_minus_without: pairs.length
      ? pairs.reduce((sum, value) => sum + value, 0) / pairs.length
      : null,
    improved_fraction: pairs.length
      ? pairs.filter((value) => value > 0).length / pairs.length
      : null,
    tied_fraction: pairs.length ? pairs.filter((value) => value === 0).length / pairs.length : null,
    worse_fraction: pairs.length ? pairs.filter((value) => value < 0).length / pairs.length : null,
    interpretation:
      'Paired scenario-score comparison; stochastic model variation and synthetic cases do not establish causal business lift.',
  };
}
function summarize(rows: RunRow[]) {
  return (['without_reference', 'with_reference'] as const).map((mode) => {
    const group = rows.filter((row) => row.mode === mode);
    const successful = group.filter((row) => row.valid);
    const scoreGroups = [...new Set(group.map((row) => row.case_id))].map((id) =>
      successful.filter((row) => row.case_id === id),
    );
    const paired = scoreGroups.filter((items) => items.length > 1);
    return {
      mode,
      attempts: group.length,
      valid_rate: group.length ? successful.length / group.length : null,
      constraint_violation_count: group.reduce(
        (sum, row) => sum + row.constraint_violations.length,
        0,
      ),
      new_ai_winner_rate: successful.length
        ? successful.filter((row) => row.new_ai_winner).length / successful.length
        : null,
      mean_gap_to_dense_grid: successful.length
        ? successful.reduce((sum, row) => sum + row.gap_to_dense_grid!, 0) / successful.length
        : null,
      latency_p50_ms: quantile(
        group.map((row) => row.latency_ms),
        0.5,
      ),
      latency_p95_ms: quantile(
        group.map((row) => row.latency_ms),
        0.95,
      ),
      estimated_cost_usd:
        group.length && group.every((row) => row.estimated_cost_usd !== null)
          ? group.reduce((sum, row) => sum + row.estimated_cost_usd!, 0)
          : null,
      repeated_case_count: paired.length,
      mean_score_range: paired.length
        ? paired.reduce(
            (sum, items) =>
              sum +
              Math.max(...items.map((row) => row.candidate_score!)) -
              Math.min(...items.map((row) => row.candidate_score!)),
            0,
          ) / paired.length
        : null,
      same_winner_across_repeats_rate: paired.length
        ? paired.filter((items) => new Set(items.map((row) => row.selected_strategy_id)).size === 1)
            .length / paired.length
        : null,
      citation_correctness: null,
    };
  });
}
export async function main(args = process.argv.slice(2)) {
  try {
    process.loadEnvFile('.env');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const options = parseArguments(args);
  const raw = JSON.parse(await readFile(resolve(options.cases), 'utf8')) as {
    version: string;
    scope: string;
    cases: EvidenceCase[];
  };
  if (!raw.version || !Array.isArray(raw.cases) || !raw.cases.length)
    throw new Error('Invalid evaluation dataset');
  const seen = new Set<string>();
  for (const item of raw.cases) {
    if (!item.id || seen.has(item.id) || !item.expected || !Array.isArray(item.expected.kinds))
      throw new Error('Invalid or duplicate evaluation case');
    seen.add(item.id);
    parseRecommendationRequest({ input: item.input, context: item.context });
  }
  const cases = options.caseId ? raw.cases.filter((item) => item.id === options.caseId) : raw.cases;
  if (!cases.length) throw new Error('Unknown --case');
  let budget: LiveBudget | null = null;
  if (options.live) {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)
      throw new Error('Live run requires server OPENAI_API_KEY and OPENAI_MODEL');
    budget = new LiveBudget({
      maxCalls: options.maxCalls,
      maxCostUsd: options.maxCostUsd,
      inputRate: Number(process.env.OPENAI_INPUT_USD_PER_MILLION),
      outputRate: Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION),
    });
  }
  const providerEnv = options.live
    ? { ...process.env, OPENAI_MAX_RETRIES: '0' }
    : {
        OPENAI_API_KEY: 'offline-fixture',
        OPENAI_MODEL: 'fixture-voucher-generator',
        OPENAI_MAX_RETRIES: '0',
        OPENAI_INPUT_USD_PER_MILLION: '0',
        OPENAI_OUTPUT_USD_PER_MILLION: '0',
      };
  const rows: RunRow[] = [];
  const started = new Date().toISOString();
  const output = resolve(
    options.output,
    started.replaceAll(':', '-').replaceAll('.', '-') + (options.live ? '-live' : '-offline'),
  );
  await mkdir(output, { recursive: true });
  let stopReason: string | null = null;
  const save = async () => {
    const report = {
      report_version: 'evidence-benchmark.v1',
      dataset_version: raw.version,
      cases_sha256: hash(raw),
      started_at: started,
      provider_mode: options.live ? 'live_openai' : 'fixture_no_provider',
      configured_model: providerEnv.OPENAI_MODEL,
      repeats: options.repeats,
      planned_provider_calls: cases.length * options.repeats * 2,
      completed_attempts: rows.length,
      complete: evaluationComplete(cases.length * options.repeats * 2, rows.length, stopReason),
      stop_reason: stopReason,
      billing: budget
        ? {
            limits: budget.limits,
            provider_calls: budget.calls,
            accounted_estimated_cost_usd: budget.accountedCostUsd,
            observed_estimated_cost_usd: budget.observedCostUsd,
            stop_reason: budget.stopReason,
          }
        : { provider_calls: 0, estimated_cost_usd: 0 },
      summary: summarize(rows),
      paired_evidence_comparison: pairedSummary(rows),
      cases,
      runs: rows,
      limitations: [
        'Offline fixture mode validates plumbing/retrieval/constraints only; fixture candidates deliberately ignore evidence and do not measure an LLM.',
        'Live comparisons keep merchant inputs, configured model and five-candidate maximum fixed. Candidate counts may be lower after generation, validation and economic deduplication.',
        'Grid5 is a five-proposal baseline; dense grid is a finite reference over rate/cap/minimum/fixed discount, not a proof of global optimum.',
        'All scores are deterministic scenario economics, not measured causal sales lift or merchant profit.',
        'Retrieval precision uses manually labeled source/kind/label families; it is not exhaustive relevance recall or model citation correctness.',
        'Voucher-only provider output has no citations or factual prose; citation correctness and unsupported inference rate are null and require a separate human assessment of explanations.',
        'Supplied evidence IDs prove what was sent, not what caused the model to choose a voucher.',
        'Live CLI bypasses HTTP quota and persistence; explicit call and estimated-cost guards are enforced here. Pricing is user supplied and the estimate is not a billing invoice ceiling.',
      ],
    };
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    const columns = Object.keys(rows[0] ?? {});
    const csv = [
      columns.map(csvValue).join(','),
      ...rows.map((row) => columns.map((key) => csvValue(row[key as keyof RunRow])).join(',')),
    ].join('\n');
    await writeFile(resolve(output, 'runs.csv'), csv + '\n');
  };
  outer: for (const item of cases) {
    const baseline = evaluate(item.input);
    const grid5 = gridScore(item.input);
    const dense = gridScore(item.input, true);
    for (let repeat = 1; repeat <= options.repeats; repeat++) {
      // Alternate order across repetitions so a live provider's temporal variation is less confounded with treatment order.
      const modes =
        repeat % 2
          ? (['without_reference', 'with_reference'] as const)
          : (['with_reference', 'without_reference'] as const);
      for (const mode of modes) {
        if (budget && (budget.stopReason || budget.calls >= budget.limits.maxCalls)) {
          stopReason = budget.stopReason ?? 'max_calls_reached';
          break outer;
        }
        const { reference_query: _query, ...baseContext } = item.context;
        const context = mode === 'with_reference' ? item.context : baseContext;
        const evidence = await retrieveEvidence(item.input, context);
        if (mode === 'with_reference' && evidence.status === 'unavailable')
          throw new Error('Evidence index unavailable; fix package before benchmarking');
        const row: RunRow = {
          case_id: item.id,
          repeat,
          mode,
          provider_mode: options.live ? 'live_openai' : 'fixture_no_provider',
          valid: false,
          error: null,
          latency_ms: 0,
          input_sha256: hash(item.input),
          evidence_sha256: hash(evidence),
          evidence_ids: evidence.items.map((card) => card.evidence_id),
          dataset_version: evidence.dataset_version,
          index_sha256: evidence.index_sha256,
          retrieval_version: evidence.retrieval_version,
          retrieval_status: evidence.status,
          retrieval:
            mode === 'with_reference'
              ? retrievalAssessment(evidence, item.expected)
              : {
                  status_matches: evidence.status === 'disabled',
                  family_precision: null,
                  family_hit: false,
                  negative_control_pass: null,
                },
          model: null,
          prompt_version: PROMPT_VERSION,
          request_id: null,
          input_tokens: null,
          output_tokens: null,
          estimated_cost_usd: null,
          provider_attempts: null,
          baseline_score: baseline.recommended.score,
          grid5_score: grid5,
          dense_grid_score: dense,
          candidate_score: null,
          gap_to_dense_grid: null,
          sampled_grid_regret_score: null,
          baseline_preserved: null,
          new_ai_winner: null,
          selected_strategy_id: null,
          rejected_candidates: null,
          constraint_violations: [],
          citation_correctness: null,
          unsupported_inference_rate: null,
          evidence_effect_claim:
            'Not inferred from supplied context; compare repeated outcomes and review separately.',
        };
        const start = performance.now();
        try {
          const fixture: typeof fetch = async () =>
            new Response(
              JSON.stringify({
                id: `fixture:${item.id}:${repeat}:${mode}`,
                status: 'completed',
                model: 'fixture-voucher-generator',
                usage: { input_tokens: 0, output_tokens: 0 },
                output: [
                  {
                    content: [
                      {
                        type: 'output_text',
                        text: JSON.stringify({ candidates: gridCandidates(item.input) }),
                      },
                    ],
                  },
                ],
              }),
            );
          const result = parseRecommendationResult(
            await recommend(
              { input: item.input, context },
              { env: providerEnv, fetchImpl: budget ? budget.wrap() : fixture },
            ),
          );
          row.valid = true;
          row.constraint_violations = constraintViolations(item.input, result);
          row.model = result.model;
          row.prompt_version = result.prompt_version;
          row.request_id = result.provider_request_id;
          row.input_tokens = result.usage.input_tokens;
          row.output_tokens = result.usage.output_tokens;
          row.estimated_cost_usd = result.estimated_cost_usd;
          row.provider_attempts = result.provider_attempts ?? null;
          row.candidate_score = result.recommended.score;
          row.gap_to_dense_grid = dense - row.candidate_score;
          row.sampled_grid_regret_score = Math.max(0, row.gap_to_dense_grid);
          row.baseline_preserved = row.candidate_score >= baseline.recommended.score;
          row.new_ai_winner = newWinner(baseline, result);
          row.selected_strategy_id = result.recommended.id;
          row.rejected_candidates = result.rejected_candidates;
          if (hash(result.reference_evidence) !== hash(evidence))
            row.constraint_violations.push('retrieval_context_does_not_match_service_result');
        } catch (error) {
          row.error = error instanceof Error ? error.message : 'Unknown evaluation error';
          if (error instanceof BudgetStop) stopReason = error.message;
        }
        row.latency_ms = Math.round((performance.now() - start) * 100) / 100;
        rows.push(row);
        if (budget?.stopReason) stopReason = budget.stopReason;
        await save();
        if (stopReason) break outer;
      }
    }
  }
  await save();
  console.table(summarize(rows));
  console.log(
    `${options.live ? 'Live model' : 'OFFLINE FIXTURE — not an AI quality benchmark'} report: ${output}`,
  );
  if (stopReason) console.log(`Stopped: ${stopReason}`);
  if (
    rows.some(
      (row) =>
        !row.valid ||
        row.constraint_violations.length ||
        row.baseline_preserved === false ||
        (row.mode === 'with_reference' &&
          (!row.retrieval.status_matches ||
            row.retrieval.negative_control_pass === false ||
            (row.retrieval_status === 'matched' && row.retrieval.family_precision !== 1))),
    )
  )
    process.exitCode = 1;
  if (!evaluationComplete(cases.length * options.repeats * 2, rows.length, stopReason))
    process.exitCode = 2;
  return { rows, output, stopReason };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
