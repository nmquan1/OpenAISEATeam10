# PRICING — input cho Margin Guard (VN 2025–2026)

Phạm vi: phí cố định / hoa hồng theo ngành, phí thanh toán, phí dịch vụ, thuế hộ kinh doanh khấu trừ tại nguồn, phí vận chuyển, COGS / đóng gói, quy tắc giá campaign (giá gạch, giới hạn tăng giá trước sale). Shopee là nguồn chính. Lazada và TikTok Shop chỉ để so sánh.

Ngày đối chiếu: 2026-10-31. Trang `banhang.shopee.vn` là ứng dụng JS; số liệu dưới đây lấy từ nội dung bài Học viện Shopee mà công cụ tìm kiếm đã render, không phải từ việc đọc hết PDF đính kèm. Ô nào không xuất hiện trong phần đã đọc thì **không điền số**.

Mức tin cậy dùng đúng yêu cầu brief: `verified` (trang chính thức, số đọc được), `secondary` (luật sư / báo / blog dẫn nguồn, không đọc văn bản gốc), `assumption` (suy ra, không có câu chữ nguồn).

Schema đang có và các field này bám vào: `category.commission_bps`, `sku.list_price` / `cogs` / `packaging_cost` / `weight_g`, `fee_schedule_item` (`key`, `value_bps` hoặc `value_dong`, `cap_dong`, `basis` = `per_product` | `per_order`), `guardrail.max_price_change_bps`. Nhiều khoản dưới đây **không cùng một cơ sở tính**.

---

## 1. Phí cố định Shopee (hoa hồng theo ngành)

Định nghĩa, người bán không Mall: hoa hồng trên **từng sản phẩm**, đã gồm thuế GTGT, đơn "Đã giao" hoặc trả hàng/hoàn tiền được chấp nhận hoàn tiền ngay, trừ lý do "Chưa nhận được hàng". Cấn trừ trước khi tiền về Số dư TK Shopee.

| Field                            | Đơn vị | Giá trị                                                                  | Hiệu lực                                                                                     | Tin cậy                     | Nguồn                                                                                    |
| -------------------------------- | ------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| `commission.basis`               | —      | trên giá trị mỗi sản phẩm, theo biểu ngành; VAT-inclusive                | 23/05/2026                                                                                   | verified                    | https://banhang.shopee.vn/edu/article/2139 ; https://banhang.shopee.vn/edu/article/27540 |
| `commission.excludes_shipping`   | bool   | không gồm cước vận chuyển và phí khác người bán trả Shopee               | ghi rõ trên bản 29/12/2025; câu này **không** lặp lại trong đoạn chú thích 23/05/2026 đã đọc | verified cho bản 29/12/2025 | https://banhang.shopee.vn/edu/article/26526                                              |
| `commission.non_mall.floor`      | %      | từ 1,50% (sàn, không phải một mức cho mọi ngành)                         | 23/05/2026                                                                                   | verified                    | https://banhang.shopee.vn/edu/article/25329                                              |
| `commission.mall.floor`          | %      | từ 1,50%                                                                 | 29/05/2026                                                                                   | verified                    | https://banhang.shopee.vn/edu/article/25329                                              |
| `commission.vat_rate_inside_fee` | %      | phí niêm yết đã gồm GTGT; GTGT trên phí dịch vụ của Shopee giảm 10% → 8% | 01/07/2025–31/12/2026                                                                        | verified                    | https://banhang.shopee.vn/edu/article/25329 (NQ 204/2025/QH15)                           |

### 1.1 Mức đứng, người bán không Mall, từ 23/05/2026

Chỉ những dòng đọc được trên bài 27540. Cột "trước" là mức ngay trước 23/05/2026. Dải % là dải ngành con, không phải một SKU được chọn trong khoảng đó.

