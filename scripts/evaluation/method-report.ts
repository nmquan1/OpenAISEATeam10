import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rankAtK } from './rank-metrics.ts';
import { quantile } from './metrics.ts';
type Ranking = ReturnType<typeof rankAtK>;
interface Assessment {
  strategies: { discount_dong: number }[];
  best_score: number | null;
  ranking: Ranking;
  signed_gap_to_finite_gold: number | null;
  regret_to_finite_gold: number | null;
  top5_slot_coverage: number;
}
interface Explanation {
  accepted: boolean;
  assessment: {
    numerical_claim_accuracy: number | null;
    correct_claim_count: number;
    claim_count: number;
    required_claim_coverage: number | null;
    citation_count: number;
    valid_citation_count: number;
    evidence_citation_validity: number | null;
    free_prose_groundedness: null;
    citation_semantic_support: null;
  };
}
interface Run {
  case_id: string;
  repeat: number;
  method: string;
  kind: string;
  error: string | null;
  actual_model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  latency_ms: number;
  ai_only: Assessment | null;
  m2_hybrid: Assessment | null;
  explanation: Explanation | null;
  raw_protocol_valid: boolean;
}
interface Case {
  case_id: string;
  objective: string;
  stratum: string;
  M1_search: Assessment;
  baseline: Assessment;
  M2_hybrid: { repeat: number; result: Assessment | null }[];
  M3_explanation: Explanation | null;
  M4_retrieval_pairs: {
    repeat: number;
    comparable: boolean;
    fixed_minus_legacy_best_score: number | null;
  }[];
}
interface Report {
  complete: boolean;
  mode: string;
  completed_rows: number;
  planned_provider_calls: number;
  started_at: string;
  dataset_sha256: string;
  dataset_version: string;
  independent_case_count: number;
  repeats: number;
  cases: Case[];
  runs: Run[];
  billing: { observed_estimated_cost_usd: number };
}
interface Retrieval {
  summary: {
    method: string;
    positive_queries: number;
    negative_controls: number;
    negatives_passed: number;
    precision_at_5: number;
    precision_at_returned: number;
    recall_at_5: number;
    ndcg_at_5: number;
    mrr_at_5: number;
    recall_ceiling_at_5: number;
  }[];
  rows: {
    query_id: string;
    method: string;
    precision_at_returned: number | null;
    labels: string[];
  }[];
  cases_sha256: string;
  index_sha256: string;
}
interface Inputs {
  prepared: {
    case_id: string;
    search: {
      elapsed_ms: number;
      evaluation_count: number;
      exhaustive_integer_search: boolean;
      budget_exhausted: boolean;
      method_version: string;
    };
    gold: { evaluation_count: number; step_dong: number; version: string };
  }[];
}
const mean = (values: (number | null)[]) => {
  const known = values.filter((x): x is number => x !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
};
const fmt = (value: number | null, digits = 4) => (value === null ? 'N/A' : value.toFixed(digits));
const pct = (value: number | null) => (value === null ? 'N/A' : `${(value * 100).toFixed(2)}%`);
function rankings(values: Assessment[]) {
  return {
    count: values.length,
    precision: mean(values.map((x) => x.ranking.precision_at_k)),
    recall: mean(values.map((x) => x.ranking.recall_at_k)),
    ndcg: mean(values.map((x) => x.ranking.ndcg_at_k)),
    mrr: mean(values.map((x) => x.ranking.reciprocal_rank)),
    slot_coverage: mean(values.map((x) => x.top5_slot_coverage)),
    positive_regret: values.filter(
      (x) => x.regret_to_finite_gold !== null && x.regret_to_finite_gold > 0,
    ).length,
    better_than_finite_gold: values.filter(
      (x) => x.signed_gap_to_finite_gold !== null && x.signed_gap_to_finite_gold > 0,
    ).length,
  };
}
function usage(rows: Run[]) {
  const sum = (field: 'input_tokens' | 'output_tokens' | 'estimated_cost_usd') =>
    rows.every((x) => x[field] !== null) ? rows.reduce((total, x) => total + x[field]!, 0) : null;
  return {
    calls: rows.length,
    errors: rows.filter((x) => x.error).length,
    protocol_pass: rows.filter((x) => x.raw_protocol_valid).length,
    models: [...new Set(rows.map((x) => x.actual_model))],
    input_tokens: sum('input_tokens'),
    output_tokens: sum('output_tokens'),
    cost_usd: sum('estimated_cost_usd'),
    latency_p50_ms: quantile(
      rows.map((x) => x.latency_ms),
      0.5,
    ),
    latency_p95_ms: quantile(
      rows.map((x) => x.latency_ms),
      0.95,
    ),
  };
}
export function buildMethodReport(report: Report, retrieval: Retrieval, inputs: Inputs) {
  const methods = ['M4_legacy_retrieval_ai', 'M4_fixed_retrieval_ai', 'M3_explanation'];
  const provider = methods.map((method) => ({
    method,
    ...usage(report.runs.filter((row) => row.method === method)),
  }));
  const ranking = [
    { method: 'M1 search', ...rankings(report.cases.map((c) => c.M1_search)) },
    {
      method: 'M2 hybrid',
      ...rankings(report.runs.flatMap((r) => (r.m2_hybrid ? [r.m2_hybrid] : []))),
    },
    ...methods.slice(0, 2).map((method) => ({
      method,
      ...rankings(
        report.runs
          .filter((r) => r.method === method)
          .flatMap((r) => (r.ai_only ? [r.ai_only] : [])),
      ),
    })),
  ];
  const pairs = report.cases.flatMap((c) =>
    c.M4_retrieval_pairs.filter(
      (p) => p.comparable && p.fixed_minus_legacy_best_score !== null,
    ).map((p) => ({
      case_id: c.case_id,
      objective: c.objective,
      repeat: p.repeat,
      delta: p.fixed_minus_legacy_best_score!,
      legacy_and_fixed_only: true,
    })),
  );
  const hybrid = report.cases.flatMap((c) =>
    c.M2_hybrid.filter(
      (h) =>
        h.result?.best_score !== null &&
        h.result?.best_score !== undefined &&
        c.M1_search.best_score !== null,
    ).map((h) => ({
      case_id: c.case_id,
      repeat: h.repeat,
      delta: h.result!.best_score! - c.M1_search.best_score!,
    })),
  );
  const outcomes = (rows: { delta: number }[]) => ({
    wins: rows.filter((r) => r.delta > 0).length,
    ties: rows.filter((r) => r.delta === 0).length,
    losses: rows.filter((r) => r.delta < 0).length,
  });
  const explanations = report.runs.flatMap((r) => (r.explanation ? [r.explanation] : []));
  const explanation = {
    calls: report.runs.filter((r) => r.kind === 'explanation').length,
    accepted: explanations.filter((e) => e.accepted).length,
    claims: explanations.reduce((n, e) => n + e.assessment.claim_count, 0),
    correct_claims: explanations.reduce((n, e) => n + e.assessment.correct_claim_count, 0),
    required_claim_coverage: mean(explanations.map((e) => e.assessment.required_claim_coverage)),
    citations: explanations.reduce((n, e) => n + e.assessment.citation_count, 0),
    valid_citations: explanations.reduce((n, e) => n + e.assessment.valid_citation_count, 0),
    semantic_groundedness: null,
    reader_comprehension: null,
  };
  const searchTimes = inputs.prepared.map((c) => c.search.elapsed_ms);
  const summary = {
    complete: report.complete,
    dataset_sha256: report.dataset_sha256,
    provider,
    ranking,
    hybrid_vs_search: { ...outcomes(hybrid), pairs: hybrid },
    retrieval_ai_pairs: { ...outcomes(pairs), pairs },
    explanation,
    retrieval: retrieval.summary,
    search_cpu: {
      samples: searchTimes.length,
      p50_ms: quantile(searchTimes, 0.5),
      p95_ms: quantile(searchTimes, 0.95),
      exhaustive_cases: inputs.prepared.filter((c) => c.search.exhaustive_integer_search).length,
      budget_exhausted_cases: inputs.prepared.filter((c) => c.search.budget_exhausted).length,
    },
    merchant_pilot: {
      implementation: 'pipeline_and_analyzer_with_4_synthetic_tests',
      status: 'missing_merchant_data',
      causal_uplift: null,
    },
    total_cost_usd: report.billing.observed_estimated_cost_usd,
  };
  const lines = [
    '# So sánh 5 phương án tối ưu Market Maker',
    '',
    `Run hoàn tất ${report.completed_rows}/${report.planned_provider_calls} calls; ${report.independent_case_count} case tổng hợp mới × ${report.repeats} lần cho hai nhánh candidate, cộng 8 lượt explanation. Model: ${[...new Set(report.runs.map((r) => r.actual_model))].join(', ')}. Tổng chi phí ước tính $${fmt(summary.total_cost_usd, 6)}.`,
    '',
    `**Hybrid so search: ${summary.hybrid_vs_search.wins} thắng / ${summary.hybrid_vs_search.ties} hòa / ${summary.hybrid_vs_search.losses} thua.** Thêm candidate AI chưa cải thiện điểm chiến lược tốt nhất trên bộ này. Kết quả không chứng minh search tối ưu toàn cục hoặc sẽ thắng trên mọi shop.`,
    '',
    '| Phương án | Đã thử gì | Kết quả và giới hạn |',
    '| --- | --- | --- |',
    '| M1 · Search deterministic | Search theo engine, giữ baseline; không API model | Xem điểm, regret và CPU dưới đây; không có dữ liệu causal để gọi là forecast |',
    `| M2 · Search + candidate AI | Dùng chung 16 request nhánh retrieval v2, thêm candidate vào search | ${summary.hybrid_vs_search.wins}/${hybrid.length} cải thiện best score so M1; không cộng lại chi phí 16 calls này vào tổng |`,
    `| M3 · Search + AI explanation | 8 request riêng, structured facts đã được engine tính | ${explanation.accepted}/${explanation.calls} accepted; ${explanation.correct_claims}/${explanation.claims} claim số đúng; chưa đo dễ hiểu hoặc prose groundedness |`,
    `| M4 · Retrieval v1/v2 + AI | 13 query retrieval giữ riêng; 16 cặp candidate cùng input/context/prompt/model | Candidate best score: ${summary.retrieval_ai_pairs.wins} tăng / ${summary.retrieval_ai_pairs.ties} hòa / ${summary.retrieval_ai_pairs.losses} giảm; precision retrieval tăng không tự thành utility tăng |`,
    '| M5 · Merchant pilot/uplift | Đã có pipeline/analyzer và 4 test tổng hợp | Chưa có outcome merchant thật; causal uplift/forecast calibration = N/A |',
    '',
    '## Ranking và regret cần đọc cùng nhau',
    '',
    '| Method | Số lượt/case | P@5 | Recall@5 | nDCG@5 | MRR@5 | Slot coverage | Regret > 0 | Vượt finite gold |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...ranking.map(
      (r) =>
        `| ${r.method} | ${r.count} | ${fmt(r.precision)} | ${fmt(r.recall)} | ${fmt(r.ndcg)} | ${fmt(r.mrr)} | ${pct(r.slot_coverage)} | ${r.positive_regret} | ${r.better_than_finite_gold} |`,
    ),
    '',
    'Gold là top 5 economic ID trên payout lattice độc lập (bước 100đ hoặc thưa hơn để giữ ≤10.000 phép tính), có baseline/current/measured. Relevance là **membership ID chính xác**, binary; nDCG này không chấm thứ tự lợi nhuận giữa các ID relevant. Search có thể tìm payout ngoài lattice tốt hơn: Recall/nDCG = 0 vẫn có thể đi kèm regret = 0 và signed gap dương. Không diễn giải exact-ID recall như tỷ lệ tìm được phương án tốt, và không dùng regret clipped = 0 để tuyên bố tối ưu.',
    '',
    '| Case / objective | M1 best score | Gap M1 − gold | Recall@5 M1 | Hybrid − M1 qua hai lần | V2 AI − v1 AI qua hai lần |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.cases.map(
      (c) =>
        `| ${c.case_id} / ${c.objective} | ${c.M1_search.best_score} | ${c.M1_search.signed_gap_to_finite_gold} | ${fmt(c.M1_search.ranking.recall_at_k)} | ${hybrid
          .filter((p) => p.case_id === c.case_id)
          .map((p) => p.delta)
          .join(', ')} | ${pairs
          .filter((p) => p.case_id === c.case_id)
          .map((p) => p.delta)
          .join(', ')} |`,
    ),
    '',
    'Raw score theo objective của từng case; không cộng revenue và profit thành một số tiền. Các ca zero-budget/zero-conversion có nhiều phương án hòa; exact-ID tie-break có thể thay recall mà không thay utility.',
    '',
    ...pairs
      .filter((pair) => pair.delta !== 0)
      .map((pair) => {
        const legacy = report.runs.find(
          (row) =>
            row.case_id === pair.case_id &&
            row.repeat === pair.repeat &&
            row.method === 'M4_legacy_retrieval_ai',
        );
        const fixed = report.runs.find(
          (row) =>
            row.case_id === pair.case_id &&
            row.repeat === pair.repeat &&
            row.method === 'M4_fixed_retrieval_ai',
        );
        return `- ${pair.case_id}, lần ${pair.repeat}: candidate đứng đầu chuyển giảm ${legacy?.ai_only?.strategies[0]?.discount_dong}đ → ${fixed?.ai_only?.strategies[0]?.discount_dong}đ; điểm ${legacy?.ai_only?.best_score} → ${fixed?.ai_only?.best_score} (${pair.delta > 0 ? '+' : ''}${pair.delta}).`;
      }),
    '',
    'Đây là nguyên nhân trực tiếp trong phép tính engine: candidate tốt nhất đổi effective discount, dẫn đến điểm khác dưới cùng input. Chưa chứng minh reference gây ra lựa chọn đó; model vẫn có biến động. Hybrid giữ được phương án search tốt hơn nên các chênh lệch candidate này không đổi best score cuối.',

    '',
    '## Retrieval holdout sau freeze',
    '',
    '| Retriever | P@5 | Precision thực trả | R@5 | Trần R@5 | nDCG@5 | MRR@5 | Negative pass |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...retrieval.summary.map(
      (r) =>
        `| ${r.method} | ${fmt(r.precision_at_5)} | ${fmt(r.precision_at_returned)} | ${fmt(r.recall_at_5)} | ${fmt(r.recall_ceiling_at_5)} | ${fmt(r.ndcg_at_5)} | ${fmt(r.mrr_at_5)} | ${r.negatives_passed}/${r.negative_controls} |`,
    ),
    '',
    'Bộ 13 query do parent tạo sau khi v2 freeze; implementer không xem trước, nhưng chưa phải external blind audit hay mẫu traffic đại diện. Có 10 positive và 3 negative; trần recall bị K=5/96 geometry records chi phối, cùng giới hạn context 15k ký tự. V2 sửa kind/entity precision và thứ tự, không tăng relevant-count nên P@5/R@5 giữ nguyên.',
    '',
    ...retrieval.rows
      .filter(
        (r) =>
          r.method === 'revised' && r.precision_at_returned !== null && r.precision_at_returned < 1,
      )
      .map(
        (r) =>
          `- Lỗi còn lại ${r.query_id}: precision thực trả ${pct(r.precision_at_returned)}; ${r.labels.join(' · ')}.`,
      ),
    '',
    'Hai query tự nhiên về “thông tin” chưa được hiểu như intent profile, nên v2 vẫn trả association theo sau profile. Đây là chẩn đoán sau holdout, **không retune v2 trong run này**; lần sửa tiếp theo cần holdout mới.',
    '',
    '## Chi phí, token và latency',
    '',
    '| Nhánh provider | Calls | Model thực | Pass protocol | Token input/output | USD ước tính | p50/p95 ms |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...provider.map(
      (r) =>
        `| ${r.method} | ${r.calls} | ${r.models.join(', ')} | ${r.protocol_pass}/${r.calls} | ${r.input_tokens}/${r.output_tokens} | ${fmt(r.cost_usd, 6)} | ${fmt(r.latency_p50_ms, 0)} / ${fmt(r.latency_p95_ms, 0)} |`,
    ),
    '',
    `M1 local CPU: ${summary.search_cpu.samples} lần preparation, p50 ${fmt(summary.search_cpu.p50_ms, 3)} ms, p95 ${fmt(summary.search_cpu.p95_ms, 3)} ms; exhaustive integer ${summary.search_cpu.exhaustive_cases}/8, budget exhausted ${summary.search_cpu.budget_exhausted_cases}/8. Đây là timing local không phải E2E hoặc benchmark tải.`,
    'M2 dùng lại request M4_fixed, không phát sinh lượt provider thứ hai. Latency provider row gồm capture/assessment và có thể gồm hybrid search; chưa gồm UI/network đến backend hoặc bước chuẩn bị retrieval/gold. Đơn giá cấu hình dùng để ước tính, không phải hóa đơn.',
    '',
    '## Explanation và bằng chứng còn thiếu',
    '',
    `M3 accepted ${explanation.accepted}/${explanation.calls}; số đúng ${explanation.correct_claims}/${explanation.claims}; required claim coverage ${pct(explanation.required_claim_coverage)}; evidence citations ${explanation.citations}, valid-ID citations ${explanation.valid_citations}.`,
    'Provider nhận sẵn required facts; output structured được kiểm rồi render bằng template. Kết quả này đo sao chép/chọn fact đúng contract, không chứng minh viết giải thích tự do, reasoning sâu hoặc citation semantic support. Với 0 citation, citation accuracy là N/A, không phải 100%. Cần so với template không AI và đo người dùng hiểu/chọn nhanh hơn trước khi trả thêm phí.',
    '',
    'M5 đã triển khai pipeline/analyzer với 4 synthetic tests; đây là kiểm tra code, không phải hiệu quả chiến dịch. Vẫn cần pilot merchant: assignment treatment/control, exposure, voucher/funding, giỏ hàng, stock, hủy/hoàn và profit thực; chưa có nên causal uplift/forecast calibration = N/A.',
    '',
    '## Nguyên nhân và quyết định sau phép thử',
    '',
    '- Retrieval v2 giảm nhiễu lexical nhưng reference vẫn không có elasticity hay causal response của merchant; không đủ cơ sở quy mọi thay đổi score cho chất lượng retrieval.',
    '- LLM one-shot chưa nhận score feedback từ engine; hybrid thêm proposal vào search rộng không giúp best score ở 16 lượt hiện tại. Search đã bao phủ phương án tốt hơn nhiều candidate, nhưng cần xem signed gap và tie case trước khi kết luận.',
    '- Những cặp v2 thua v1 và cặp thắng được giữ nguyên trong bảng; không loại case control để tạo báo cáo đẹp. Hai lần lặp chỉ mô tả biến động ban đầu.',
    '- Giữ search làm lựa chọn mặc định cần thử nghiệm sản phẩm; giữ AI là tùy chọn nếu có ích cho người dùng. Chưa có lý do thực nghiệm để đổi model hay thêm vector DB trong lượt này.',
    '- Bộ mới có 8 case tổng hợp khác bộ 12 case/72 call trước; không so tỷ lệ thắng/cost của hai run như controlled A/B. M4 ở run mới là v1-v2 cùng có reference, không phải có-vs-không reference như run trước.',
    '',
    `Provenance: ${report.dataset_version}, SHA256 ${report.dataset_sha256}; retrieval qrels ${retrieval.cases_sha256}; index ${retrieval.index_sha256}.`,
    'Đọc thêm [root causes](optimization-root-causes.md) và [run 72 calls trước](ai-evaluation-results.md).',
    '',
  ];
  return { summary, markdown: lines.join('\n') };
}
async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string, fallback: string) => {
    const i = args.indexOf(name);
    return i < 0 ? fallback : args[i + 1]!;
  };
  const dir = arg('--directory', '.local/method-comparison/2026-10-31T08-47-59.621Z-live');
  const output = arg('--output', 'docs/five-method-comparison.md');
  const report = JSON.parse(await readFile(`${dir}/report.json`, 'utf8')) as Report;
  if (
    !report.complete ||
    report.mode !== 'live_openai' ||
    report.completed_rows !== report.planned_provider_calls
  )
    throw Error('Refuse final publication of incomplete or fixture results');
  const retrieval = JSON.parse(
    await readFile(arg('--retrieval', '.local/methods-retrieval/report.json'), 'utf8'),
  ) as Retrieval;
  const inputs = JSON.parse(await readFile(`${dir}/inputs.json`, 'utf8')) as Inputs;
  const result = buildMethodReport(report, retrieval, inputs);
  const diversityPath = arg('--diversity', '.local/diversity-posthoc/report.json');
  let diversity: {
    status: string;
    provider_calls: number;
    threshold: string;
    cases: {
      case_id: string;
      best_preserved: boolean;
      minimum_distance_dong: number;
      original_discounts: number[];
      diverse_offers: { discount_dong: number; score_difference_from_best: number }[];
    }[];
  } | null = null;
  try {
    diversity = JSON.parse(await readFile(diversityPath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (diversity) {
    result.markdown +=
      '\n## Thử hậu nghiệm: đa dạng mức giảm khi trình bày\n\n' +
      `Trạng thái **${diversity.status}**; ${diversity.provider_calls} provider calls. Đây là phân tích sau khi xem kết quả, chưa xác nhận trên holdout mới và chưa bật mặc định trong app. Không sửa ranking metric hoặc raw comparison đã freeze.\n\n` +
      `Chọn các offer cách nhau ít nhất ${diversity.threshold}; giữ winner ${diversity.cases.filter((c) => c.best_preserved).length}/${diversity.cases.length} case. Đổi mức giảm để so sánh rõ hơn có thể làm score các offer phụ thấp hơn; không phải tăng chất lượng tối ưu.\n\n` +
      '| Case | Top 5 cũ (đ) | Offer giãn cách (đ) | Ngưỡng (đ) | Giữ winner |\n| --- | --- | --- | --- | --- |\n' +
      diversity.cases
        .map(
          (c) =>
            `| ${c.case_id} | ${c.original_discounts.join(', ')} | ${c.diverse_offers.map((o) => o.discount_dong).join(', ')} | ${c.minimum_distance_dong} | ${c.best_preserved} |`,
        )
        .join('\n') +
      '\n\nGiãn cách giảm giá không tự bảo đảm các phương án đáng chọn hoặc có lời; cần hiển thị chênh lệch score và lọc theo mục tiêu merchant trước khi đưa vào workflow.\n';
  }
  await writeFile(output, result.markdown);
  await writeFile(
    output.replace(/\.md$/, '.summary.json'),
    JSON.stringify({ ...result.summary, diversity_posthoc: diversity }, null, 2) + '\n',
  );
  console.log(JSON.stringify({ output, calls: report.completed_rows }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
