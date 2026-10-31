# So sánh 5 phương án tối ưu Market Maker

Run hoàn tất 40/40 calls; 8 case tổng hợp mới × 2 lần cho hai nhánh candidate, cộng 8 lượt explanation. Model: gpt-6-astra. Tổng chi phí ước tính $1.989390.

**Hybrid so search: 0 thắng / 16 hòa / 0 thua.** Thêm candidate AI chưa cải thiện điểm chiến lược tốt nhất trên bộ này. Kết quả không chứng minh search tối ưu toàn cục hoặc sẽ thắng trên mọi shop.

| Phương án                    | Đã thử gì                                                                      | Kết quả và giới hạn                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| M1 · Search deterministic    | Search theo engine, giữ baseline; không API model                              | Xem điểm, regret và CPU dưới đây; không có dữ liệu causal để gọi là forecast                         |
| M2 · Search + candidate AI   | Dùng chung 16 request nhánh retrieval v2, thêm candidate vào search            | 0/16 cải thiện best score so M1; không cộng lại chi phí 16 calls này vào tổng                        |
| M3 · Search + AI explanation | 8 request riêng, structured facts đã được engine tính                          | 8/8 accepted; 28/28 claim số đúng; chưa đo dễ hiểu hoặc prose groundedness                           |
| M4 · Retrieval v1/v2 + AI    | 13 query retrieval giữ riêng; 16 cặp candidate cùng input/context/prompt/model | Candidate best score: 1 tăng / 12 hòa / 3 giảm; precision retrieval tăng không tự thành utility tăng |
| M5 · Merchant pilot/uplift   | Đã có pipeline/analyzer và 4 test tổng hợp                                     | Chưa có outcome merchant thật; causal uplift/forecast calibration = N/A                              |

## Ranking và regret cần đọc cùng nhau

| Method                 | Số lượt/case | P@5    | Recall@5 | nDCG@5 | MRR@5  | Slot coverage | Regret > 0 | Vượt finite gold |
| ---------------------- | ------------ | ------ | -------- | ------ | ------ | ------------- | ---------- | ---------------- |
| M1 search              | 8            | 0.1000 | 0.1000   | 0.1696 | 0.5000 | 100.00%       | 0          | 4                |
| M2 hybrid              | 16           | 0.1000 | 0.1000   | 0.1696 | 0.5000 | 100.00%       | 0          | 8                |
| M4_legacy_retrieval_ai | 16           | 0.0500 | 0.0500   | 0.0848 | 0.2500 | 82.50%        | 12         | 0                |
| M4_fixed_retrieval_ai  | 16           | 0.0500 | 0.0500   | 0.0848 | 0.2500 | 81.25%        | 12         | 0                |

Gold là top 5 economic ID trên payout lattice độc lập (bước 100đ hoặc thưa hơn để giữ ≤10.000 phép tính), có baseline/current/measured. Relevance là **membership ID chính xác**, binary; nDCG này không chấm thứ tự lợi nhuận giữa các ID relevant. Search có thể tìm payout ngoài lattice tốt hơn: Recall/nDCG = 0 vẫn có thể đi kèm regret = 0 và signed gap dương. Không diễn giải exact-ID recall như tỷ lệ tìm được phương án tốt, và không dùng regret clipped = 0 để tuyên bố tối ưu.

| Case / objective                   | M1 best score | Gap M1 − gold | Recall@5 M1 | Hybrid − M1 qua hai lần | V2 AI − v1 AI qua hai lần |
| ---------------------------------- | ------------- | ------------- | ----------- | ----------------------- | ------------------------- |
| response-headroom / balanced       | 3978400       | 4061          | 0.0000      | 0, 0                    | 0, 0                      |
| thin-margin-safe / safe            | 284000        | 0             | 0.2000      | 0, 0                    | -17200, -17200            |
| minimum-upsell-unmodeled / growth  | 16101904      | 2704          | 0.0000      | 0, 0                    | 82400, 0                  |
| stock-saturated / balanced         | 2334009       | 1910          | 0.0000      | 0, 0                    | 0, 0                      |
| grocery-subsidized / growth        | 18135600      | 2100          | 0.0000      | 0, 0                    | 0, 0                      |
| zero-budget-control / safe         | 3386160       | 0             | 0.2000      | 0, 0                    | 0, 0                      |
| zero-conversion-control / balanced | 0             | 0             | 0.2000      | 0, 0                    | 0, 0                      |
| returns-sensitive / balanced       | -1809135      | 0             | 0.2000      | 0, 0                    | 0, -71318                 |