| Field gợi ý                                       | Ngành đã đọc                                                    | Trước 23/05/2026                      | Từ 23/05/2026    | Tin cậy                      |
| ------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- | ---------------- | ---------------------------- |
| `commission.non_mall.mom_baby.baby_skincare`      | Mẹ & Bé › chăm sóc da bé                                        | 11,50%                                | **10,50%**       | verified                     |
| `commission.non_mall.mom_baby.bath_body`          | Mẹ & Bé › đồ dùng phòng tắm & chăm sóc cơ thể (dòng bị cắt chữ) | 11,00–11,50%                          | **10,00–10,50%** | verified, nhãn cấp 3 chưa đủ |
| `commission.non_mall.beauty`                      | Sắc Đẹp (cả ngành cấp 1 trong một dòng)                         | 14,00%                                | **17,00%**       | verified                     |
| `commission.non_mall.health`                      | Sức Khỏe                                                        | 12,50–14,00%                          | **15,50–17,00%** | verified                     |
| `commission.non_mall.fmcg_rest`                   | Các ngành tiêu dùng nhanh còn lại                               | 10,00–13,00%                          | **11,00–16,00%** | verified                     |
| `commission.non_mall.home.cleaning`               | Nhà cửa › chất tẩy, phụ kiện giặt là, giấy vệ sinh              | 10,50%                                | **10,50%**       | verified                     |
| `commission.non_mall.motorbike`                   | Mô tô, xe máy                                                   | 1,50%                                 | **1,50%**        | verified                     |
| `commission.non_mall.auto`                        | Ô tô                                                            | (thấy ở cột "đứng" của bảng giảm phí) | **3,50%**        | verified                     |
| `commission.non_mall.books`                       | Sách & Tạp Chí                                                  |                                       | **14,00–15,00%** | verified                     |
| `commission.non_mall.hobbies`                     | Sở thích & Sưu tầm                                              |                                       | **15,00–17,00%** | verified                     |
| `commission.non_mall.stationery`                  | Văn phòng phẩm                                                  |                                       | **11,00–16,00%** | verified                     |
| `commission.non_mall.home_rest`                   | Nhà cửa & đời sống còn lại                                      |                                       | **13,00–16,00%** | verified                     |
| `commission.non_mall.fashion`                     | Thời trang                                                      |                                       | **13,50–16,50%** | verified                     |
| `commission.non_mall.pet`                         | Chăm sóc thú cưng                                               |                                       | **14,00%**       | verified                     |
| `commission.non_mall.grocery.oil_seasoning_sugar` | Dầu ăn, gia vị & hương liệu, đường                              |                                       | **10,00%**       | verified                     |
| `commission.non_mall.grocery.fresh`               | Thực phẩm tươi sống & đông lạnh (thịt, rau củ)                  |                                       | **10,00%**       | verified                     |
| `commission.non_mall.grocery.eggs`                | Sữa – trứng › trứng                                             |                                       | **10,00%**       | verified                     |
| `commission.non_mall.electronics.tv`              | Tivi & phụ kiện                                                 | 7,50–8,00%                            | **7,50–8,00%**   | verified                     |
| `commission.non_mall.electronics.gaming`          | Gaming & Console                                                | 7,50–10,00%                           | **8,50–12,00%**  | verified                     |
| `commission.non_mall.electronics.audio`           | Thiết bị âm thanh                                               | 8,00–10,00%                           | **10,00–12,00%** | verified                     |
| `commission.non_mall.electronics.voucher_service` | Voucher & Dịch vụ (nhóm điện tử)                                | 11,00%                                | **13,00%**       | verified                     |
| `commission.non_mall.electronics.laptop_monitor`  | Laptop, màn hình                                                |                                       | **2,00%**        | verified                     |
| `commission.non_mall.electronics.desktop`         | Máy tính bàn                                                    |                                       | **2,00–2,50%**   | verified                     |
| `commission.non_mall.electronics.drawing_tablet`  | Chuột & bàn phím › bảng vẽ điện tử                              |                                       | **6,00%**        | verified                     |

Nguồn cả bảng: https://banhang.shopee.vn/edu/article/27540 (đăng 28/05/2026). Bảng đầy đủ cấp 3 nằm trên bài đó và file đính kèm; pass này không đọc hết. Một dòng "7,50–11,00% → 8,50–15,00%" bị mất nhãn ngành ở đầu — **không gán** vào field nào.

Bảng Mall cấp 3 từ 29/05/2026: bài https://banhang.shopee.vn/edu/article/21087 vẫn đang hiển thị phí thanh toán 4,91% và Voucher Xtra 4% (bản 15/12/2025), tức **cũ hơn** đợt 05/2026. Không lấy số Mall từ bài đó. Không lấy bảng Mall của blog GHN: cùng bài GHN vẫn ghi Voucher Xtra 4% trong khi Shopee Uni đã ghi 5,5%.

### 1.2 Lớp giảm phí có thời hạn (chồng lên mức đứng)

| Field                       | Đơn vị | Giá trị                                     | Cửa sổ                                           | Tin cậy  | Nguồn                                       |
| --------------------------- | ------ | ------------------------------------------- | ------------------------------------------------ | -------- | ------------------------------------------- |
| `commission.promo.lt_6pct`  | hệ số  | giảm **50%** phí cố định nếu mức đứng < 6%  | 01/06/2026–31/08/2026                            | verified | https://banhang.shopee.vn/edu/article/27540 |
| `commission.promo.gte_6pct` | điểm % | giảm **3 điểm phần trăm** nếu mức đứng ≥ 6% | cùng cửa sổ, "hoặc thời hạn khác theo thông báo" | verified | cùng bài                                    |

Kiểm tra chéo trên chính bảng giảm của bài 27540: Sắc Đẹp 17% → 14% (−3 điểm); mô tô 1,50% → 0,75% (đúng 50%); ô tô 3,50% → 1,75%; laptop 2% → 1%; bảng vẽ 6% → 3% (đúng nhánh ≥ 6%, −3 điểm). "Giảm 3%" trong câu chữ Shopee là **3 điểm phần trăm**, không phải 3% của số phí.

Báo chí nói thêm "nhà bán mới được miễn phí cố định 30 ngày". Câu đó **không** có trong đoạn bài 27540 đã đọc. Không đưa vào field.

---

## 2. Phí thanh toán / phí xử lý giao dịch

Từ 24/04/2026 Shopee đổi tên **Phí Thanh Toán** thành **Phí Xử Lý Giao Dịch** cho khớp hóa đơn.

