# Method 3: deterministic search → constrained AI explanation

Prototype riêng, chưa gắn vào API/UI. Search/engine chọn chiến lược; AI chỉ chọn các điểm cần trình bày từ kết quả đã tính. AI **không** thêm voucher, đổi thứ hạng hoặc tự viết đoạn giải thích tài chính.

## Contract và kiểm tra

`contracts/explanation.ts` định nghĩa output strict:

```json
{
  "selected_strategy_id": "ID đã tính và đang đứng đầu",
  "reason_codes": ["ranked_first", "scenario_only"],
  "claims": [
    { "strategy_id": "ID đã tính", "scenario": "base", "metric": "profit_dong", "value": 123 }
  ],
  "evidence_ids": []
}
```

Ví dụ trên chỉ minh họa shape; ID và số `123` phải thay bằng giá trị engine thực tế. `evidence_ids` luôn có mặt nhưng được để trống. Không có field prose/summary do model sinh.

- Selected ID phải là `result.recommended.id`; các ID khác trong claims phải có trong tập đã tính.
- Mỗi claim phải khớp chính xác số nguyên của đúng strategy/scenario/metric. Các metric cho phép: `profit_dong`, `revenue_dong`, `spend_dong`, `orders`, `redeemed`.
- Bắt buộc có lợi nhuận cơ sở, doanh thu cơ sở và lợi nhuận ở kịch bản thấp nhất của winner. Khi cơ sở cũng là thấp nhất, fact trùng được gộp. “Thấp nhất” tính theo lợi nhuận, không mặc định traffic thấp.
- `ranked_first` và `scenario_only` là bắt buộc; các reason như `no_voucher`, `loss_risk`, `stock_limited`, `funding_or_quota_limited` chỉ hợp lệ nếu engine có tình trạng tương ứng. Không cho reason hoặc claim trùng để tăng giả coverage.
- Citation ID phải tồn tại trong reference được cung cấp. **Đây là validity của ID, chưa phải kiểm chứng relevance hoặc semantic support.** Không claim tác động nhân quả từ reference.
- Sai bất kỳ điều kiện nào → `accepted:false`, `explanation:null`; giữ raw output, assessment và usage để đánh giá, không âm thầm sửa số hoặc render phần sai.

Renderer dựng `summary`, `facts`, `caveats` bằng template tiếng Việt từ dữ liệu đã kiểm tra. Summary nêu mục tiêu xếp hạng, mức giảm và giới hạn “trong tập đã tính”; caveat luôn nói rõ mô phỏng. Không có prose tự do để kiểm chứng groundedness, nên metric đó là `null`, không được báo 100%.

## Gọi prototype

```ts
import { explainStrategies } from '../backend/src/agent/explain.ts';

const answer = await explainStrategies(computedEvaluationResult, retrievedEvidence, {
  env: process.env,
  fetchImpl: budget.wrap(fetch),
  signal: controller.signal,
});
if (answer.accepted) console.log(answer.explanation);
```

`computedEvaluationResult` phải là kết quả engine đáng tin cậy do server tính; kiểm tra shape không chứng minh nguồn gốc một JSON client gửi lên. Prototype không tiếp nhận seller notes hoặc lịch sử thô; chỉ gửi objective, kết quả computed, required facts, allowed reason codes và metadata reference ngắn. Không mở thêm surface cho instruction từ ghi chú merchant.

Dùng `OPENAI_API_KEY`/`OPENAI_MODEL` hiện tại; không đổi model mặc định. `OPENAI_EXPLANATION_MAX_OUTPUT_TOKENS` mặc định 2.048, hợp lệ 256–4.096; timeout dùng `OPENAI_TIMEOUT_MS` (1–120 giây). Mỗi lần đúng một request, không retry. CLI live phải truyền fetch có budget reservation; module không tự quản lý hạn mức toàn ứng dụng. Chi phí ước tính chỉ có khi token usage và đơn giá cấu hình đều biết; thiếu thì `null`. Không tự gọi thêm để sửa response sai.

Responses request dùng `text.format` với `json_schema`/`strict:true`; vẫn xử lý refusal/incomplete và kiểm tra nghiệp vụ sau parse, vì schema không chứng minh số liệu đúng. Tham khảo [OpenAI Docs: Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Đánh giá

- `numerical_claim_accuracy`: claim đúng chính xác / toàn bộ claim, kể cả claim dẫn tới ID không tồn tại.
- `strategy_reference_validity`: ID tồn tại / tất cả lần tham chiếu selected ID và claim ID; điều kiện “winner không bị đổi” được kiểm tra riêng.
- `evidence_citation_validity`: citation ID có trong context / toàn bộ citation; không citation → `null`, không phải 1.
- `required_claim_coverage`: required facts đúng được trình bày / required facts, gộp fact trùng.
- `evidence_card_coverage`: số ID reference hợp lệ khác nhau được chọn / số card được cung cấp; không có card → `null`. Coverage thấp không tự động là lỗi: không bắt AI cite mọi card.
- `citation_semantic_support` và `free_prose_groundedness`: `null`; chưa đo hoặc không áp dụng với thiết kế không prose.

Kết quả schema sai không có metric số chính xác đáng tin, trả `null` và coverage 0. Transport/refusal/incomplete là failure/unknown riêng, không biến thành câu trả lời đúng. Khi tổng hợp, giữ số accepted/rejected/unknown và mẫu số cho từng metric; không chỉ lấy response đã được validator cho qua.

Chạy fixture offline, không gọi provider:

```sh
npx tsx --test backend/test/explanation.test.ts
```

Tests kiểm tra sai 1 đồng, ID giả, reason không có bằng chứng, đổi winner, thiếu facts, prose/metric ngoài schema, citation giả, reservation từ chối và hủy request. Chưa có kết quả live hoặc bằng chứng người dùng hiểu quyết định tốt hơn. So sánh tiếp với cùng template chọn facts hoàn toàn bằng code; LLM chỉ đáng giữ nếu tăng ích lợi sử dụng đủ để bù latency/chi phí. Xem thêm [decision flow](demo-and-decision-flow.md) và [evidence evaluation](evidence-evaluation.md).
