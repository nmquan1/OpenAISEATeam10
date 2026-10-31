# STRATEGY — Chiến lược merchant cho mega-sale 11.11 / 12.12

Input research cho Margin Guard · nhóm **STRATEGY** (nhóm 3/3)
Phạm vi: đòn chiến lược merchant dùng trong mega-sale — Flash Sale, Combo/bundle, Mua kèm deal sốc, Ads, lock-in chương trình — và các guardrail người bán thực tế dùng (profit floor, max discount).
Ngày thu thập: 2026-10-31 · Thị trường: Việt Nam · Trọng tâm Shopee, đối chiếu Lazada / TikTok Shop.

**Thang tin cậy dùng trong file này**

| Nhãn         | Nghĩa                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verified`   | Đọc trực tiếp trang chính thức của sàn (banhang.shopee.vn, ads.shopee.vn, help.shopee.vn) hoặc văn bản pháp luật gốc.                              |
| `secondary`  | Nguồn thứ ba (blog agency, báo, đơn vị tư vấn) mô tả lại; hoặc trang chính thức của **thị trường khác** (SG/ID). Chưa đối chiếu Kênh Người Bán VN. |
| `assumption` | Suy luận/heuristic của người viết hoặc của practitioner, không có nguồn kiểm chứng được.                                                           |

Mọi con số đều ghi nguồn. Không có số nào ở đây được phép vào fee schedule mà không qua `verification_status` (ER-7).

---

## 0. Kết luận điều hành — 5 điều định hình toàn bộ lớp strategy

1. **Lớp strategy không phải danh sách loại giảm giá, mà là (a) ai trả mỗi đồng giảm giá và (b) cái gì được cộng dồn với cái gì.** Shopee chặn cứng việc một SKU chạy đồng thời Flash Sale và Combo/Mua kèm — ràng buộc này quyết định tổ hợp nào _tồn tại được_ trước khi tính lãi lỗ.
2. **Giảm sâu ≥50% chỉ đi qua được chương trình của sàn, và điều đó đổi cấu trúc tài trợ.** Trần pháp lý là 50% cho chương trình shop tự tạo, 100% cho chương trình khuyến mại tập trung; Shopee khoá sản phẩm nếu shop tự đặt giảm >50%. Nghĩa là "giảm 60%" không phải một quyết định giá — nó là một quyết định _ai trả_.
3. **Chi phí quảng cáo là biến số lớn nhất và là biến số duy nhất seller điều khiển được trong ngày sale.** Cùng một mức giảm 30%, đổi ROAS 8 → 5 làm biên rơi từ 16,7% xuống 9,2% (§5). Không có ROAS floor thì mọi guardrail khác đều vô nghĩa.
4. **Lock-in là chi phí, không phải trạng thái.** Voucher Xtra khoá 15 ngày; chương trình ads ngày sale tự gia hạn và buộc bật nạp tiền tự động từ doanh thu. Schema hiện có `lock_until` nhưng thiếu _chi phí thoát_.
5. **Q4/2025 là bằng chứng phản trực giác: ASP +33% YoY nhưng sản lượng −8%.** Niềm tin "giảm sâu để bán được nhiều" yếu hơn seller tưởng; đòn bẩy thật là AOV/basket, không phải volume.

---

## 1. Bối cảnh thị trường Q4 (để hiệu chỉnh giả định)

| Tham số                                                        | Giá trị                                                                                                             | Nguồn                                                                        | Tin cậy     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------- |
| Tổng doanh số 4 sàn (Shopee, TikTok Shop, Lazada, Tiki) — 2025 | 429,7 nghìn tỷ đ, +34,75% YoY; 3.941,6 triệu sản phẩm                                                               | https://metric.vn/insights/cong-bo-bao-cao-thuong-mai-dien-tu-viet-nam-2025/ | `secondary` |
| Tổng GMV 2025 — phương pháp khác                               | 458,16 nghìn tỷ đ, +26% YoY                                                                                         | https://youneteci.com/bao-cao-toan-canh-tmdt-viet-nam-2025/                  | `secondary` |
| Thị phần doanh số 2025                                         | Shopee 56,04% · TikTok Shop 41,31% (Metric) — hoặc Shopee 57,5% · TikTok 39,6% · Lazada 5,7% · Tiki 1% (YouNet ECI) | metric.vn; youneteci.com                                                     | `secondary` |
| Doanh số theo tháng Q4/2025                                    | T10: 39,73 · T11: 40,33 · T12: 43,67 nghìn tỷ đ                                                                     | https://onflow.vn/bao-cao-thuong-mai-dien-tu-viet-nam-2025-2026-moi-nhat/    | `secondary` |
| Q4/2025 so Q3/2025                                             | 123,7 nghìn tỷ đ, +19,43% QoQ                                                                                       | metric.vn                                                                    | `secondary` |
| **ASP toàn sàn Q4/2025**                                       | **+33% YoY**                                                                                                        | youneteci.com                                                                | `secondary` |
| **Sản lượng Q4/2025**                                          | **−8% YoY**                                                                                                         | youneteci.com                                                                | `secondary` |
| Số shop có phát sinh đơn 2025                                  | 601.780, −7,43% YoY                                                                                                 | metric.vn                                                                    | `secondary` |
| Ngày 11/11/2026                                                | Thứ Tư                                                                                                              | https://khuyenmaidacbiet.com/landing-page/lich-sale-shopee-thang-11-2026     | `secondary` |
| Khung giờ vàng 11.11 (phía người mua)                          | 0h · 12h · 18h · 20h–22h                                                                                            | cùng nguồn                                                                   | `secondary` |

> **Hệ quả cho model:** dùng ASP +33% / volume −8% làm neo cho scenario "mega-sale 2026". Đừng giả định volume tăng khi giảm giá; giả định _traffic_ tăng và _conversion_ tăng, còn units thì phụ thuộc ASP. Xem thêm ghi chú §7 về việc số liệu này là của 2025, không phải 2026.

---

## 2. Lịch & cơ chế mega-sale

| Tham số                                           | Giá trị                                                                   | Nguồn                                         | Tin cậy                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Định nghĩa "Ngày Siêu Sale" của sàn               | Ngày 1, ngày đôi (9.9/10.10/11.11/12.12), ngày 15, ngày 25 hàng tháng     | https://ads.shopee.vn/news/2375               | `verified`                                      |
| Chuỗi mega-sale cuối năm                          | 9.9 → 10.10 → 11.11 → 12.12 (12.12 kéo dài tới Black Friday)              | metric.vn 2025 report                         | `secondary`                                     |
| Cửa sổ chiến dịch 11.11 (mẫu SG)                  | 11.11 Big Sale: 30/10 – 17/11; hạn chót nộp đề cử 29/10 17:00             | https://seller.shopee.sg/edu/article/27323    | `secondary` (thị trường SG — **không** phải VN) |
| Cửa sổ nộp muộn (mẫu SG)                          | 11.11 Big Sale đợt 2: 10/11 20:00 – 17/11; hạn 10/11 17:00                | cùng nguồn                                    | `secondary` (SG)                                |
| Tiêu chí "price teaser" (mẫu SG)                  | Giá đề cử phải thấp hơn **≥4%** so với giá thấp nhất tháng trước          | cùng nguồn                                    | `secondary` (SG)                                |
| Giá thấp nhất tháng trước **loại trừ**            | Giá spike-day, giá Flash Deal, giá Super Brand Day, giá category campaign | cùng nguồn                                    | `secondary` (SG)                                |
| Thời gian giao tối đa (DTS) cho Flash Sale        | ≤3 ngày                                                                   | https://banhang.shopee.vn/edu/article/15976   | `verified`                                      |
| Thời điểm phê duyệt Flash Sale đề xuất bởi Shopee | Trước **≥4 ngày** so với khung giờ chạy                                   | https://banhang.shopee.vn/edu/article/27886   | `verified`                                      |
| Cửa sổ huỷ Flash Sale                             | Từ lúc mở cổng đăng ký đến trước khi khung giờ kết thúc                   | cùng nguồn                                    | `verified`                                      |
| Giá Flash Sale có công bố trước?                  | Không — giá giữ kín đến khi khung giờ mở                                  | https://help.shopee.vn/portal/4/article/79506 | `verified`                                      |

**Lưu ý thiết kế:** cửa sổ chiến dịch VN của 11.11/12.12 **không** công bố công khai ngoài Kênh Người Bán. Không được hard-code ngày; phải để `campaign.starts_at`/`ends_at` là dữ liệu nhập.

---

## 3. Các đòn chiến lược

### 3.1 Flash Sale

Hai cơ chế khác nhau, **khác người tài trợ** — đây là điểm dễ model sai nhất.

| Tham số                                             | Đơn vị        | Giá trị / range                                                                   | Nguồn                                                                          | Tin cậy     |
| --------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| `flash_sale.mode`                                   | enum          | `platform` (Shopee Flash Sale) · `shop` (Flash Sale của Shop)                     | banhang 15976 / shopplus                                                       | `verified`  |
| `flash_sale.platform.shopee_subsidy`                | bool          | Có — một số SKU được Shopee trợ giá thêm, hoàn vào doanh thu đơn khi đơn hoàn tất | https://banhang.shopee.vn/edu/article/27886                                    | `verified`  |
| `flash_sale.platform.dts_max_days`                  | ngày          | 3                                                                                 | banhang 15976                                                                  | `verified`  |
| `flash_sale.platform.approve_lead_days`             | ngày          | ≥4 (chương trình Shopee đề xuất)                                                  | banhang 27886                                                                  | `verified`  |
| `flash_sale.platform.price_hidden_until_slot`       | bool          | true                                                                              | help 79506                                                                     | `verified`  |
| `flash_sale.shop.min_products_per_slot`             | SKU           | 1                                                                                 | shopplus.vn Q&A                                                                | `secondary` |
| `flash_sale.shop.max_products_per_slot`             | SKU           | 10                                                                                | shopplus.vn                                                                    | `secondary` |
| `flash_sale.shop.discount_range_bps`                | bps           | 5% – 90% (500–9.000) — _xem cảnh báo bên dưới_                                    | shopplus.vn                                                                    | `secondary` |
| `flash_sale.shop.stock_per_sku`                     | units         | 5 – 100                                                                           | shopplus.vn                                                                    | `secondary` |
| `flash_sale.shop.promo_must_be_lowest_7d`           | bool          | true (không tính giá Flash Sale của Shopee)                                       | shopplus.vn                                                                    | `secondary` |
| `flash_sale.shop.cooldown_per_sku`                  | giờ           | 24 (1 SKU = 1 khung / 24h); cách chương trình kế tiếp ≥1 ngày                     | shopplus.vn                                                                    | `secondary` |
| `flash_sale.shop.slot_reservation_cap`              | slot          | 2.000 slot / SKU trên toàn bộ khung đang mở                                       | https://blog.autoshopee.com/nhan-ban-flash-sale-shopee-11-11-tu-kich-ban-cu-2/ | `secondary` |
| `flash_sale.shop.slot_formula`                      | công thức     | slot 1 khung = số lượng bán mỗi phân loại × số phân loại                          | cùng nguồn                                                                     | `secondary` |
| `flash_sale.shop.eligibility.order_fail_rate_max`   | %             | ≤10%                                                                              | shopplus.vn                                                                    | `secondary` |
| `flash_sale.shop.creation_lead`                     | ngày làm việc | ≥2 ngày làm việc, mở cổng 17:00 (hoặc 20:00 nếu chạy thứ Ba)                      | shopplus.vn                                                                    | `secondary` |
| `flash_sale.shop.blocked_if_reference_price_raised` | bool          | true — "giá ảo" bị loại                                                           | shopplus.vn (giá ảo)                                                           | `secondary` |

> ⚠ **Mâu thuẫn phải xử lý trong product, không được bỏ qua:** UI Shop Flash Sale cho phép giảm tới **90%**, nhưng (a) pháp luật chặn 50% với chương trình shop tự tạo (§4.1), và (b) Shopee khoá sản phẩm nếu shop tự đặt giảm >50%. Khoảng 5–90% là _range của ô nhập_, không phải _range hợp lệ_. Engine phải trả về `out_of_bounds` kèm lý do, không được im lặng cho qua.

### 3.2 Combo Khuyến Mãi (bundle)

| Tham số                                | Đơn vị  | Giá trị / range                                            | Nguồn                                      | Tin cậy     |
| -------------------------------------- | ------- | ---------------------------------------------------------- | ------------------------------------------ | ----------- |
| `combo.types`                          | enum[3] | giảm theo % · giảm theo số tiền · giá combo đặc biệt       | https://banhang.shopee.vn/edu/article/92   | `verified`  |
| `combo.max_tiers`                      | tier    | 3 (cùng một loại khuyến mãi)                               | banhang 92                                 | `verified`  |
| `combo.bundle_price_lt_sum_retail`     | bool    | bắt buộc                                                   | banhang 92                                 | `verified`  |
| `combo.fixed_amount_lt_total_value`    | bool    | bắt buộc (với loại giảm theo số tiền)                      | banhang 92                                 | `verified`  |
| `combo.max_duration_days`              | ngày    | 180                                                        | https://dinhdai.tech/blog/combo-khuyen-mai | `secondary` |
| `combo.start_lead_minutes`             | phút    | ≥60                                                        | cùng nguồn                                 | `secondary` |
| `combo.max_products`                   | SKU     | 1.000 (Seller Centre) / 200 (app); tối đa 3 mức ưu đãi     | cùng nguồn                                 | `secondary` |
| `combo.one_combo_per_sku_at_a_time`    | bool    | true                                                       | cùng nguồn                                 | `secondary` |
| `combo.cannot_co_run_with_flash_sale`  | bool    | true — SKU đang Flash Sale thì không tạo được Combo        | banhang 92                                 | `verified`  |
| `combo.tiers_immutable_after_create`   | bool    | true — không thêm được mức ưu đãi vào combo đã tạo         | shopplus.vn                                | `secondary` |
| `combo.same_shipping_channel_required` | bool    | true                                                       | banhang 92                                 | `verified`  |
| `combo.stackable_with_shop_programme`  | bool    | true — chồng được với "Chương trình của Shop" (giảm giá %) | banhang 92                                 | `verified`  |

**Điểm chiến lược:** Combo là đòn **tăng AOV mà không tăng độ sâu giảm giá trên từng SKU**. Với biên mỏng, combo an toàn hơn Flash Sale: cùng ngân sách giảm giá, nó phân bổ trên nhiều đơn vị hàng nên % giảm trên mỗi SKU thấp hơn. Đây là lý do combo là đòn ưu tiên khi `contribution_margin_bps` thấp.

### 3.3 Mua Kèm Deal Sốc (add-on / gift)

| Tham số                                | Đơn vị  | Giá trị / range                                                                                             | Nguồn                                            | Tin cậy      |
| -------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------ |
| `addon.variants`                       | enum[2] | `discount` (giảm giá khi mua kèm) · `gift` (mua để nhận quà)                                                | https://banhang.shopee.vn/edu/article/2276       | `verified`   |
| `addon.max_main_skus`                  | SKU     | 100                                                                                                         | shopplus.vn                                      | `secondary`  |
| `addon.per_buyer_limit`                | units   | Cấu hình được; mỗi loại SP mua kèm chỉ 1 lần/đơn                                                            | shopplus.vn                                      | `secondary`  |
| `addon.max_gift_units`                 | units   | 50                                                                                                          | shopplus.vn                                      | `secondary`  |
| `addon.gift_min_order_value`           | đồng    | Cấu hình được (điều kiện nhận quà)                                                                          | banhang 2276                                     | `verified`   |
| `addon.max_duration_months`            | tháng   | 3 (kết thúc muộn nhất 3 tháng sau khi bắt đầu)                                                              | shopplus.vn                                      | `secondary`  |
| `addon.start_lead_minutes`             | phút    | ≥60                                                                                                         | shopplus.vn                                      | `secondary`  |
| `addon.start_time_immutable`           | bool    | true — **tạo xong không đổi được giờ bắt đầu** (chỉ đẩy muộn hơn / kết thúc sớm hơn, và chỉ trước khi chạy) | shopplus.vn                                      | `secondary`  |
| `addon.qty_immutable_during_run`       | bool    | true — số lượng áp dụng tự động theo tồn kho, không sửa giữa chương trình                                   | shopplus.vn                                      | `secondary`  |
| `addon.same_shipping_channel_required` | bool    | true                                                                                                        | banhang 2276                                     | `verified`   |
| `addon.cannot_co_run_with_other_promo` | bool    | true                                                                                                        | shopplus.vn                                      | `secondary`  |
| `addon.addon_price_share_of_main`      | %       | 10 – 30% (heuristic practitioner, sản phẩm giá trị cao có thể vài %)                                        | https://duchuynhads.com/mua-kem-deal-soc-shopee/ | `assumption` |
| `addon.gift_only_order_fee_refund`     | bool    | Có — hoàn Phí Hạ Tầng + PiShip cho đơn chỉ có quà tặng, chậm nhất ngày 10 tháng sau                         | https://banhang.shopee.vn/edu/article/1003       | `verified`   |
| `addon.split_order_support`            | bool    | Có, từ 13/08/2026 (đa kho / Shopee Xử Lý)                                                                   | banhang 1003                                     | `verified`   |
| `addon.cancel_main_cancels_gift`       | bool    | true — huỷ đơn sản phẩm chính thì đơn quà bị huỷ theo                                                       | banhang 1003                                     | `verified`   |

**Điểm chiến lược:** Mua kèm là đòn duy nhất **không cần giảm giá sản phẩm chính**. Nó chuyển chi phí từ "mất biên trên món chủ lực" sang "lãi mỏng trên món phụ". Với `gift`, chi phí là COGS của quà (không phải doanh thu giảm) — nên nó là đòn phòng thủ biên tốt nhất trong ba đòn sản phẩm. Nhưng nó có ràng buộc vận hành nặng: cùng kênh vận chuyển, không trùng promo, tồn kho phải đủ.

### 3.4 Voucher & "Chương trình của Shop" — lớp công cụ, không phải lớp chiến lược

Voucher là _đơn vị_ giảm giá; strategy là _cách ghép_. Chi tiết field voucher thuộc nhóm VOUCHER — ở đây chỉ giữ những ràng buộc ảnh hưởng đến việc ghép tổ hợp:

| Tham số                               | Đơn vị | Giá trị                                                           | Nguồn                                      | Tin cậy     |
| ------------------------------------- | ------ | ----------------------------------------------------------------- | ------------------------------------------ | ----------- |
| `voucher.code_max_chars`              | ký tự  | 5                                                                 | https://banhang.shopee.vn/edu/article/2356 | `verified`  |
| `voucher.max_window_months`           | tháng  | 3                                                                 | cùng nguồn                                 | `verified`  |
| `voucher.max_uses_per_buyer`          | lượt   | mặc định 1, tối đa 5                                              | cùng nguồn                                 | `verified`  |
| `voucher.percent_requires_cap`        | bool   | true — voucher % **bắt buộc** có mức giảm tối đa                  | cùng nguồn                                 | `verified`  |
| `voucher.hoanxu_is_a_type`            | bool   | true — `Hoàn Xu` là _loại voucher_, không phải chương trình riêng | cùng nguồn                                 | `verified`  |
| `shop_programme.discount_ceiling_bps` | bps    | 5.000 — shop tự tạo không được vượt 50%                           | shopplus.vn                                | `secondary` |
| `shop_programme.excess_locks_product` | bool   | true — vượt 50% thì sản phẩm bị khoá, phải sửa hoặc gỡ            | shopplus.vn                                | `secondary` |

### 3.5 Ads (Dịch vụ Hiển thị Shopee)

Đây là **biến chi phí lớn nhất trong ngày sale** và là biến duy nhất seller chỉnh được trong lúc chạy.

| Tham số                                           | Đơn vị     | Giá trị / range                                                                                              | Nguồn                                                           | Tin cậy                         |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------- |
| `ads.billing_model`                               | enum       | CPC (truyền thống) · CPM từ 29/05/2026 (theo nguồn thứ ba, **chưa xác nhận chính thức**)                     | https://thedataway.info/blog/shopee-chi-phi-quang-cao-tang-2026 | `secondary`                     |
| `ads.min_bid_exact_dong`                          | đồng/click | 400                                                                                                          | https://www.vira.vn/chi-phi-chay-quang-cao-shopee/              | `secondary`                     |
| `ads.min_bid_broad_dong`                          | đồng/click | 480                                                                                                          | cùng nguồn                                                      | `secondary`                     |
| `ads.cpc_benchmark_dong`                          | đồng/click | 400–2.500+ theo ngành; phổ biến 800–2.000                                                                    | vira.vn; thedataway.info                                        | `secondary`                     |
| `ads.cpc_by_category` (2023, chính thức)          | đồng/click | thời trang 200–400 · nhà cửa đời sống 2.000–3.000 · gia dụng 3.000–5.000                                     | https://banhang.shopee.vn/edu/article/16443                     | `verified` nhưng **dated 2023** |
| `ads.cpc_inflation_yoy`                           | %          | +35–40% so với 2024                                                                                          | thedataway.info                                                 | `secondary`                     |
| `ads.ctr_benchmark`                               | %          | 3–5%                                                                                                         | banhang 16443                                                   | `verified`, dated 2023          |
| `ads.roas_target_typical`                         | ×          | 3–5 ("mức trung bình" theo Shopee)                                                                           | banhang 16443                                                   | `verified`, dated 2023          |
| `ads.roas_benchmark_by_margin`                    | ×          | FMCG/đồ ăn vặt 5–12 · gia dụng 3,5–6,5 · mẹ & bé 3–5,5 · thời trang 2,5–4,5 · mỹ phẩm 1,8–3,5 · điện tử 6–12 | https://www.mediaomni.site/blog/benchmark-roas-theo-nganh       | `secondary`                     |
| `ads.break_even_roas`                             | ×          | `1 / contribution_margin_rate` — **suy ra, không phải nguồn**                                                | —                                                               | `assumption` (công thức)        |
| `ads.test_budget_dong_per_day`                    | đồng/ngày  | 50.000–100.000 (pilot) · 100.000–300.000 (shop mới)                                                          | vira.vn; https://dinhdai.tech/blog/quang-cao-tim-kiem-shopee    | `secondary`                     |
| `ads.budget_reserve_days`                         | ngày       | ≥14 (ngân sách ngày × 14)                                                                                    | https://ads.shopee.vn/learn/faq/399/1649                        | `verified`                      |
| `ads.scale_rule_roas_gt`                          | ×          | >5 thì tăng ngân sách                                                                                        | vira.vn                                                         | `secondary`                     |
| `ads.mega_sale_campaign_auto_renew`               | bool       | true — đăng ký một lần, tự áp cho các kỳ Siêu Sale sau                                                       | https://ads.shopee.vn/news/2375                                 | `verified`                      |
| `ads.mega_sale_campaign.requires_auto_topup`      | bool       | true — bắt buộc bật nạp tiền tự động **từ doanh thu đơn hàng**                                               | cùng nguồn                                                      | `verified`                      |
| `ads.mega_sale_campaign.reward_spend`             | %          | 20% trên mục tiêu chi tiêu DVHT                                                                              | cùng nguồn                                                      | `verified`                      |
| `ads.mega_sale_campaign.reward_topup`             | đồng       | tối đa 1.310.000đ, tương đương 25% mục tiêu nạp tự động                                                      | cùng nguồn                                                      | `verified`                      |
| `ads.mega_sale_campaign.reward_expiry`            | ngày       | 30 ngày (ưu đãi chi tiêu) · 7–14 ngày (ưu đãi nạp tự động)                                                   | cùng nguồn                                                      | `verified`                      |
| `ads.mega_sale_campaign.voucher_thong_minh_bonus` | bool       | Có — voucher sàn hỗ trợ tốt hơn khi tham gia                                                                 | cùng nguồn                                                      | `verified`                      |

> **Vì sao ưu đãi ads là lock-in, không phải khuyến mãi:** phần thưởng chỉ nhận được _sau khi_ đạt mục tiêu chi tiêu, có hạn dùng 7–30 ngày, và điều kiện duy trì là bật nạp tiền tự động từ doanh thu. Đó là cấu trúc "cam kết để lấy chiết khấu" — đúng bản chất lock-in. Xem §3.6.

### 3.6 Lock-in chương trình

Phân ba loại, vì cách model khác nhau:

**(a) Lock cứng — có ngày mở khoá**

| Tham số                                        | Đơn vị | Giá trị                                                                                    | Nguồn                                             | Tin cậy    |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------- | ---------- |
| `lockin.voucher_xtra.fee_bps`                  | bps    | 550 (5,5% giá trị mỗi sản phẩm) — _xem ghi chú reconcile bên dưới_                         | https://banhang.shopee.vn/edu/article/18182       | `verified` |
| `lockin.voucher_xtra.cap_dong_per_product`     | đồng   | 50.000                                                                                     | cùng nguồn                                        | `verified` |
| `lockin.voucher_xtra.lock_days`                | ngày   | 15 kể từ ngày kích hoạt thành công                                                         | cùng nguồn                                        | `verified` |
| `lockin.voucher_xtra.exclusive_with_cofunding` | bool   | true — từ 01/10/2025, tham gia gói thì Chính sách Đồng Tài Trợ Mã Ưu Đãi **không** áp dụng | cùng nguồn                                        | `verified` |
| `lockin.cofunding.platform_share_bps`          | bps    | 6.000 (Shopee 60%)                                                                         | banhang article/26053 (theo 02-domain-facts)      | `verified` |
| `lockin.cofunding.seller_share_bps`            | bps    | 4.000 (Shop 40%), trần 50.000đ/sản phẩm từ 23/05/2026                                      | cùng nguồn                                        | `verified` |
| `lockin.freeship_xtra.available`               | bool   | false — ngừng cho shop không phải Mall từ 01/04/2025                                       | article/251, article/21087 (theo 02-domain-facts) | `verified` |

> **Reconcile:** một cross-check song song (`claude-crosscheck.md`) tìm được Voucher Xtra **2%** từ MISA. Tôi giữ **5,5%** vì đó là trang chính thức `article/18182` cập nhật 14-05-2026 và mốc 23/05/2026 khớp với việc Shopee đồng thời nâng đồng tài trợ từ 70/30 lên 60/40. Số 2% nhiều khả năng là mức cũ (hoặc tier gói khác). Nhưng đây là chênh lệch **3,5 điểm** trên giá trị sản phẩm — đủ để đảo ngược kết luận "nên vào hay không vào Voucher Xtra", nên nó phải ở `unverified` cho tới khi đọc lại trang.

**(b) Lock mềm — không khoá ngày nhưng khoá đường ra (rời rồi không vào lại được ngay)**

| Tham số                                                                                    | Giá trị | Nguồn                   | Tin cậy    |
| ------------------------------------------------------------------------------------------ | ------- | ----------------------- | ---------- |
| Ads ngày sale tự gia hạn mỗi kỳ Siêu Sale                                                  | true    | ads.shopee.vn/news/2375 | `verified` |
| Điều kiện duy trì: nạp tiền tự động từ doanh thu                                           | true    | cùng nguồn              | `verified` |
| Huỷ giữa kỳ: vẫn nhận ưu đãi đã đủ điều kiện, nhưng nhận **sau khi** chương trình kết thúc | true    | cùng nguồn              | `verified` |

**(c) Ma sát cấu trúc — tạo xong là không sửa được**

| Tham số                                                                                        | Giá trị | Nguồn                   | Tin cậy     |
| ---------------------------------------------------------------------------------------------- | ------- | ----------------------- | ----------- |
| Combo: không thêm được tier vào combo đã tạo                                                   | true    | shopplus.vn             | `secondary` |
| Mua kèm: không đổi được giờ bắt đầu sau khi tạo                                                | true    | shopplus.vn             | `secondary` |
| Mua kèm: không đổi số lượng giữa chương trình                                                  | true    | shopplus.vn             | `secondary` |
| Flash Sale: slot đã đăng ký bị **giữ tồn kho** đến hết khung, phần chưa bán hoàn về kho sau đó | true    | banhang 27886           | `verified`  |
| Combo/Mua kèm: một SKU chỉ thuộc 1 chương trình tại một thời điểm                              | true    | banhang 92; shopplus.vn | `verified`  |

> **Đây là lý do `lock_until` một mình là chưa đủ.** Ma sát cấu trúc không có ngày hết hạn — nó biến một quyết định xấu thành quyết định _không thể sửa trong suốt chiến dịch_. Schema cần `unwind_cost_dong`, không chỉ ngày.

---

## 4. Guardrail người bán thực dùng + trần pháp lý

### 4.1 Trần pháp lý — đây là guardrail cứng, không thương lượng được

| Tham số                               | Đơn vị | Giá trị                                                                          | Nguồn                                                                                                                                                                                                    | Tin cậy     |
| ------------------------------------- | ------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `legal.max_discount_bps`              | bps    | **5.000** (50% giá ngay trước thời gian khuyến mại)                              | Thông tư 39/2025/TT-BCT Điều 4 khoản 1 — https://thuvienphapluat.vn/hoi-dap-phap-luat/toan-van-thong-tu-392025ttbct-ve-han-muc-va-muc-giam-gia-toi-da-trong-hoat-dong-khuyen-mai-nhu-the--138054395.html | `verified`  |
| `legal.max_discount_concentrated_bps` | bps    | **10.000** (100%) trong chương trình khuyến mại tập trung                        | cùng nguồn, Điều 4 khoản 2                                                                                                                                                                               | `verified`  |
| `legal.max_promo_value_pct_of_goods`  | %      | 50% giá trị hàng dùng để khuyến mại (100% với chương trình tập trung)            | cùng nguồn, Điều 3                                                                                                                                                                                       | `verified`  |
| `legal.exempt_categories`             | enum   | bình ổn giá · thực phẩm tươi sống · phá sản/giải thể/đổi địa điểm/đổi ngành nghề | cùng nguồn, Điều 4 khoản 3                                                                                                                                                                               | `verified`  |
| `legal.effective_from`                | ngày   | 01/07/2025 (Thông tư 39/2025/TT-BCT)                                             | cùng nguồn                                                                                                                                                                                               | `verified`  |
| `legal.price_raise_lead_days`         | ngày   | 7 — muốn tăng giá gốc phải tăng trước ≥7 ngày so với lúc vào khuyến mãi          | https://shopplus.vn/blogs/giai-dap-thac-mac-cau-hoi-lien-quan-ve-vi-pham-dang-ban-gia-ao.html                                                                                                            | `secondary` |
| `legal.fake_price_penalty`            | enum   | Xoá sản phẩm + điểm phạt Sao Quả Tạ                                              | cùng nguồn                                                                                                                                                                                               | `secondary` |

**Ba hệ quả thiết kế — không được bỏ:**

1. **"Khuyến mại tập trung" là điều kiện để được giảm 100%.** Tôi **chưa xác minh** được 11.11/12.12 của Shopee VN có phải chương trình khuyến mại tập trung do cơ quan có thẩm quyền quyết định hay không (xem §7). Vì vậy engine phải có cờ `programme_is_state_approved` thay vì giả định.
2. **Trần 50% áp trên "giá ngay trước thời gian khuyến mại"**, không phải giá niêm yết. Nghĩa là `reference_price_dong` là input bắt buộc, và nó phải đến từ giá _thực bán_, không phải giá gạch ngang shop tự đặt. Đây đúng là chỗ `trust` của Margin Guard có giá trị nhất.
3. **Không được nâng giá gốc rồi hạ** — đây là vi phạm bị xoá sản phẩm, không chỉ là "xấu". Guardrail `max_price_change_bps` hiện có phải chặn được chiều _tăng_ trước chiến dịch, không chỉ chiều giảm.

### 4.2 Guardrail người bán tự đặt — cái gì thực sự được dùng

Không có khảo sát nào công bố các con số này. Tất cả giá trị dưới đây là **cấu trúc** (được practitioner mô tả) — **giá trị số là `assumption`**, dùng làm default, không được trích dẫn như sự thật thị trường.

| Tham số                                    | Đơn vị          | Giá trị mặc định đề xuất                                   | Cơ sở                                                                                                                         | Tin cậy                                    |
| ------------------------------------------ | --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `guardrail.profit_floor_dong`              | đồng/đơn        | Mức sàn lợi nhuận mỗi đơn, không bán dưới kể cả khi sale   | https://edream.vn/tin-tuc/cach-tinh-loi-nhuan-ban-shopee ("đặt một 'mức sàn lợi nhuận' cho mỗi đơn và không bán dưới mức đó") | `secondary` (cấu trúc) / `assumption` (số) |
| `guardrail.min_contribution_margin_bps`    | bps             | 0 – 1.500 tuỳ nhóm hàng (hàng phễu 0, hàng chủ lực ≥1.000) | https://nhanh.vn/cach-tinh-gia-ban-tren-shopee-chuan-cho-nguoi-moi-n156860.html (phân nhóm: phễu / chủ lực / xả kho)          | `assumption`                               |
| `guardrail.max_discount_bps`               | bps             | ≤5.000 (bị luật chặn) và ≤ `max_affordable_discount_bps`   | Thông tư 39/2025 + suy ra                                                                                                     | `verified` (trần) / `assumption` (mức đặt) |
| `guardrail.max_price_change_bps`           | bps             | ±1.000 trong cửa sổ chiến dịch                             | không có nguồn                                                                                                                | `assumption`                               |
| `guardrail.roas_floor`                     | ×               | ≥ `1 / contribution_margin_rate`                           | suy ra từ định nghĩa                                                                                                          | `assumption` (công thức)                   |
| `guardrail.ad_budget_cap_dong`             | đồng/chiến dịch | ≤ `expected_contribution_dong × k`                         | không có nguồn                                                                                                                | `assumption`                               |
| `guardrail.max_voucher_change_bps`         | bps             | 500 — thay đổi voucher tối đa mỗi lần chỉnh                | không có nguồn                                                                                                                | `assumption`                               |
| `guardrail.allow_campaign_exit`            | bool            | true/false — cho phép rời chương trình giữa kỳ             | không có nguồn                                                                                                                | `assumption`                               |
| `guardrail.require_approval_on_committing` | bool            | true — mọi action `committing` phải qua seller             | ADR-0003 / BR-10                                                                                                              | `verified` (nội bộ)                        |

**Ba guardrail mà seller thực sự dùng, theo thứ tự phổ biến (suy luận từ tài liệu practitioner):**

1. **Profit floor theo đơn** — "không bán dưới X đồng lãi/đơn". Đây là dạng phổ biến nhất vì dễ hiểu và dễ kiểm.
2. **Max discount % theo SKU** — thường được đặt bằng "biên gộp trừ phí sàn", tức là _đầu ra_ của phép tính chứ không phải _đầu vào_ chính sách. Đây là lỗ hổng: seller đặt con số bằng cảm tính rồi tưởng nó là chính sách.
3. **Ngân sách ads theo ngày** — dạng guardrail duy nhất seller chỉnh được _trong_ ngày sale, và là dạng duy nhất phát huy tác dụng realtime.

> **Hàm ý cho product:** đừng hỏi seller "max discount của bạn là bao nhiêu?". Hãy hỏi "lãi tối thiểu mỗi đơn là bao nhiêu?" rồi _tính ra_ max discount. `profit_floor_dong` là input; `max_affordable_discount_bps` là output. Đảo ngược hai thứ này là lỗi UX nghiêm trọng nhất có thể mắc.

---

## 5. Bài toán cộng dồn — một đơn hàng, bốn kịch bản

Mục đích: cho thấy **tổ hợp** mới là biến quyết định, không phải từng đòn riêng lẻ. Bảng dưới lấy từ một ví dụ công bố của agency, giữ nguyên giả định của họ và thêm một cột của tôi.

Giả định (theo nguồn): serum niêm yết 400.000đ, COGS 120.000đ, đóng gói+vận hành 8.000đ, Phí Hạ Tầng 3.000đ/đơn, phí cố định 14%, phí xử lý giao dịch 6%, Voucher Xtra 4%, mọi phí tính trên giá sau giảm.
Nguồn giả định: https://adtek.agency/ke-hoach-11-11/ (`secondary`)
Cột 4 do tôi tính thêm, dùng cùng giả định (`assumption`).

| Khoản mục (đồng/đơn)      | Ngày thường · ROAS 8 | 11.11 giảm 30% · ROAS 8 | 11.11 giảm 30% · ROAS 5 | **+ voucher shop 10% · ROAS 5** |
| ------------------------- | -------------------- | ----------------------- | ----------------------- | ------------------------------- |
| Giá bán                   | 400.000              | 280.000                 | 280.000                 | **252.000**                     |
| Phí cố định 14%           | −56.000              | −39.200                 | −39.200                 | **−35.280**                     |
| Phí xử lý giao dịch 6%    | −24.000              | −16.800                 | −16.800                 | **−15.120**                     |
| Voucher Xtra 4%           | −16.000              | −11.200                 | −11.200                 | **−10.080**                     |
| Quảng cáo (GMV ÷ ROAS)    | −50.000              | −35.000                 | −56.000                 | **−50.400**                     |
| COGS + hạ tầng + đóng gói | −131.000             | −131.000                | −131.000                | **−131.000**                    |
| **Lợi nhuận góp**         | **123.000**          | **46.800**              | **25.800**              | **10.120**                      |
| **Biên trên giá bán**     | **30,8%**            | **16,7%**               | **9,2%**                | **4,0%**                        |

Ba điều đọc ra từ bảng này:

1. **Giảm 30% một mình không giết biên** (30,8% → 16,7%). Nó chỉ _thu hẹp_ biên. Đây là lý do seller chủ quan.
2. **ROAS là đòn bẩy mạnh hơn độ sâu giảm giá.** Cùng mức giảm 30%, ROAS 8→5 lấy đi 7,5 điểm biên — gần bằng toàn bộ tác động của việc giảm giá 30%. Trong ngày sale, CPC tăng 35–40% và đấu thầu đông hơn: ROAS 5 là kịch bản _lạc quan_, không phải bi quan.
3. **Cái giết là cộng dồn, không phải từng đòn.** Thêm một voucher shop 10% lên một kịch bản đã mỏng đưa biên về 4% — vẫn "lãi" trên báo cáo, nhưng một đơn hoàn là âm. Đây chính là điểm mù mà `compute_order_profit` tồn tại để bịt.

**Quy tắc rút ra (đề xuất làm mặc định trong engine):** không cho phép đề xuất một tổ hợp mà `contribution_margin_bps` sau cộng dồn < `guardrail.min_contribution_margin_bps`. Trả `out_of_bounds` kèm _tổ hợp nào_ đã đẩy nó xuống, không chỉ nói "vượt ngưỡng".

---

## 6. Đối chiếu Lazada / TikTok Shop (chỉ phần ảnh hưởng đến chiến lược)

| Tham số                         | Shopee                                      | TikTok Shop                                           | Lazada                           | Tin cậy                                                                                                                  |
| ------------------------------- | ------------------------------------------- | ----------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Phí giao dịch / xử lý           | 6% (từ 01/05/2026)                          | 6% (từ 09/05/2026)                                    | 6% (từ 26/05/2026)               | `secondary` — https://sapso.vn/blog/phi-ban-hang-shopee-tiktok-shop-lazada-2026                                          |
| Phí cố định/đơn                 | 3.000đ (Phí Hạ Tầng)                        | 3.000đ/đơn                                            | 3.000đ/đơn                       | cùng nguồn                                                                                                               |
| Hoa hồng ngành                  | 10–17,8% (shop thường)                      | mặc định 14% (chuẩn) / 16% (Mall); có ngành tới 19,8% | 3,3–4,4% (thường) / 5–12% (Mall) | cùng nguồn; https://stockbiz.vn/.../41270060                                                                             |
| Gói voucher trả phí             | Voucher Xtra 5,5%, trần 50.000đ/SP          | Voucher Extra 4%, trần 50.000đ/SP                     | Voucher Max                      | sapso.vn; https://adtek.agency/ke-hoach-11-11/                                                                           |
| Affiliate/KOC                   | AMS, min 6% (điện tử 2–4%) — _nguồn SG_     | 10–25% hoa hồng creator                               | —                                | https://seller.shopee.sg/edu/article/20072 (`secondary`, **SG**); https://www.dataglasslabs.com/blog/race-to-zero-margin |
| Tổng phí thực tế trên doanh thu | ~22–30% nếu dùng Voucher Xtra               | ~22,5–32%                                             | ~18–25%                          | https://loinhuan.com/blog/so-sanh-phi-san-shopee-tiktok (`secondary`)                                                    |
| Đòn tăng trưởng chính           | Flash Sale + Combo + Mua kèm + Ads tìm kiếm | Livestream + Affiliate + video                        | Voucher + Freeship               | 2025 market reports (`secondary`)                                                                                        |

**Khác biệt chiến lược quan trọng nhất:** trên TikTok Shop, chi phí biến đổi lớn nhất là **hoa hồng creator**, không phải ads. Với 10–25% hoa hồng + 14–16% hoa hồng nền tảng + 6% giao dịch + 3.000đ, một SKU biên 30% **không thể** chạy affiliate có lãi. Nghĩa là cùng một SKU, "chiến lược tối ưu" khác nhau theo sàn — và đó là lý do model phải có `channel` ở cấp đơn, không chỉ ở cấp campaign.

---

## 7. Những gì **chưa** xác minh được (và tại sao quan trọng)

| #   | Chưa xác minh                                                                                                                                                                                | Vì sao quan trọng                                                                                                                                                       | Cách đóng                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| S1  | **Hạn chót đề cử và mức giảm tối thiểu của 11.11/12.12 trên Shopee VN.** Chỉ tìm được bản SG (11.11 Big Sale 30/10–17/11, hạn 29/10 17:00, price teaser ≥4% dưới giá thấp nhất tháng trước). | Nếu VN yêu cầu mức giảm tối thiểu để được duyệt, đó là **ràng buộc cứng** lên `max_discount_bps`, không phải lựa chọn của seller.                                       | Đọc trực tiếp Kênh Người Bán → Kênh Marketing → Chương trình Shopee trong cửa sổ 11.11. Không có đường public.       |
| S2  | **11.11/12.12 của Shopee VN có phải "chương trình khuyến mại tập trung" theo Thông tư 39/2025 hay không.**                                                                                   | Quyết định trần là 50% hay 100%. Nếu không phải, mọi mức giảm >50% là vi phạm — kể cả khi sàn cho phép.                                                                 | Tra quyết định của Bộ Công Thương / Sở Công Thương về chương trình khuyến mại tập trung 2026. Chưa tìm được văn bản. |
| S3  | **Mô hình tính phí ads hiện hành: CPC hay CPM từ 29/05/2026**, và khoản "Duy trì hiển thị 1% doanh thu" có đang hiệu lực hay đã hoãn.                                                        | Đổi CPC→CPM làm chi phí phát sinh cả khi không click → đổi hẳn cấu trúc `ads` trong waterfall. Một nguồn nói 1% đã bị hoãn sau khi Uỷ ban Cạnh tranh Quốc gia vào cuộc. | Trang ads.shopee.vn/learn hoặc thông báo trong Kênh Người Bán.                                                       |
| S4  | **Bảng CPC/CPM thực tế VN 2026.** Mọi con số đều từ agency, không có rate card chính thức.                                                                                                   | Là biến chi phí lớn nhất (§5). Sai 2× ở đây làm sai toàn bộ kết luận.                                                                                                   | Không có nguồn public. Phải dùng range + `verification_status = unverified`.                                         |
| S5  | **Giá trị profit floor / max discount mà seller VN thực dùng.** Không có khảo sát.                                                                                                           | Toàn bộ §4.2 là cấu trúc đúng, số là placeholder.                                                                                                                       | Khảo sát 5–10 seller, hoặc lấy từ chính người dùng đầu tiên.                                                         |
| S6  | **Cơ chế mega-sale của TikTok Shop VN** (mức giảm tối thiểu, lịch đề cử, voucher đồng tài trợ).                                                                                              | Cần nếu so sánh đa sàn là tính năng thật, không chỉ là slide.                                                                                                           | TikTok Shop Academy VN.                                                                                              |
| S7  | **Hoa hồng AMS/affiliate trên Shopee VN.** Chỉ có trang SG (min 6%, điện tử 2–4%, co-sponsor tới 10% cho Live).                                                                              | Nếu VN khác, mọi so sánh với TikTok Shop sai.                                                                                                                           | banhang.shopee.vn mục Tiếp thị liên kết.                                                                             |
| S8  | **Shopee VN có cơ chế early-access cho thành viên trả phí (kiểu ShopeeVIP ở SG) hay không.**                                                                                                 | Ảnh hưởng đến việc giá sale bị lộ trước D-1 và do đó đến cửa sổ cạnh tranh.                                                                                             | Chỉ có bằng chứng SG.                                                                                                |
| S9  | **Lazada: phí xử lý 4,903% hay 6%.** Hai nguồn thứ ba nói khác nhau (4,903% từ 01/07/2025 vs 6% từ 26/05/2026).                                                                              | Nếu Lazada là kênh so sánh, chênh 1,1 điểm là đủ đổi kết luận trên SKU biên mỏng.                                                                                       | Trung tâm hỗ trợ người bán Lazada, trang "Phí Lazada".                                                               |
| S10 | **Số liệu 2026.** Toàn bộ §1 là 2025 (nguồn công bố tháng 1–3/2026). Chưa có báo cáo Q3/2026.                                                                                                | Dùng làm neo thì phải ghi rõ là neo lịch sử, không phải hiện trạng.                                                                                                     | Chờ Metric/YouNet ECI báo cáo Q3/2026.                                                                               |
| S11 | **Voucher Xtra 5,5% hay 2%.** Cross-check song song tìm được 2% (MISA, `secondary`); trang chính thức đọc được ghi 5,5% từ 23/05/2026.                                                       | Chênh 3,5 điểm giá trị sản phẩm — đủ để đảo kết luận vào/không vào gói, và do đó đảo cả `lockin.unwind_cost_dong`.                                                      | Đọc lại `article/18182` + trang tổng hợp phí trong Kênh Người Bán ngay trước demo.                                   |

**Điều tôi cố tình không làm:** không suy ra "mức giảm trung bình ngày 11.11" từ bất kỳ nguồn nào. Không nguồn nào trong số tìm được công bố phân phối độ sâu giảm giá thực tế theo SKU; mọi con số kiểu "giảm 30–50% ngày sale" là quan sát phía người mua trên trang chủ, không phải dữ liệu giao dịch. Đưa nó vào model sẽ là bịa số có vỏ bọc.

---

## 8. Đề xuất field bổ sung cho schema

Năm gạch đầu dòng, mỗi dòng là một entity hoặc một nhóm field còn thiếu để model được lớp strategy:

- **`campaign_lever` (entity mới)** — hôm nay schema chỉ có `campaign` + `voucher`; thiếu chính _đòn_. Cần: `lever_type` (`flash_sale`/`combo`/`addon`/`ads`/`lockin`), `funding_split` (`seller_bps`/`platform_bps`/`cofund_bps`), `budget_cap_dong`, `expected_uplift_bps`, `stacks_with[]` (danh sách lever được cộng dồn), `excludes[]`. Không có `stacks_with`/`excludes` thì engine không thể biết tổ hợp nào _tồn tại được_, và sẽ đề xuất một cấu hình mà sàn từ chối duyệt.
- **`campaign_lever.slot_allocation`** — Flash Sale giữ tồn kho theo slot (trần 2.000 slot/SKU, công thức slot = số lượng × số phân loại). Cần `sku_id`, `slot_id`, `qty_reserved`, `reserved_until`, `unsold_return_at`. Tồn kho bị giữ là _chi phí cơ hội_ thật trong ngày sale, và hiện không có chỗ nào trong 16 dòng waterfall phản ánh nó.
- **`guardrail.max_affordable_discount_bps`** (computed, không phải input) + **`guardrail.roas_floor`** + **`guardrail.price_raise_lead_days`**. Schema hiện có `max_price_change_bps` nhưng chỉ chặn được chiều giảm; cần chặn cả chiều _tăng giá trước chiến dịch_ (luật: ≥7 ngày, vi phạm = xoá sản phẩm + điểm Sao Quả Tạ). Và `max_discount_bps` phải là output của `profit_floor_dong`, không phải một ô seller tự điền.
- **`legal_discount_ceiling` (entity mới, versioned như `fee_schedule`)** — `max_discount_bps` 5.000, `concentrated_programme_bps` 10.000, `programme_is_state_approved` (bool), `decision_document_url`, `effective_from`. Đây là ràng buộc _pháp lý_, không phải _chính sách seller_: nó phải chặn ở tầng engine và render lý do, không được để seller tự nới. Hiện `verification_status` có thể tái dùng nguyên.
- **`lockin_commitment`** — thay vì chỉ `programme_enrolment.lock_until`, cần: `lock_kind` (`hard_date`/`soft_autorenew`/`structural_immutable`), `lock_until`, `unwind_cost_dong` (chi phí thoát: mất ưu đãi đã tích luỹ, mất trợ giá, mất slot), `auto_renew` (bool), `exit_penalty_desc`. Voucher Xtra khoá 15 ngày và loại trừ đồng tài trợ; chương trình ads ngày sale tự gia hạn và buộc nạp tiền tự động từ doanh thu — cả hai là _committing_, và cả hai hiện chỉ được biểu diễn bằng một cột ngày.

---

### Phụ lục — nguồn chính thức đã đọc trực tiếp

| Chủ đề                                                                         | URL                                                                                                                                                             | Trạng thái                       |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Flash Sale đề xuất bởi Shopee (trợ giá, DTS, phê duyệt ≥4 ngày, huỷ)           | https://banhang.shopee.vn/edu/article/27886                                                                                                                     | `verified`                       |
| Điều kiện tham gia Shopee Flash Sale                                           | https://banhang.shopee.vn/edu/article/15976                                                                                                                     | `verified`                       |
| Combo Khuyến Mãi (3 loại, 3 tier, không chạy cùng Flash Sale)                  | https://banhang.shopee.vn/edu/article/92                                                                                                                        | `verified`                       |
| Mua Kèm Deal Sốc — cách tạo                                                    | https://banhang.shopee.vn/edu/article/2276                                                                                                                      | `verified`                       |
| Mua Kèm Deal Sốc — định nghĩa, tách đơn, hoàn phí quà tặng                     | https://banhang.shopee.vn/edu/article/1003                                                                                                                      | `verified`                       |
| Cấu hình voucher shop (5 ký tự, 3 tháng, max 5 lượt/người mua, cap bắt buộc)   | https://banhang.shopee.vn/edu/article/2356                                                                                                                      | `verified` (qua 02-domain-facts) |
| Voucher Xtra 5,5% cap 50k, khoá 15 ngày, loại trừ đồng tài trợ                 | https://banhang.shopee.vn/edu/article/18182                                                                                                                     | `verified`                       |
| Tổng hợp công cụ marketing của shop                                            | https://banhang.shopee.vn/edu/article/2352                                                                                                                      | `verified`                       |
| Ads: chọn phương thức đấu thầu, ngân sách 14 ngày                              | https://ads.shopee.vn/learn/faq/399/1649                                                                                                                        | `verified`                       |
| Ads: mục tiêu ROAS                                                             | https://ads.shopee.vn/learn/faq/396/1642                                                                                                                        | `verified`                       |
| Ads: chương trình ngày sale, nạp tự động, tự gia hạn, thưởng 20%/25%           | https://ads.shopee.vn/news/2375                                                                                                                                 | `verified`                       |
| Ads: kinh nghiệm chạy quảng cáo (CPC theo ngành, CTR 3–5%, ROI 3–5)            | https://banhang.shopee.vn/edu/article/16443                                                                                                                     | `verified` (2023, dated)         |
| Giá Flash Sale giữ kín đến khi mở khung                                        | https://help.shopee.vn/portal/4/article/79506                                                                                                                   | `verified`                       |
| Thông tư 39/2025/TT-BCT — trần giảm giá 50% / 100%, hạn mức giá trị khuyến mại | https://thuvienphapluat.vn/hoi-dap-phap-luat/toan-van-thong-tu-392025ttbct-ve-han-muc-va-muc-giam-gia-toi-da-trong-hoat-dong-khuyen-mai-nhu-the--138054395.html | `verified`                       |
| Nghị định 128/2024/NĐ-CP sửa NĐ 81/2018 (giá "ngay trước" khuyến mại)          | https://vcci.com.vn/legal-document/128-2024-nd-cp                                                                                                               | `verified`                       |
| SG: 11.11 campaign checklist, price teaser ≥4%, hạn đề cử                      | https://seller.shopee.sg/edu/article/27323                                                                                                                      | `secondary` (SG)                 |
| SG: AMS min commission 6%, indirect order 30%                                  | https://seller.shopee.sg/edu/article/20072                                                                                                                      | `secondary` (SG)                 |