| Field                   | Đơn vị           | Giá trị                                                                                                                             | Tin cậy                                   | Nguồn                                                                                                                                 |
| ----------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `txn_fee.rate`          | % trên cơ sở đơn | **6%**, đã gồm GTGT, mọi phương thức (thẻ, COD, chuyển khoản, NAPAS, SPayLater, Apple Pay, Google Pay, ShopeePay, phương thức khác) | verified                                  | https://banhang.shopee.vn/edu/article/251 ; https://banhang.shopee.vn/edu/article/27451 ; https://banhang.shopee.vn/edu/article/25329 |
| `txn_fee.effective`     | ngày             | không Mall từ **01/05/2026** (trước đó 4,91% từ 01/07/2025). Mall: bài 25329 cũng ghi 6%                                            | verified                                  | article/27451, article/2150, article/25329                                                                                            |
| `txn_fee.basis`         | công thức        | `(Giá sản phẩm trước trợ giá Shopee + phí vận chuyển người mua trả − khuyến mãi người bán − khuyến mãi ngân hàng) × tỷ lệ`          | verified **ở bản công thức còn in 4,91%** | https://banhang.shopee.vn/edu/article/2150                                                                                            |
| `txn_fee.basis_at_6pct` | —                | cùng công thức, chỉ đổi 4,91% → 6%                                                                                                  | **assumption**                            | bài 27451 đổi mức phí, không in lại công thức. Bài 2150 khi đọc vẫn còn dòng `*4.91%`                                                 |
| `txn_fee.basis_unit`    | —                | **mỗi đơn**, có cộng cước người mua trả                                                                                             | verified                                  | article/2150                                                                                                                          |
| `txn_fee.trigger`       | —                | đơn Đã giao, hoặc THHT chấp nhận hoàn tiền ngay, trừ "Chưa nhận được hàng"                                                          | verified                                  | article/27451                                                                                                                         |
| `withdrawal_fee`        | đồng / lần rút   | **10.800** đã gồm GTGT. Không phải phí trên đơn                                                                                     | verified                                  | https://banhang.shopee.vn/edu/article/25329                                                                                           |

Hệ quả cho engine: phí cố định **không** lấy cước ship vào cơ sở (ít nhất theo bản 29/12/2025); phí xử lý giao dịch **có** lấy cước người mua trả. Gộp hai khoản về một `fee_base` sẽ sai.

---

## 3. Phí dịch vụ

| Field                    | Đơn vị                 | Giá trị                                                                                           | Bắt buộc?                                    | Tin cậy       | Nguồn                                                                                               |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `infra_fee`              | đồng / đơn             | **3.000**, đã gồm GTGT tại ngày áp dụng                                                           | có, mọi người bán, đơn tạo từ **01/07/2025** | verified      | https://banhang.shopee.vn/edu/article/25223                                                         |
| `infra_fee.trigger`      | —                      | Đã giao hoặc hoàn tiền ngay, trừ "Chưa nhận được hàng". Tính **mỗi đơn**, không phải mỗi sản phẩm |                                              | verified      | article/25223                                                                                       |
| `voucher_xtra.rate`      | % giá trị mỗi sản phẩm | **5,5%** mọi ngành (trước 23/05/2026: 4% mọi ngành; trước 29/12/2025: 2,5% hoặc 3% tùy ngành)     | chỉ khi shop tham gia                        | verified      | article/27540, article/25329, article/26526                                                         |
| `voucher_xtra.cap`       | đồng / sản phẩm        | **50.000**                                                                                        |                                              | verified      | cùng bài                                                                                            |
| `voucher_xtra.vs_cofund` | bool                   | đang tham gia Voucher Xtra thì **không** áp Chính sách Đồng Tài Trợ trên mọi đơn của shop         |                                              | verified      | article/26526 (câu từ 29/12/2025); bài 18182 được domain doc cũ dẫn, pass này không render lại được |
| `cofund.shopee_share`    | % mệnh giá mã          | **60%** từ 23/05/2026 (trước đó 70%)                                                              | khi không ở Voucher Xtra                     | verified      | article/27540                                                                                       |
| `cofund.seller_share`    | %                      | **40%**                                                                                           |                                              | verified      | article/27540                                                                                       |
| `cofund.seller_cap`      | đồng / sản phẩm        | **50.000**                                                                                        |                                              | verified      | article/27540                                                                                       |
| `piship`                 | đồng / đơn             | **2.700** đã gồm GTGT từ 23/05/2026 (trước đó 1.620)                                              | tùy chọn                                     | verified      | article/27540, article/25329                                                                        |
| `service_fee.definition` | —                      | gồm phí hạ tầng và phí gói người bán tham gia (Voucher Xtra, Content Xtra, …)                     |                                              | verified      | https://banhang.shopee.vn/edu/article/3110                                                          |
| `content_xtra.rate`      | —                      | được nêu tên, **không có mức** trong phần đã đọc                                                  |                                              | chưa xác minh | article/3110                                                                                        |
| `freeship_xtra`          | —                      | **ngừng cung cấp từ 01/04/2025**                                                                  | không còn là input 2026                      | verified      | https://banhang.shopee.vn/edu/article/12073                                                         |

Blog vẫn đang tung 4%, 4,5%, 7,85% cho Voucher Xtra / Freeship Xtra. Những số đó mâu thuẫn với bài Uni tháng 5/2026. Không dùng.

---

## 4. Thuế hộ kinh doanh — khấu trừ tại nguồn

Hai lớp khác nhau, không được cộng dồn như một khoản:

1. **Khấu trừ từng giao dịch** do sàn có chức năng đặt hàng và thanh toán, từ 01/07/2025 (NĐ 117/2025). Shopee vẫn đang hướng dẫn theo NĐ 117.
2. **Kê khai năm** của hộ / cá nhân theo bậc doanh thu, bài Shopee cho năm 2026. Số sàn đã khấu trừ được trừ khi quyết toán TNCN.

Doanh nghiệp **không** nằm trong bảng khấu trừ hộ/cá nhân. Sai loại hình thì Shopee bảo lưu quyền khấu trừ và không hoàn (FAQ người bán).

### 4.1 Suất khấu trừ Shopee đang áp (cá nhân cư trú)

| Field                              | Ngành trên sàn     | GTGT                                  | TNCN | Cộng     | Tin cậy  | Nguồn                                                           |
| ---------------------------------- | ------------------ | ------------------------------------- | ---- | -------- | -------- | --------------------------------------------------------------- |
| `tax.withhold.goods.resident`      | Hàng hóa           | 1%                                    | 0,5% | **1,5%** | verified | https://banhang.shopee.vn/edu/article/24233 (dẫn Điều 5 NĐ 117) |
| `tax.withhold.service.resident`    | Dịch vụ, e-voucher | 5%                                    | 2%   | **7%**   | verified | article/24233                                                   |
| `tax.withhold.goods.nonresident`   | Hàng hóa           | 1%                                    | 1%   | **2%**   | verified | https://banhang.shopee.vn/edu/article/24204                     |
| `tax.withhold.service.nonresident` | Dịch vụ            | 5%                                    | 5%   | **10%**  | verified | article/24204                                                   |
| `tax.withhold.formula`             | —                  | `(GTGT + TNCN) × doanh thu tính thuế` |      |          | verified | article/24233                                                   |

Cơ sở tính trong ví dụ chính thức (hàng hóa, cư trú):

`doanh thu tính thuế = giá hàng − mã giảm giá của người bán − phần đồng tài trợ do người bán chịu`

Không trừ phí ship, không trừ phần mã do Shopee chi, không trừ mã miễn phí vận chuyển.

Ví dụ trên bài: giá hàng 110.000, ship 15.000, mã shop 10.000, mã Shopee 3.000 (Shopee 2.100 + shop 900), mã freeship 7.000. Người mua trả 105.000. Doanh thu tính thuế = 110.000 − 10.000 − 900 = **99.100**. GTGT 991 + TNCN 496 = **1.487**.

| Field                                       | Giá trị                                                                                                                          | Tin cậy                                                       | Nguồn                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| `tax.withhold.start`                        | đơn hoàn thành từ 01/07/2025 thì sàn khấu trừ; đơn hoàn thành trước ngày đó người bán tự khai, kể cả khi trả hàng sau 01/07/2025 | verified                                                      | article/24233                               |
| `tax.withhold.regardless_of_annual_revenue` | khấu trừ **từng giao dịch**, không chờ ngưỡng doanh thu năm                                                                      | verified                                                      | article/24204                               |
| `tax.threshold.note_2025`                   | FAQ Shopee: ngưỡng chịu thuế HKD/CNKD năm 2025 là 100 triệu/năm                                                                  | verified như lời FAQ, không phải điều luật đã đọc             | article/24204                               |
| `tax.threshold.note_2026`                   | FAQ Shopee: từ 2026 là 200 triệu/năm "cho đến khi có quy định khác"                                                              | verified như lời FAQ                                          | article/24204                               |
| `tax.refund_on_return`                      | đơn hoàn thành từ 01/07/2025 mà sau đó THHT thì Shopee **điều chỉnh hoàn thuế** tương ứng                                        | verified về hướng (có hoàn thuế); công thức hoàn chưa đọc hết | article/24233                               |
| `tax.id`                                    | từ 01/07/2025 cá nhân / hộ dùng số định danh cá nhân thay MST (TT 86/2024/TT-BTC)                                                | verified                                                      | https://banhang.shopee.vn/edu/article/19798 |

### 4.2 Bậc kê khai năm 2026 trên bài Shopee (không thay suất khấu trừ 1,5%)

https://banhang.shopee.vn/edu/article/26823

| Doanh thu năm         | GTGT                           | TNCN (bài tóm tắt)                                               |
| --------------------- | ------------------------------ | ---------------------------------------------------------------- |
| ≤ 500 triệu           | không phải nộp GTGT            | bài tách nhóm; chi tiết TNCN của nhóm 1 bị cắt trong phần đã đọc |
| 500 triệu < DT ≤ 3 tỷ | trực tiếp: doanh thu × % ngành | doanh thu tính thuế = DT năm − 500 triệu; suất 0,5%–5%           |
| 3 tỷ < DT ≤ 50 tỷ     | cùng họ trực tiếp theo %       |                                                                  |
| > 50 tỷ               |                                | thu nhập tính thuế × 20%, thu nhập = doanh thu − chi phí hợp lý  |

Suất ngành trên cùng bài (HKD / cá nhân), `verified` như bảng Shopee đăng:

| Ngành                                            | GTGT | TNCN cư trú | TNCN không cư trú |
| ------------------------------------------------ | ---- | ----------- | ----------------- |
| Phân phối, cung cấp hàng hóa                     | 1%   | 0,50%       | 1%                |
| Dịch vụ, xây dựng không bao thầu NVL             | 5%   | 2%          | 5%                |
| Nội dung số, game, phim, ảnh, nhạc, quảng cáo số | 5%   | 5%          | 5%                |
| Kinh doanh khác                                  | 2%   | 1%          | 2%                |

