# Margin Guard — Agent Strategy (v0.1, bản đơn giản hoá)

> Sinh từ `00-master-context.md`. Mục tiêu: merchant nhập **3 thứ** → LLM trả về **voucher combination matrix** + số lượng từng voucher + kiểm tra margin floor.
> Strategy catalog **không đóng băng** trong file: có vòng refresh từ internet (mục 5).

---

## 1. Input (merchant chỉ cần nhập 3 trường)

```json
{
  "est_customers": 3000,
  "num_vouchers": 600,
  "products": [
    { "name": "Áo thun basic", "price": 199000, "cost": 99000 },
    { "name": "Quần jean",     "price": 499000, "cost": 275000 },
    { "name": "Tất cổ ngắn",   "price": 49000 }
  ]
}
```

- `cost` **không bắt buộc**. Thiếu thì LLM suy ra (mục 2) và **gắn cờ `inferred`**.
- Mọi trường khác (objective, AOV, phí ship, floor…) đều **tự suy luận**, merchant có thể override.

## 2. Giá trị mặc định LLM tự suy luận

| Trường | Cách suy | Mặc định |
|---|---|---|
| `vertical` | từ tên sản phẩm | — |
| `cost` thiếu | gross margin điển hình theo vertical (fashion 50–60%, beauty 60–70%, food 25–35%, electronics 10–20%) | lấy cận **dưới** (an toàn) |
| `aov` | ~1.5–2 × giá trung vị sản phẩm | — |
| `shipping_cost` | nội địa VN | 25.000đ |
| `payment_fee_pct` | sàn/cổng thanh toán | 5% |
| `margin_floor_pct` | contribution / doanh thu thuần | 20% |
| `objective` | theo tỉ lệ `num_vouchers / est_customers` (bên dưới) | `aov` |

**Coverage = num_vouchers / est_customers**

| Coverage | Diễn giải | Phản ứng |
|---|---|---|
| < 10% | ít voucher | Set A, 1–2 voucher, ưu tiên targeted |
| 10–25% | lành mạnh | Set A/B, 3–4 voucher |
| > 25% | nguy cơ "dạy" khách chờ giảm giá | **cảnh báo**, đề xuất giảm số lượng, bắt buộc unique code |

## 3. Pipeline (5 bước)

```
Input ─► [1] Enrich ─► [2] Product guard ─► [3] Pick & score ─► [4] Allocate + Matrix ─► [5] Worst-stack check ─► Output
                                ▲
                     Strategy catalog (base + fresh từ internet)
```

1. **Enrich** — điền giá trị mục 2, đánh dấu cái nào là suy luận.
2. **Product guard** — với mỗi sản phẩm tính mức giảm tối đa còn giữ được floor:
   `d_max = 1 − cost / (price × (1 − fee% − floor%))`
   - `d_max < 10%` → **loại khỏi mọi voucher %** (chỉ dùng làm quà GWP hoặc freeship).
3. **Pick & score** — lọc strategy theo objective, chấm 4 tiêu chí (1–5): *Objective fit, Margin safety, Incremental, Simplicity*. Score = tổng. Giữ top-N, với N theo bảng coverage.
4. **Allocate + Matrix** — chia `num_vouchers` theo tỉ trọng score (làm tròn bội 10), rồi điền matrix stacking theo luật mặc định:
   - Tối đa **1 voucher %** / đơn (2 cái % → *best-of*).
   - Freeship stack được với mọi thứ.
   - GWP stack được, tối đa 1 quà / đơn.
   - Thứ tự áp: product-level → order % → ship → credit.
5. **Worst-stack check** — dựng giỏ hàng xấu nhất cho mỗi tổ hợp "Yes" trong matrix, tính
   `CM% = (net × (1 − fee%) − Σcost − ship_subsidy − gift_cost) / net`.
   Bất kỳ ô nào < floor → đổi ô đó thành **No** hoặc nâng threshold, rồi chạy lại.

## 4. Output mẫu (cho input mục 1)

**Suy luận:** vertical = fashion · AOV ≈ 350k · ship 25k · fee 5% · floor 20% · cost tất = 34k *(inferred, margin 31%)* · coverage = 20% → lành mạnh, objective = **AOV**.

**Product guard**

| Sản phẩm | Margin gộp | d_max | Kết luận |
|---|---|---|---|
| Áo thun basic | 50% | 33.7% | OK |
| Quần jean | 45% | 26.5% | OK |
| Tất cổ ngắn | 31% *(inferred)* | 7.5% | **Loại khỏi voucher %**, dùng làm quà GWP |

