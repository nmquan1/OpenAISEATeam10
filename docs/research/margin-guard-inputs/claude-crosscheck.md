# Margin Guard inputs — CROSS-CHECK + datasets (claude)

Ngày: 2026-10-31 · Time-box 15' · Nguồn đọc qua WebSearch/WebFetch. Chưa scrape được banhang.shopee.vn trực tiếp trong phiên này.
Mức tin cậy: **verified** = nguồn chính thức/cơ quan nhà nước · **secondary** = aggregator (MISA, Sapo, BigSeller, GHN…) · **assumption** = giả định của tôi, phải xác minh.

## 1. Cross-check với `02-domain-facts.md`

| Field | Giá trị trong 02-domain-facts | Giá trị tìm được hôm nay | Khớp? | Nguồn | Tin cậy |
|---|---|---|---|---|---|
| `transaction_fee_bps` (Phí Xử Lý Giao Dịch) | 6% gồm VAT, đổi tên 24/04/2026 | COD: 4.91% → **6% từ 01/05/2026**; đổi tên 24/04/2026; cơ sở tính = giá SP trước trợ giá Shopee + phí ship người mua trả − KM của người bán/ngân hàng | ✅ (bổ sung cơ sở tính + mốc 01/05) | https://www.misaeshop.vn/24423/phi-san-shopee/ | secondary |
| Rate các phương thức thanh toán khác (CK, NAPAS, SPayLater, ShopeePay) | — | Bảng trên trang bị trống, **chưa xác minh được** | ⚠️ gap | như trên | — |
| `commission_bps` non-Mall | Nhà cửa & Đời sống 10–16% | Tiêu dùng nhanh 11% → 10%; Nhà cửa & Đời sống 11.5% → 10.5% (từ 01/05/2026) | ⚠️ phần nào lệch, cần bảng chính thức theo ngành con | misaeshop (trên) | secondary |
| `commission_bps` Mall (từ 06/06/2025) | — | Sắc đẹp 8.10%, Sách 6.00%, Thời trang 7.00–8.10%, Đồ chơi 3.50–7.00% | mới | misaeshop | secondary |
| Điều chỉnh Phí Cố Định/Phí XLGD tháng 5/2026 | — | Có điều chỉnh theo ngành, nhưng số nằm trong ảnh, **không trích được** | gap | https://www.sapo.vn/blog/cap-nhat-phi-san-tmdt-thang-5-2026 | secondary |
| `infra_fee_dong` (Phí Hạ Tầng) | **không có** | **3.000đ/đơn**, đơn tạo từ 01/07/2025, gồm VAT | ❌ thiếu trong schema | misaeshop | secondary |
| `voucher_xtra_bps` | 4% (cap 50k), ghi "conflicting" | **2%, cap 50.000đ/SP từ 06/06/2025** (trước đó 3%) | ❌ lệch — 4% có thể là số cũ | misaeshop | secondary |
| `content_xtra_bps` | không có | 3%, cap 50.000đ/SP từ 06/06/2025 | mới | misaeshop | secondary |
| Freeship Xtra | 8% | Trang không ghi rate người bán | chưa xác minh | misaeshop | — |
| Thuế khấu trừ hộ kinh doanh | không có | 1.5% doanh thu (1% GTGT + 0.5% TNCN); BigSeller nói GTGT giảm còn 8% (cho Shopee?) từ 05/2026 — chưa đọc được | ❌ thiếu | misaeshop; https://www.bigseller.com/blog/articleDetails/4536/thue-gtgt-shopee.htm | secondary |
| "Chương trình Duy trì hiển thị" | không có | 1% doanh thu đơn thành công (trước VAT), người bán chỉnh 1–50%, dự kiến 29/05/2026 — **Shopee đề xuất hoãn** sau yêu cầu của Ủy ban Cạnh tranh Quốc gia (27–28/05/2026) | mới, trạng thái hoãn | https://tapchikinhtetaichinh.vn/yeu-cau-shopee-khong-ap-dung-cac-loai-phi-moi-doi-voi-nguoi-ban-hang-tren-nen-tang-157445.html | verified (báo của Bộ Tài chính trích UBCTQG) |
| TikTok Shop phí hoa hồng nền tảng | — | Cập nhật theo ngành từ 09/05/2026 (số trong ảnh) | gap | Sapo (trên) | secondary |
| Đồng tài trợ voucher sàn 60/40 | 60/40 | Không tìm được nguồn thứ hai hôm nay | chưa cross-check | — | — |