Dòng "vận tải, dịch vụ gắn với hàng hóa 3% GTGT / 1,5% TNCN cư trú" **không** có trên hai bài Shopee đã đọc (24233, 26823). Nó xuất hiện ở bài tóm tắt NĐ 252 trên thuvienphapluat.vn. Gắn `secondary`, không đưa vào default của hộ bán hàng hóa.

### 4.3 NĐ 252/2026 có thay suất 1,5% hay không

| Việc                                                                                                      | Kết quả pass này                                                                                    | Tin cậy                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shopee Uni còn trích NĐ 117 cho suất khấu trừ và cho cột thuế trên báo cáo doanh thu                      | còn                                                                                                 | verified — article/24233, article/2072                                                                                                                                                                                                                                                                                                                                                                  |
| NĐ 252/2026 (30/06/2026, hiệu lực 01/07/2026) thay NĐ 117 và giao suất về Luật GTGT 2024 / Luật TNCN 2025 | bài luật nói sàn vẫn khấu trừ GTGT + TNCN theo % trên doanh thu; suất hàng hóa họ dẫn là 1% và 0,5% | **secondary** — https://thuvienphapluat.vn/phap-luat-doanh-nghiep/cong-viec-phap-ly/khai-thue-nop-thue-ho-kinh-doanh-kinh-doanh-tren-san-thuong-mai-dien-tu-607.html và https://thuvienphapluat.vn/ma-so-thue/phap-luat-thue/san-thuong-mai-dien-tu-phai-khau-tru-nop-thay-nhung-loai-thue-nao-cho-ho-kinh-doanh-ca-nhan-kinh-do-324527-234922.html . Toàn văn điều khoản không đọc được trong pass này |
| Nếu sàn không phân được hàng hay dịch vụ                                                                  | áp suất cao nhất                                                                                    | secondary, cùng bài thuvienphapluat dẫn NĐ 252                                                                                                                                                                                                                                                                                                                                                          |

Default an toàn cho hộ cư trú bán hàng hóa: **1,5% trên doanh thu tính thuế kiểu ví dụ 24233**, `verification_status` nên là verified đối với cách Shopee đang thu, và kèm ghi chú NĐ 252 chưa đọc toàn văn. Không có chứng cứ nào trong pass này cho thấy suất hàng hóa đã đổi khỏi 1% + 0,5%.

---

## 5. Phí vận chuyển