**Voucher được chọn + số lượng**

| Code | Strategy | Cơ chế | Score | Số lượng |
|---|---|---|---|---|
| `FREESHIP399` | AOV-02 | Freeship đơn ≥ 399k | 18 | **240** |
| `TIER599` | AOV-01 | −10% đơn ≥ 599k | 15 | **150** |
| `WELCOME10` | ACQ-01 | −10% đơn đầu ≥ 299k, unique, trừ tất | 14 | **120** |
| `GWP599` | AOV-03 | Tặng 1 đôi tất đơn ≥ 599k | 13 | **90** |
| | | | **Tổng** | **600** |

**Voucher combination matrix**

| | FREESHIP399 | TIER599 | WELCOME10 | GWP599 |
|---|---|---|---|---|
| **FREESHIP399** | — | ✅ | ✅ | ✅ |
| **TIER599** | ✅ | — | ⚖️ best-of | ✅ |
| **WELCOME10** | ✅ | ⚖️ best-of | — | ✅ |
| **GWP599** | ✅ | ✅ | ✅ | — |

**Worst-stack check** (floor 20%)

| Giỏ xấu nhất | Stack | CM% | Kết quả |
|---|---|---|---|
| 1 jean (499k) | WELCOME10 + FREESHIP | 28.2% | ✅ |
| 1 jean + 1 áo (698k) | TIER599 + FREESHIP + GWP | 26.1% | ✅ |
| 1 jean + 2 áo (897k) | TIER599 + FREESHIP + GWP | 29.1% | ✅ |

**Cảnh báo / đo lường:** giữ 10% khách làm holdout (không nhận voucher) để đo contribution tăng thêm thực sự; dừng `WELCOME10` nếu >30% lượt dùng đến từ khách cũ.

### JSON contract (bản rút gọn)

```json
{
  "assumptions": { "vertical": "fashion", "aov": 350000, "margin_floor_pct": 20, "inferred": ["cost:Tất cổ ngắn", "aov"] },
  "excluded_from_pct": ["Tất cổ ngắn"],
  "vouchers": [
    { "code": "FREESHIP399", "strategy_id": "AOV-02", "qty": 240, "rule": "free_ship min_order=399000" }
  ],
  "matrix": { "FREESHIP399": { "TIER599": "yes", "WELCOME10": "yes", "GWP599": "yes" }, "TIER599": { "WELCOME10": "best_of" } },
  "worst_stack": [ { "basket": "1 jean + 1 áo", "stack": ["TIER599","FREESHIP399","GWP599"], "cm_pct": 26.1, "pass": true } ],
  "warnings": [],
  "catalog_version": "2026-10-31"
}
```

## 5. Strategy refresh từ internet

Catalog = **base** (mục 3 master context) + **fresh** (lấy từ web). Hai chế độ:

| Chế độ | Khi nào | Làm gì |
|---|---|---|
| **Scheduled refresh** | hàng tuần (cron) | Web search theo bộ query cố định → LLM trích strategy mới theo đúng schema catalog (`id, mechanic, depth, guardrails, risk, best_when, source_url, seen_at`) → validator → lưu `status: candidate` |
| **Live context** | mỗi lần merchant chạy | 1–2 search ngắn theo vertical + mùa (vd. 11.11, 12.12, Tết) → chỉ dùng làm *context* ưu tiên, **không** thêm strategy mới chưa duyệt |

**Validator (cổng vào catalog):** đủ field schema · có `source_url` < 12 tháng · chạy được qua bước Worst-stack với sản phẩm mẫu · không trùng strategy hiện có. Pass → `approved` (có thể cần người duyệt trong giai đoạn đầu). Strategy không được thấy lại sau 12 tháng → `stale`.

Query gợi ý: `"voucher strategy Shopee/TikTok Shop {vertical} {năm}"`, `"free shipping threshold AOV benchmark {năm}"`, `"promotion stacking rules ecommerce"`, `"mega sale campaign mechanics {tháng}"`.

## 6. Việc cần chốt với team

1. Floor mặc định 20% hay để merchant chọn?
2. `cost` có bắt buộc không, hay chấp nhận suy luận + cờ `inferred`?
3. Refresh: tự động approve hay luôn cần người duyệt?
4. Holdout 10% có khả thi với merchant nhỏ (< 1.000 khách)?