**Kết luận cross-check:** Có 2 số trong 02-domain-facts có thể sai/cũ (Voucher Xtra 4% → khả năng là 2%; cách tính Phí Cố Định từng ngành). Thiếu 2 khoản thật sự trừ vào đơn: Phí Hạ Tầng 3.000đ/đơn và thuế khấu trừ 1.5%. Mọi số vẫn chỉ là secondary cho đến khi đọc banhang.shopee.vn/edu.

## 2. Dataset / case study công khai

| Nguồn | Có gì | Dùng được cho Margin Guard? | URL |
|---|---|---|---|
| Kaggle "Shopee – Price Match Guarantee" (2021) | Ảnh + tiêu đề SP để ghép SP trùng; **không có** giá/voucher | Không cho margin; có thể dùng để match SKU đối thủ | (tham chiếu qua) https://albumentations.ai/adoption/verticals/retail-ecommerce/competitions/ |
| luminati-io/Shopee-dataset-samples (GitHub) | 1.001 SP mẫu, chỉ id/title/url | Không | https://github.com/luminati-io/Shopee-dataset-samples |
| Bright Data Shopee Promotions Tracker | Thương mại, theo dõi KM | Có thể, nhưng trả phí | https://brightdata.com/products/insights/promotions-tracker/shopee |
| Actowiz Shopee product dataset | Thương mại: giá gốc, giá hiện tại, % giảm | Có thể, trả phí | https://www.actowizsolutions.com/datasets/details/shopee-product-dataset |
| Dataset "Shopee Thailand" trong bài DEV (cột `price_before_discount`, `historySold`) | TH, không phải VN; nguồn gốc không rõ | Chỉ làm mẫu schema | https://dev.to/easydata/how-to-clean-and-normalize-shopee-dataset-for-accurate-insights-2jp5 |

**Không tìm được** dataset công khai nào về voucher Shopee VN, hay case study lợi nhuận của seller có số liệu đơn hàng thật. Các bài của MISA/Sapo/BigSeller chỉ có bảng phí, không có ví dụ tính đủ. → Demo nên dùng **dữ liệu tổng hợp (synthetic)** và gắn nhãn rõ ràng.

## 3. Ví dụ tính đầy đủ: 1 đơn có voucher stack → net profit

Giả định (**assumption** trừ khi có ghi chú): shop thường (non-Mall), ngành Nhà cửa & Đời sống; 1 SP; giá niêm yết 299.000đ; giá vốn (COGS) 150.000đ; đóng gói 5.000đ; người mua thanh toán COD, Freeship không tính phí người bán.
Voucher stack: **Voucher shop** giảm 10%, tối đa 20.000đ + **Voucher sàn** 30.000đ.
Giả định cơ sở tính: Phí Cố Định, Phí XLGD và thuế đều tính trên giá sau voucher shop (279.000đ), đúng với mô tả cơ sở Phí XLGD của MISA; với Phí Cố Định và thuế thì đây là **assumption**.