Không có một số "phí ship trung bình" chính thức. Cước đi phụ thuộc kênh, khối lượng và kích thước sau đóng gói. Người bán nhập cân nặng / kích thước lúc đăng bán; Shopee tính cước theo kênh (https://banhang.shopee.vn/edu/article/17468).

| Field                           | Đơn vị     | Giá trị đã xác minh                                                                       | Tin cậy       | Nguồn                                              |
| ------------------------------- | ---------- | ----------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------- |
| `shipping.outbound_tariff`      | đồng       | **chưa có bảng cước VN** trong pass này. Không điền số giả                                | chưa xác minh | article/17468 chỉ nói cách tính, không in bảng giá |
| `return_shipping.seller_cap`    | đồng / đơn | người bán chịu cước chiều về, trần **40.000**; kênh Hỏa Tốc và Trong Ngày trần **20.000** | verified      | https://banhang.shopee.vn/edu/article/3648         |
| `return_shipping.effective`     | ngày       | từ 01/04/2025; bản 16/09/2025 chỉ đổi cách hiển thị, chính sách không đổi                 | verified      | article/3648                                       |
| `return_shipping.applies_to`    | —          | đơn THHT và đơn giao không thành công                                                     | verified      | article/3648                                       |
| `return_shipping.excluded`      | —          | THHT lý do "Chưa nhận được hàng"; THHT hoàn tiền ngay (không trả hàng)                    | verified      | article/3648                                       |
| `return_shipping.piship_covers` | bool       | shop tham gia PiShip thì được chi trả cước chiều về của hai loại đơn trên                 | verified      | article/3648                                       |
| `piship.fee`                    | đồng / đơn | 2.700 từ 23/05/2026                                                                       | verified      | xem mục 3                                          |
| `freeship_xtra`                 | —          | ngừng 01/04/2025                                                                          | verified      | article/12073                                      |

Trần kênh (không phải giá cước), verified:

| Kênh                  | Đơn vị         | Giới hạn đã đọc                                | Nguồn                                       |
| --------------------- | -------------- | ---------------------------------------------- | ------------------------------------------- |
| Trong Ngày · SPX      | cm / kg / đồng | 60×60×60, 15 kg, giá trị đơn tối đa 50.000.000 | https://banhang.shopee.vn/edu/article/25906 |
| Trong Ngày · Ahamove  |                | 80×80×80, 15–200 kg, 20.000.000                | article/25906                               |
| Hỏa Tốc · SPX Instant |                | 60×60×60, 30 kg, 5.000.000                     | https://banhang.shopee.vn/edu/article/13588 |
| Hỏa Tốc · GrabExpress |                | 50×50×40, 30 kg, 5.000.000                     | article/13588                               |
| Hỏa Tốc · beDelivery  |                | 60×60×60, 20 kg, 5.000.000                     | article/13588                               |
| Hỏa Tốc · Green SM    |                | 60×60×60, 30 kg, 1.000.000                     | article/13588                               |

Từ 13/08/2026, Nhanh và Hàng Cồng Kềnh là kênh mặc định (article/17468). Đó là quy tắc bật kênh, không phải đơn giá.

---

## 6. COGS và đóng gói

Sàn không công bố giá vốn hay giá túi/hộp. Đây là input của người bán, đơn vị đồng / đơn vị hàng. Pass này **không** tìm được khảo sát đóng gói TMĐT VN 2025–2026 đủ để ghi một khoảng tiền. Không đặt assumption dạng "2.000–5.000 đồng/đơn".

| Field                               | Đơn vị     | Cách dùng                                                                                                                   | Tin cậy                                                                                        |
| ----------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `sku.cogs`                          | đồng / cái | người bán nhập; trừ khỏi doanh thu được hưởng sau phí và thuế                                                               | assumption rằng field này tồn tại và là duy nhất — schema `sku.cogs` đã có, không có nguồn sàn |
| `sku.packaging_cost`                | đồng / cái | cùng kiểu, vật tư đóng gói phân bổ                                                                                          | cùng lý do                                                                                     |
| `sku.weight_g`, kích thước đóng gói | g, cm      | Shopee dùng để ra cước; thiếu hoặc khai thấp hơn thực tế thì có thể phát sinh cước chênh (TikTok nói rõ điều này, xem dưới) | verified về vai trò trên Shopee: article/17468                                                 |

Biên lợi nhuận campaign = giá người mua thấy − giảm giá shop − phần voucher shop gánh − phí cố định − phí xử lý giao dịch − phí hạ tầng − PiShip (nếu có) − Voucher Xtra (nếu có) − thuế khấu trừ − cước chiều về kỳ vọng − COGS − đóng gói. COGS để trống thì mọi kết luận "không âm margin" là vô nghĩa.

---

## 7. Quy tắc giá campaign

### 7.1 Giá gạch và giá bán

| Field                            | Ý nghĩa                                                                                              | Giá trị                                                                           | Tin cậy                                                                                                                                                                                        | Nguồn                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `price.list` (giá gốc)           | giá trước giảm của shop; đây là số bị gạch khi có khuyến mãi shop                                    | người bán đặt                                                                     | verified về định nghĩa hiển thị                                                                                                                                                                | https://banhang.shopee.vn/edu/article/25248 : "Giá bán sản phẩm = Giá gốc − mức giảm giá người bán" |
| `price.promo`                    | giá sau giảm của shop                                                                                |                                                                                   | verified                                                                                                                                                                                       | cùng bài                                                                                            |
| `price.final_visible`            | Đấu Giá Rẻ Vô Địch                                                                                   | Giá đề cử + thuế − voucher shop − voucher Shopee. Có thể khác nhau giữa người bán | verified                                                                                                                                                                                       | article/25248                                                                                       |
| `flash_sale.original_price_lock` | khi sản phẩm đã được duyệt trong flash sale đã lên lịch hoặc đang chạy, **không sửa Original Price** | khóa                                                                              | verified trên bảng khóa Open Platform; cột khác có chú thích riêng cho shop local MY/VN, cột Original Price của Flash Sale ghi X (không cho sửa) không kèm ngoại lệ quốc gia trong đoạn đã đọc | https://open.shopee.com/faq/140 (cập nhật 2025-05-15)                                               |

### 7.2 Tăng giá trước sale (Giá ảo)

https://banhang.shopee.vn/edu/article/2310

| Field                               | Giá trị                                                                                | Tin cậy                   |
| ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------- |
| `price_spam.definition`             | tăng **giá gốc** bất hợp lý trước khuyến mãi để phóng đại % giảm                       | verified                  |
| `price_spam.scope`                  | chương trình của Shopee, chương trình của shop, và Flash Sale của shop                 | verified                  |
| `price_raise.min_days_before_promo` | muốn tăng giá gốc thì phải điều chỉnh **ít nhất 7 ngày** trước khi tham gia khuyến mãi | verified                  |
| `price_raise.supplier_exception`    | được tăng nếu gửi Shopee văn bản / chứng từ nhà cung cấp báo tăng giá                  | verified                  |
| `price_raise.free_if_no_promo`      | không tham gia khuyến mãi nào thì được sửa giá gốc                                     | verified                  |
| `price_spam.percent_threshold`      | bài **không** đưa ngưỡng % "bất hợp lý"                                                | chưa xác minh — không bịa |

"Giá sau giảm phải là giá thấp nhất trong 7 ngày, không tính các flash sale trước" và "khoảng giảm 5–99%" xuất hiện trên blog hướng dẫn, **không** có trong FAQ Flash Sale chính thức đã đọc (https://banhang.shopee.vn/edu/article/17337). FAQ chỉ nói mỗi chiến dịch có "phạm vi giảm giá được chấp nhận", tồn kho tối thiểu và DTS tối đa riêng. Gắn `secondary` nếu engine cần một default, và không hard-code 7 ngày lookback hay 5% sàn giảm.

Điều kiện shop để **có cơ hội** vào Shopee Flash Sale, verified trên article/17337: điểm Sao Quả Tạ < 3, không vi phạm quy định đăng bán, không bị khóa 30 ngày liên tục trước thời điểm mua suất, người bán Việt Nam không Mall và không tạm nghỉ. Ngưỡng % giảm không nằm trong danh sách này.

### 7.3 Đấu giá và giá thành viên

| Field                          | Giá trị                                                                                                                                                                | Tin cậy  | Nguồn                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------- |
| `auction.min_nomination_price` | từ 14/07/2025 người bán đặt giá thấp nhất chấp nhận bán; hệ thống không giảm dưới mức đó, và cố rẻ hơn đối thủ gần nhất ít nhất 1 đồng                                 | verified | article/25248                               |
| `auction.max_nomination_price` | từ 14/11/2025 có thêm giá đề cử tối đa                                                                                                                                 | verified | article/25248                               |
| `member_price.max_duration`    | chiến dịch Giá ưu đãi thành viên tối đa 3 tháng; ngày bắt đầu phải cách ngày thiết lập chương trình thân thiết ít nhất 2 tháng; SKU không được trùng chương trình khác | verified | https://banhang.shopee.vn/edu/article/13058 |

`guardrail.max_price_change_bps` trong schema là trần **của người bán**, không phải trần 7 ngày của Shopee. Hai thứ phải là hai field.

---

## 8. So sánh Lazada và TikTok Shop

Chỉ số đọc được trên trang chính thức. Bảng blog "Shopee 6,5% + thanh toán 2%" loại bỏ vì trái bài Uni.

### TikTok Shop Việt Nam

| Field                                | Giá trị                                                                                                                                                                      | Tin cậy                                                                    | Nguồn                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `tts.txn_fee`                        | **6%** đơn tạo sau 00:00 09/05/2026 (GMT+7)                                                                                                                                  | verified                                                                   | https://seller-vn.tiktok.com/university/essay?knowledge_id=753295858337537&lang=en                  |
| `tts.txn_fee.basis`                  | `(customer payment + platform discount − customer order refund) × rate`. Ví dụ: giá 100.000 − giảm shop 5.000 + giảm sàn 5.000 + ship khách trả 5.600 = 105.600 × 6% = 6.336 | verified                                                                   | cùng bài. Cơ sở **cộng giảm giá của sàn và cộng ship**, khác cơ sở thuế Shopee                      |
| `tts.txn_fee.ads_savings`            | từ 21/10/2026, giảm theo ads take rate 30 ngày của shop: <4% → 0; 4–<7% → 0,5 điểm; 7–<10% → 0,7; 10–<15% → 1,0; 15–<20% → 1,2; ≥20% → 1,5 điểm                              | verified                                                                   | cùng bài                                                                                            |
| `tts.order_processing`               | **3.000 đồng / đơn giao thành công**, đã gồm thuế, không hoàn khi trả hàng sau giao                                                                                          | verified                                                                   | https://seller-vn.tiktok.com/university/essay?knowledge_id=2968734088120080&lang=en (từ 27/10/2025) |
| `tts.commission.default.marketplace` | L3 không có trong bảng: **14,00%** từ 03/07/2026                                                                                                                             | verified                                                                   | https://seller-vn.tiktok.com/university/essay?knowledge_id=3396736626312961&lang=en                 |
| `tts.commission.default.mall`        | L3 không liệt kê: 15,50% từ 03/07/2026, **16,00%** từ 03/08/2026                                                                                                             | verified                                                                   | cùng bài                                                                                            |
| `tts.commission.basis`               | giá sau giảm của nhà bán × suất ngành                                                                                                                                        | verified                                                                   | cùng bài, ví dụ tính                                                                                |
| `tts.commission.books.mall`          | một số L3 sách Mall **15,00% → 12,50%** từ 20/10/2026                                                                                                                        | verified cho các dòng sách đã render (máy tính & mạng, nhiếp ảnh, văn học) | cùng bài                                                                                            |
| `tts.commission.full_table`          | PDF "From 20 October 2026", 1,5 MB                                                                                                                                           | **chưa đọc**                                                               | cùng bài                                                                                            |
| `tts.logistics_service_fee`          | từ 12/10/2026, kiện **trên 10 kg**; mức trong bảng là trước thuế, sàn từ 3.000 đồng/kiện, phần cộng thêm trần 65.000 đồng/kiện với Standard & Bulky                          | verified về cấu trúc; **bảng bậc kg chưa đọc**                             | https://seller-vn.tiktok.com/university/essay?knowledge_id=4723305845458708&lang=en                 |
| `tts.shipping_variance`              | người bán chịu ship nếu kích thước thực vượt khai báo                                                                                                                        | verified                                                                   | https://seller-vn.tiktok.com/university/essay?knowledge_id=8858869405370113&lang=en                 |
| `tts.voucher_extra`                  | blog ghi 4%                                                                                                                                                                  | **không dùng** — không thấy trên Seller University trong pass này          | —                                                                                                   |

Ví dụ hoa hồng trong bài TikTok (guitar 13,50%, máy lọc không khí 6,50% / 6,87%) là ví dụ tính trên trang, không phải bảng hiệu lực 20/10/2026. Không đưa vào `category.commission_bps`.

### Lazada Việt Nam

Trang đăng ký LazMall in phí công khai. Help Center có bài "phí cố định nhà bán thường từ 02/07/2025" nhưng **thân bài không tải được**.

| Field                        | Giá trị                                                                                                                                                                                                                | Tin cậy                                                                                              | Nguồn                                                                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lazada.mall.payment_fee`    | **2,002%**                                                                                                                                                                                                             | verified trên trang tham gia LazMall                                                                 | https://sellercenter.lazada.vn/apps/register/lazmall/joining                                                                                                           |
| `lazada.mall.commission`     | điện thoại, máy tính bảng **1%**; laptop, PC, TV **1,5%**; gia dụng lớn/nhỏ **2,5%**; camera **3%**; tã giấy, sữa **3%**; làm đẹp, thời trang, nhà cửa, phần lớn FMCG **5%**; trần trang ghi hoa hồng LazMall **1–5%** | verified trên cùng trang. Đây là phí lúc đăng ký Mall, chưa đối được với biểu 2026 trong Help Center | cùng URL                                                                                                                                                               |
| `lazada.non_mall.commission` |                                                                                                                                                                                                                        | **chưa xác minh**                                                                                    | Help Center chỉ hiện tiêu đề bài, không hiện bảng: https://sellercenter.lazada.vn/helpcenter/s/faq/knowledge?categoryId=1000028699&m_station=faq&questionId=1000149699 |
| `lazada.new_seller`          | trang đăng ký thường: 0% phí vận chuyển tối đa 30 ngày đầu, 0% hoa hồng 90 ngày đầu, 400.000 đồng tín dụng quảng cáo                                                                                                   | verified như lời trang đăng ký                                                                       | https://sellercenter.lazada.vn/apps/register/index                                                                                                                     |

Blog ghi phí thanh toán Lazada ~3,99% và phí xử lý ~4,99%. Trái với 2,002% trên trang LazMall. Không dùng blog.

---

## 9. Chưa xác minh

- Toàn bộ bảng phí cố định cấp 3 không Mall ngoài các dòng mục 1.1, và mọi dòng Mall sau 29/05/2026.
- Công thức phí xử lý giao dịch có còn đúng từng hạng tử sau khi mức lên 6% hay không (bài 2150 còn in 4,91%).
- Câu "không gồm cước vận chuyển" của phí cố định có còn nguyên văn trên bài 23/05/2026 hay không.
- Mức Content Xtra, phí duy trì hiển thị (bài 27540 có mục 6 nhưng phần đã đọc dừng ở tiêu đề), hoa hồng affiliate.
- Bảng cước SPX / GHN / J&T / Viettel Post trên Shopee VN.
- Ngưỡng % thế nào thì Shopee kết luận "tăng giá bất hợp lý", và lookback "giá thấp nhất 7 ngày" của Flash Sale.
- Toàn văn điều khấu trừ của NĐ 252/2026. Suất 1% + 0,5% đang verified qua cách Shopee thu theo NĐ 117 và qua bảng ngành bài 26823, chưa verified bằng điều khoản 252.
- PDF hoa hồng TikTok từ 20/10/2026, bảng Logistics Service Fee theo kg, phí Voucher Extra TikTok.
- Biểu phí cố định Lazada shop thường từ 02/07/2025.
- Bất kỳ khoảng tiền COGS hoặc đóng gói "thị trường".

---

## 10. Đề xuất field bổ sung cho schema

- `fee_schedule_item.basis` cần thêm giá trị ngoài `per_product` / `per_order`: `product_value_ex_shipping` (phí cố định), `order_incl_buyer_shipping` (phí xử lý giao dịch), `taxable_revenue` (giá hàng − voucher shop − phần đồng tài trợ của shop). Ba khoản lớn nhất không cộng trên cùng một mẫu số.
- `fee_schedule` cần lớp **modifier theo cửa sổ ngày** (`commission.promo` 01/06/2026–31/08/2026: ×0,5 nếu suất đứng < 600 bps, else −300 bps), vì một campaign tháng 7 và một campaign tháng 9 không được dùng cùng `commission_bps`.
- Tách `seller_legal_form` (`company` | `household_resident` | `individual_nonresident` | `service`) ra khỏi một hằng `tax 1,5%`. Doanh nghiệp không bị khấu trừ hộ; dịch vụ cư trú là 7%; hàng hóa không cư trú là 2%. Giữ `tax.withhold.basis` = công thức G trong ví dụ bài 24233, và cờ `tax_refunded_on_return = true` trong khi `infra_fee` và phần lớn phí sàn không có câu hoàn tương đương (TikTok thì ghi thẳng phí xử lý đơn không hoàn).
- Thêm `return_shipping_cap_dong` (40.000, hoặc 20.000 nếu kênh hỏa tốc / trong ngày), `piship_enrolled`, `piship_fee_dong` (2.700). Không có PiShip thì kỳ vọng trả hàng là một khoản âm margin riêng, trần bằng cước chiều về chứ không bằng giá hàng.
- Tách rule giá campaign khỏi `guardrail.max_price_change_bps`: `original_price_min_age_days` = 7 trước khi được tăng giá gốc rồi vào khuyến mãi, `flash_sale_locks_original_price` = true, `auction_min_price_dong` / `auction_max_price_dong`, và `campaign_discount_band` để trống cho đến khi đọc điều khoản từng chiến dịch. Lookback "giá thấp nhất 7 ngày" và sàn giảm 5% chưa đủ nguồn để thành hằng số.
