# Test run — beauty mock (2026-10-31)

> Chạy từ phiên Claude mới (`claude -p`, chỉ cho Read, không web search). Input: `beauty-mock-input.json`.
>
> **Review tay:** dòng "5 SRM (795k) TIER799" sai vì 795k < 799k, giỏ đúng là 6 SRM (954k) → CM ≈ 21,9%, vẫn pass. Các số khác đã kiểm khớp.

**Suy luận:** vertical = beauty · AOV ≈ 350k (1,75 × giá trung vị 199k) · ship 25k · fee 5% · floor 20% · giá vốn Kem chống nắng = 112k và Mặt nạ = 79,6k *(inferred, lấy cận dưới margin beauty 60%)* · coverage = 2.500/8.000 = **31,25% → vượt ngưỡng 25%, có cảnh báo** · objective = **AOV**.

**Product guard** — `d_max = 1 − cost / (price × 0,75)`

| Sản phẩm | Margin gộp | d_max | Kết luận |
|---|---|---|---|
| Serum Vitamin C 30ml | 65,7% | 54,3% | OK |
| Kem chống nắng SPF50 | 60% *(inferred)* | 46,7% | OK |
| Sữa rửa mặt dịu nhẹ | 40,3% | 20,3% | OK, nhưng biên mỏng nên dùng làm giỏ worst-case |
| Mặt nạ giấy (hộp 10) | 60% *(inferred)* | 46,7% | OK |
| Bông tẩy trang 120 miếng | 26,7% | 2,2% | **Loại khỏi voucher %**, dùng làm quà GWP và không tính vào ngưỡng đơn tối thiểu |

**Voucher được chọn + số lượng** (chia 2.500 theo tỉ trọng score, làm tròn bội 10)

| Code | Strategy | Cơ chế | Score (Fit/Safety/Incr/Simple) | Số lượng |
|---|---|---|---|---|
| `FREESHIP449` | AOV-02 | Freeship đơn ≥ 449k (cao hơn AOV 28%) | 18 (5/5/3/5) | **700** |
| `GWP499` | AOV-03 | Tặng 1 bông tẩy trang cho đơn ≥ 499k, tối đa 1 quà | 17 (5/4/4/4) | **660** |
| `TIER799` | AOV-01 | −10% cho đơn ≥ 799k, trừ bông tẩy trang | 15 (5/3/3/4) | **590** |
| `WELCOME10` | ACQ-01 | −10% đơn đầu ≥ 299k, unique, trừ bông tẩy trang | 14 (2/4/4/4) | **550** |
| | | | **Tổng** | **2.500** |

Mọi ngưỡng đơn tối thiểu chỉ tính trên subtotal **không gồm bông tẩy trang**. Lý do: một giỏ toàn bông (450k) + freeship chỉ còn CM 16,1%, dưới floor.

**Voucher combination matrix**

| | FREESHIP449 | GWP499 | TIER799 | WELCOME10 |
|---|---|---|---|---|
| **FREESHIP449** | — | ✅ | ✅ | ✅ |
| **GWP499** | ✅ | — | ✅ | ❌ |
| **TIER799** | ✅ | ✅ | — | ⚖️ best-of |
| **WELCOME10** | ✅ | ❌ | ⚖️ best-of | — |

**Worst-stack check** (floor 20%; giỏ xấu nhất là toàn Sữa rửa mặt, sản phẩm biên thấp nhất còn được giảm %)

| Giỏ xấu nhất | Stack | CM% | Kết quả |
|---|---|---|---|
| 2 SRM (318k) | WELCOME10 | 28,6% | ✅ |
| 3 SRM (477k) | FREESHIP449 | 30,0% | ✅ |
| 3 SRM (477k) | WELCOME10 + FREESHIP | 22,8% | ✅ |
| 4 SRM (636k) | GWP499 + FREESHIP | 26,1% | ✅ |
| 4 SRM (636k) | WELCOME10 + FREESHIP + GWP | 18,5% | ❌ → đổi ô thành **No** |
| 4 SRM (636k) | TIER599 + FREESHIP + GWP *(lần chạy 1)* | 18,5% | ❌ → nâng ngưỡng lên **799k** |
| 5 SRM (795k) | TIER799 + FREESHIP + GWP *(lần chạy 2)* | 20,5% | ✅ (sát floor) |

**Cảnh báo / đo lường:**
- Coverage 31,25% vượt 25%, có nguy cơ khách quen chờ giảm giá. Nên giảm xuống **≤ 2.000 voucher**: FREESHIP 560 / GWP 530 / TIER 470 / WELCOME 440. Bắt buộc dùng unique code cho mọi voucher.
- Giữ 10% khách (800 người) làm holdout để đo contribution tăng thêm thực sự. Dừng `WELCOME10` nếu hơn 30% lượt dùng đến từ khách cũ.
- Giá vốn Kem chống nắng và Mặt nạ đang là suy luận. Merchant nên nhập giá thật rồi chạy lại.
- Ô `TIER799 + FREESHIP + GWP` chỉ dư 0,5 điểm so với floor. Nếu giá vốn SRM hoặc phí ship tăng, ô này sẽ trượt.