Raw score theo objective của từng case; không cộng revenue và profit thành một số tiền. Các ca zero-budget/zero-conversion có nhiều phương án hòa; exact-ID tie-break có thể thay recall mà không thay utility.

- thin-margin-safe, lần 1: candidate đứng đầu chuyển giảm 1000đ → 2000đ; điểm 266800 → 249600 (-17200).
- thin-margin-safe, lần 2: candidate đứng đầu chuyển giảm 1000đ → 2000đ; điểm 266800 → 249600 (-17200).
- minimum-upsell-unmodeled, lần 1: candidate đứng đầu chuyển giảm 35000đ → 34200đ; điểm 15965000 → 16047400 (+82400).
- returns-sensitive, lần 2: candidate đứng đầu chuyển giảm 1000đ → 2000đ; điểm -1871146 → -1942464 (-71318).

Đây là nguyên nhân trực tiếp trong phép tính engine: candidate tốt nhất đổi effective discount, dẫn đến điểm khác dưới cùng input. Chưa chứng minh reference gây ra lựa chọn đó; model vẫn có biến động. Hybrid giữ được phương án search tốt hơn nên các chênh lệch candidate này không đổi best score cuối.

## Retrieval holdout sau freeze

| Retriever | P@5    | Precision thực trả | R@5    | Trần R@5 | nDCG@5 | MRR@5  | Negative pass |
| --------- | ------ | ------------------ | ------ | -------- | ------ | ------ | ------------- |
| legacy    | 0.3200 | 0.5050             | 0.9042 | 0.9052   | 0.9385 | 0.9500 | 2/3           |
| revised   | 0.3200 | 0.8450             | 0.9042 | 0.9052   | 0.9869 | 1.0000 | 3/3           |

Bộ 13 query do parent tạo sau khi v2 freeze; implementer không xem trước, nhưng chưa phải external blind audit hay mẫu traffic đại diện. Có 10 positive và 3 negative; trần recall bị K=5/96 geometry records chi phối, cùng giới hạn context 15k ký tự. V2 sửa kind/entity precision và thứ tự, không tăng relevant-count nên P@5/R@5 giữ nguyên.

- Lỗi còn lại natural-yogurt: precision thực trả 25.00%; YOGURT · YOGURT → FLUID MILK PRODUCTS · YOGURT → CHEESE · YOGURT → BAKED BREAD/BUNS/ROLLS.
- Lỗi còn lại diapers-natural: precision thực trả 20.00%; DIAPERS & DISPOSABLES · DIAPERS & DISPOSABLES → BABY HBC · DIAPERS & DISPOSABLES → FLUID MILK PRODUCTS · INFANT FORMULA → DIAPERS & DISPOSABLES · INFANT CARE PRODUCTS → DIAPERS & DISPOSABLES.

Hai query tự nhiên về “thông tin” chưa được hiểu như intent profile, nên v2 vẫn trả association theo sau profile. Đây là chẩn đoán sau holdout, **không retune v2 trong run này**; lần sửa tiếp theo cần holdout mới.

## Chi phí, token và latency

| Nhánh provider         | Calls | Model thực  | Pass protocol | Token input/output | USD ước tính | p50/p95 ms  |
| ---------------------- | ----- | ----------- | ------------- | ------------------ | ------------ | ----------- |
| M4_legacy_retrieval_ai | 16    | gpt-6-astra | 16/16         | 69308/4191         | 0.902630     | 5606 / 9913 |
| M4_fixed_retrieval_ai  | 16    | gpt-6-astra | 16/16         | 67318/4050         | 0.875680     | 5924 / 8459 |
| M3_explanation         | 8     | gpt-6-astra | 8/8           | 14058/1410         | 0.211080     | 2566 / 3993 |

M1 local CPU: 8 lần preparation, p50 18.924 ms, p95 23.631 ms; exhaustive integer 0/8, budget exhausted 0/8. Đây là timing local không phải E2E hoặc benchmark tải.
M2 dùng lại request M4_fixed, không phát sinh lượt provider thứ hai. Latency provider row gồm capture/assessment và có thể gồm hybrid search; chưa gồm UI/network đến backend hoặc bước chuẩn bị retrieval/gold. Đơn giá cấu hình dùng để ước tính, không phải hóa đơn.

## Explanation và bằng chứng còn thiếu