| # | Dòng | Công thức | Số tiền (đ) | Nguồn số |
|---|---|---|---|---|
| 1 | Giá niêm yết | | +299.000 | input |
| 2 | Voucher shop (10%, cap 20k) | min(29.900; 20.000) | −20.000 | input |
| 3 | Giá sau voucher shop (= cơ sở phí) | | 279.000 | — |
| 4 | Voucher sàn: phần shop đồng tài trợ 40% | 30.000 × 40% | −12.000 | 02-domain-facts (secondary) |
| 5 | Phí Cố Định 10.5% | 279.000 × 10.5% | −29.295 | misaeshop (secondary) |
| 6 | Phí XLGD 6% | 279.000 × 6% | −16.740 | misaeshop (secondary) |
| 7 | Phí Hạ Tầng | cố định | −3.000 | misaeshop (secondary) |
| 8 | Thuế khấu trừ 1.5% | 279.000 × 1.5% | −4.185 | misaeshop (secondary) |
| 9 | **Tiền shop nhận về** | 3 − (4..8) | **213.780** | — |
| 10 | COGS + đóng gói | | −155.000 | input |
| 11 | **Lợi nhuận ròng (kịch bản A)** | | **+58.780** (19,7% giá niêm yết) | — |

**Kịch bản B — shop tham gia Voucher Xtra (2%, cap 50k/SP):** theo banhang.shopee.vn/edu/article/18182, khi đó *không* áp dụng đồng tài trợ → bỏ dòng 4 (−12.000), thêm 279.000 × 2% = −5.580 → **net +65.200**. Ở đơn này, Voucher Xtra *lợi hơn* co-funding 6.420đ. Nếu dùng số 4% trong 02-domain-facts thì phí là −11.160 và chênh lệch chỉ còn 840đ, nên quyết định phụ thuộc trực tiếp vào số chưa xác minh này.

**Ngưỡng hòa vốn của voucher shop (kịch bản A):** gọi d là mức giảm của voucher shop. Net = (299.000 − d) × (1 − 0,18) − 12.000 − 3.000 − 155.000 = 75.180 − 0,82d. Ta có net = 0 khi d ≈ **91.680đ** (~30,7% giá). Vì vậy guardrail `profit_floor_dong` nên chặn d trước mức này.

Kiểm tra tổng: 299.000 − 20.000 − 12.000 − 29.295 − 16.740 − 3.000 − 4.185 − 155.000 = 58.780 ✅

## 4. Chưa xác minh được
- Rate Phí XLGD cho các phương thức không phải COD; bảng Phí Cố Định đầy đủ theo ngành con sau tháng 5/2026 (Sapo chỉ có ảnh).
- Cơ sở tính Phí Cố Định và thuế: trước hay sau voucher shop/voucher sàn?
- Voucher Xtra 2% hay 4%; rate Freeship Xtra; đồng tài trợ 60/40 (chưa có nguồn thứ 2).
- Thuế: 1.5% hay mức đã thay đổi (GTGT 8% từ 05/2026 theo BigSeller — chưa đọc được bài, fetch bị timeout).
- Trạng thái "Duy trì hiển thị" sau khi hoãn (có áp lại không?).
- Bảng phí TikTok Shop từ 09/05/2026 (chỉ có trong ảnh).

## 5. Đề xuất field bổ sung cho schema
- `fee_schedule_item` key `infra_fee_per_order` (`value_dong`=3000, `basis`=per_order) — hiện thiếu hẳn trong waterfall.
- `fee_schedule_item` key `seller_tax_withholding` (`value_bps`=150, tách `vat_bps`/`pit_bps`) + cờ `seller_entity_type` (hộ KD/doanh nghiệp), vì doanh nghiệp không bị khấu trừ kiểu này.
- `fee_schedule_item.base_rule` (enum: `list_price` / `after_seller_voucher` / `after_all_vouchers` / `plus_buyer_shipping`) — cơ sở tính khác nhau giữa các loại phí và làm net thay đổi hàng nghìn đồng mỗi đơn.
- `fee_schedule_item.payment_method` (COD/bank/NAPAS/SPayLater/ShopeePay), vì Phí XLGD có thể khác nhau theo phương thức thanh toán; thêm `order.payment_method`.
- `programme_enrolment.programme` mở rộng thêm `content_xtra` và `display_maintenance` (kèm `rate_bps` do seller chọn 100–5000), cùng `status` (`active`/`postponed`) để biểu diễn các phí đang bị cơ quan quản lý tạm dừng.