### JSON contract

```json
{
  "assumptions": {
    "vertical": "beauty",
    "aov": 350000,
    "shipping_cost": 25000,
    "payment_fee_pct": 5,
    "margin_floor_pct": 20,
    "objective": "aov",
    "coverage_pct": 31.25,
    "inferred": ["vertical", "aov", "shipping_cost", "payment_fee_pct", "margin_floor_pct", "objective", "cost:Kem chống nắng SPF50", "cost:Mặt nạ giấy (hộp 10)"],
    "inferred_costs": { "Kem chống nắng SPF50": 112000, "Mặt nạ giấy (hộp 10)": 79600 }
  },
  "product_guard": [
    { "name": "Serum Vitamin C 30ml", "gross_margin_pct": 65.7, "d_max_pct": 54.3, "status": "ok" },
    { "name": "Kem chống nắng SPF50", "gross_margin_pct": 60.0, "d_max_pct": 46.7, "status": "ok", "inferred": true },
    { "name": "Sữa rửa mặt dịu nhẹ", "gross_margin_pct": 40.3, "d_max_pct": 20.3, "status": "ok" },
    { "name": "Mặt nạ giấy (hộp 10)", "gross_margin_pct": 60.0, "d_max_pct": 46.7, "status": "ok", "inferred": true },
    { "name": "Bông tẩy trang 120 miếng", "gross_margin_pct": 26.7, "d_max_pct": 2.2, "status": "excluded_from_pct", "use_as": "gwp_gift" }
  ],
  "excluded_from_pct": ["Bông tẩy trang 120 miếng"],
  "threshold_basis": "subtotal_excluding:Bông tẩy trang 120 miếng",
  "vouchers": [
    { "code": "FREESHIP449", "strategy_id": "AOV-02", "score": 18, "qty": 700, "rule": "free_ship min_order=449000", "unique": true },
    { "code": "GWP499", "strategy_id": "AOV-03", "score": 17, "qty": 660, "rule": "gift=Bông tẩy trang 120 miếng max_gifts=1 min_order=499000", "unique": true },
    { "code": "TIER799", "strategy_id": "AOV-01", "score": 15, "qty": 590, "rule": "pct_off=10 min_order=799000 exclude=[Bông tẩy trang 120 miếng]", "unique": true },
    { "code": "WELCOME10", "strategy_id": "ACQ-01", "score": 14, "qty": 550, "rule": "pct_off=10 first_order_only min_order=299000 exclude=[Bông tẩy trang 120 miếng]", "unique": true }
  ],
  "matrix": {
    "FREESHIP449": { "GWP499": "yes", "TIER799": "yes", "WELCOME10": "yes" },
    "GWP499": { "TIER799": "yes", "WELCOME10": "no" },
    "TIER799": { "WELCOME10": "best_of" }
  },
  "worst_stack": [
    { "basket": "2 SRM", "stack": ["WELCOME10"], "cm_pct": 28.6, "pass": true },
    { "basket": "3 SRM", "stack": ["FREESHIP449"], "cm_pct": 30.0, "pass": true },
    { "basket": "3 SRM", "stack": ["WELCOME10", "FREESHIP449"], "cm_pct": 22.8, "pass": true },
    { "basket": "4 SRM", "stack": ["GWP499", "FREESHIP449"], "cm_pct": 26.1, "pass": true },
    { "basket": "4 SRM", "stack": ["WELCOME10", "FREESHIP449", "GWP499"], "cm_pct": 18.5, "pass": false, "action": "cell_set_no" },
    { "basket": "4 SRM", "stack": ["TIER599", "FREESHIP449", "GWP499"], "cm_pct": 18.5, "pass": false, "action": "raise_threshold_to_799000" },
    { "basket": "5 SRM", "stack": ["TIER799", "FREESHIP449", "GWP499"], "cm_pct": 20.5, "pass": true }
  ],
  "warnings": [
    "coverage_31.25pct_above_25pct: đề xuất giảm còn 2000 voucher (560/530/470/440), bắt buộc unique code",
    "min_order phải tính trên subtotal không gồm bông tẩy trang (giỏ toàn bông + freeship = CM 16.1%)",
    "TIER799+FREESHIP449+GWP499 chỉ dư 0.5pt so với floor",
    "giá vốn Kem chống nắng và Mặt nạ là suy luận, cần merchant xác nhận",
    "holdout 10% = 800 khách; dừng WELCOME10 nếu >30% lượt dùng từ khách cũ"
  ],
  "catalog_version": "2026-10-31"
}
```

Kết quả chỉ dùng base catalog, không search web và không có live context.