M3 accepted 8/8; số đúng 28/28; required claim coverage 100.00%; evidence citations 0, valid-ID citations 0.
Provider nhận sẵn required facts; output structured được kiểm rồi render bằng template. Kết quả này đo sao chép/chọn fact đúng contract, không chứng minh viết giải thích tự do, reasoning sâu hoặc citation semantic support. Với 0 citation, citation accuracy là N/A, không phải 100%. Cần so với template không AI và đo người dùng hiểu/chọn nhanh hơn trước khi trả thêm phí.

M5 đã triển khai pipeline/analyzer với 4 synthetic tests; đây là kiểm tra code, không phải hiệu quả chiến dịch. Vẫn cần pilot merchant: assignment treatment/control, exposure, voucher/funding, giỏ hàng, stock, hủy/hoàn và profit thực; chưa có nên causal uplift/forecast calibration = N/A.

## Nguyên nhân và quyết định sau phép thử

- Retrieval v2 giảm nhiễu lexical nhưng reference vẫn không có elasticity hay causal response của merchant; không đủ cơ sở quy mọi thay đổi score cho chất lượng retrieval.
- LLM one-shot chưa nhận score feedback từ engine; hybrid thêm proposal vào search rộng không giúp best score ở 16 lượt hiện tại. Search đã bao phủ phương án tốt hơn nhiều candidate, nhưng cần xem signed gap và tie case trước khi kết luận.
- Những cặp v2 thua v1 và cặp thắng được giữ nguyên trong bảng; không loại case control để tạo báo cáo đẹp. Hai lần lặp chỉ mô tả biến động ban đầu.
- Giữ search làm lựa chọn mặc định cần thử nghiệm sản phẩm; giữ AI là tùy chọn nếu có ích cho người dùng. Chưa có lý do thực nghiệm để đổi model hay thêm vector DB trong lượt này.
- Bộ mới có 8 case tổng hợp khác bộ 12 case/72 call trước; không so tỷ lệ thắng/cost của hai run như controlled A/B. M4 ở run mới là v1-v2 cùng có reference, không phải có-vs-không reference như run trước.

Provenance: method-cases.v1, SHA256 f09e5856056f318e485a77eb0e31df6fcd78a5b998573b6194a18880c06c1356; retrieval qrels 1bb03055bbf8c46aafb33e7f069fc64e3e5869565302b9ead1b4983d1e5d4903; index bba6710b1f3399384df54c7939af0a775f24f1334298b8075d95ad48bacfc8e1.
Đọc thêm [root causes](optimization-root-causes.md) và [run 72 calls trước](ai-evaluation-results.md).

## Thử hậu nghiệm: đa dạng mức giảm khi trình bày

Trạng thái **posthoc_not_heldout_confirmed**; 0 provider calls. Đây là phân tích sau khi xem kết quả, chưa xác nhận trên holdout mới và chưa bật mặc định trong app. Không sửa ranking metric hoặc raw comparison đã freeze.

Chọn các offer cách nhau ít nhất max(1000 VND, ceil(1% basket)); giữ winner 8/8 case. Đổi mức giảm để so sánh rõ hơn có thể làm score các offer phụ thấp hơn; không phải tăng chất lượng tối ưu.

| Case                     | Top 5 cũ (đ)                      | Offer giãn cách (đ)               | Ngưỡng (đ) | Giữ winner |
| ------------------------ | --------------------------------- | --------------------------------- | ---------- | ---------- |
| response-headroom        | 20644, 20645, 20646, 20647, 20648 | 20644, 18774, 22836, 16608, 24912 | 1730       | true       |
| thin-margin-safe         | 0, 1, 2, 3, 4                     | 0, 4200, 8400, 13440, 18480       | 4200       | true       |
| minimum-upsell-unmodeled | 35174, 35175, 35176, 35177, 35178 | 35174, 32775, 30305, 28120, 25840 | 1900       | true       |
| stock-saturated          | 435, 436, 437, 438, 439           | 435, 2188, 3560, 4932, 6576       | 1370       | true       |
| grocery-subsidized       | 28961, 28962, 28963, 28964, 28965 | 28961, 29988, 27552, 31248, 26544 | 1000       | true       |
| zero-budget-control      | 0, 1, 2, 3, 4                     | 0, 2212, 4424, 7072, 9724         | 2210       | true       |
| zero-conversion-control  | 0, 1, 2, 3, 4                     | 0, 1120, 2240, 3584, 4928         | 1120       | true       |
| returns-sensitive        | 0, 1, 2, 3, 4                     | 0, 2680, 5360, 8576, 11792        | 2680       | true       |

Giãn cách giảm giá không tự bảo đảm các phương án đáng chọn hoặc có lời; cần hiển thị chênh lệch score và lọc theo mục tiêu merchant trước khi đưa vào workflow.
