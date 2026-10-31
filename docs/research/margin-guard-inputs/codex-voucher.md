# VOUCHER — input cho Margin Guard (Shopee VN)

Phạm vi: loại voucher, điều kiện/cap/min-spend, khả năng cộng dồn, đồng tài
trợ và gói Voucher Xtra/Freeship Xtra. Đối chiếu ngày **31/10/2026**; Shopee VN
là nguồn chuẩn. `verified` chỉ dùng khi URL là trang chính thức Shopee; không
có số đã kiểm chứng thì ghi **CHƯA XÁC MINH** và để giá trị trống.

> Quy ước dữ liệu: `effective_from` là mốc nguồn công bố có hiệu lực, không
> phải ngày crawler đọc trang. Mọi số dưới đây đi kèm URL, mốc hiệu lực và câu
> trích nguyên văn chứa số. Các boolean/enum không phải là ước lượng tiền tệ,
> nhưng vẫn giữ nguồn để audit.

## Kết luận dùng được ngay

- Từ 23/05/2026, voucher sàn thuộc [Chính sách Đồng Tài Trợ](https://help.shopee.vn/portal/4/article/166085)
  có tỷ lệ Shopee **60%** / shop **40%**, và phần shop bị chặn ở
  **50.000 đồng/sản phẩm**.
- `Voucher Xtra` không được bật cùng Chính sách Đồng Tài Trợ; đây là một lựa
  chọn programme có [lock tối thiểu **15 ngày**](https://banhang.shopee.vn/edu/article/18182),
  không phải một voucher thường.
- Voucher theo phần trăm phải có cap; `min_spend` là điều kiện ở **đơn hàng**,
  vì vậy engine phải tính ở basket rồi mới phân bổ về SKU.
- Không được giả định mọi voucher stack được: chính sách chung nói mặc định
  voucher không kết hợp được, trừ khi điều khoản của voucher cụ thể cho phép.
- Không nạp phí Freeship Xtra cũ vào lịch 2026: gói cho non-Mall đã
  [ngừng cung cấp từ 01/04/2025](https://banhang.shopee.vn/edu/article/12073);
  mức phí hiện hành chưa có số chính thức trong nguồn đã đọc.

## 1. Phân loại và ownership

| `voucher_type` / field | Giá trị hoặc rule | Nguồn + quote | Hiệu lực | Tin cậy |
|---|---|---|---|---|
| `shop_voucher.scope` | `toan_shop`, `san_pham`, `khach_hang_moi`, `khach_hang_mua_lai`, `rieng_tu`, `shopee_live`, `shopee_video` | [Seller Education Hub, article 2356](https://banhang.shopee.vn/edu/article/2356). Trang cấu hình Shop Voucher liệt kê các loại trên; không có số tiền/rate để nạp. | Không nêu ngày hiệu lực trên nội dung đọc được | verified |
| `shop_voucher.discount_type` | `Khuyến mãi` hoặc `Hoàn Xu`; `Hoàn Xu` là subtype voucher do shop cấu hình, không tạo một “coin programme” thứ hai | [article 2356](https://banhang.shopee.vn/edu/article/2356): trường “Loại Voucher” có “Khuyến mãi” và “Hoàn Xu”. | Không nêu ngày hiệu lực | verified |
| `platform_voucher.family` | voucher Shopee Xu, voucher chương trình khuyến mãi, freeship, voucher phát hành cùng đối tác, hoặc loại khác do Shopee quyết định | [Chính sách chung Mã Ưu Đãi](https://help.shopee.vn/portal/4/article/166085): “Mã Ưu Đãi bao gồm nhưng không giới hạn ở các loại sau: … Mã Ưu Đãi hoàn Shopee Xu … Mã Ưu Đãi Miễn phí Vận chuyển … Mã Ưu Đãi được hợp tác phát hành với các đối tác của Shopee”. | 23/05/2026 — quote: “Chính Sách Mã Ưu Đãi này được thông báo vào ngày 14/05/2026, có hiệu lực kể từ ngày 23/05/2026.” | verified |
| `livestream_voucher` | biểu diễn là `shop_voucher.scope = shopee_live`; **CHƯA XÁC MINH** funding/rate/cap riêng | [article 2356](https://banhang.shopee.vn/edu/article/2356) liệt kê “Voucher Shopee Live”; không có mức phí hay tỷ lệ trong nguồn đã đọc. | Không nêu ngày hiệu lực | verified (tồn tại type); CHƯA XÁC MINH (kinh phí) |
| `affiliate_or_partner_voucher` | Không gộp hoa hồng affiliate/KOC vào `voucher`. Chỉ mã “được hợp tác phát hành với các đối tác” có bằng chứng ở policy; funding/rate affiliate VN để trống. | [Chính sách chung Mã Ưu Đãi](https://help.shopee.vn/portal/4/article/166085): “Mã Ưu Đãi được hợp tác phát hành với các đối tác của Shopee”. | 23/05/2026 — quote hiệu lực như dòng `platform_voucher.family` | verified (mã đối tác tồn tại); CHƯA XÁC MINH (affiliate commission) |
| `freeship_voucher` | voucher miễn phí vận chuyển là một family voucher sàn; **CHƯA XÁC MINH** seller-funded share theo từng chiến dịch | [Chính sách chung Mã Ưu Đãi](https://help.shopee.vn/portal/4/article/166085): “Mã Ưu Đãi Miễn phí Vận chuyển và/hoặc các voucher ưu đãi phí vận chuyển khác”. | 23/05/2026 — quote hiệu lực như trên | verified (family); CHƯA XÁC MINH (funding) |

### Mapping bắt buộc cho schema

Schema cũ có `kind = shop/platform/coin`; nên coi `coin` là giá trị legacy và
map `Hoàn Xu` về `kind=shop`, `benefit_type=coin_cashback`. `livestream` là
`scope/channel`, không phải `kind` mới. `affiliate` cần entity chi phí/commission
riêng, chỉ link sang voucher khi có một mã thực tế trên order.

## 2. Field voucher và điều kiện áp dụng

| Field đề xuất | Đơn vị | Giá trị/range VN 2025–2026 | Nguồn + quote có số | Hiệu lực | Tin cậy |
|---|---:|---|---|---|---|
| `voucher.code_max_chars` | ký tự | **5** | [article 2356](https://banhang.shopee.vn/edu/article/2356): “Mã Voucher … tối đa 5 ký tự.” | Không nêu ngày hiệu lực | verified |
| `voucher.active_window_max_months` | tháng | **3** | [article 2356](https://banhang.shopee.vn/edu/article/2356): “Thời gian áp dụng mã … tối đa 3 tháng.” | Không nêu ngày hiệu lực | verified |
| `voucher.discount_type` | enum | `fixed` / `percent`; giá trị thực tế per voucher | [article 2356](https://banhang.shopee.vn/edu/article/2356): “Mức giảm giá: giảm theo số tiền hoặc theo phần trăm.” | Không nêu ngày hiệu lực | verified |
| `voucher.cap_dong` | đồng | bắt buộc khi `discount_type=percent`; số cap cụ thể lấy từ voucher | [article 2356](https://banhang.shopee.vn/edu/article/2356): “Với mã giảm giá theo phần trăm, Người bán cần thiết lập Mức giảm giá tối đa.” | Không nêu ngày hiệu lực | verified |
| `voucher.min_spend_dong` | đồng/đơn | số cụ thể do voucher quy định; không có default/range chính thức đã đọc | [Chính sách chung](https://help.shopee.vn/portal/4/article/166085): điều kiện voucher bao gồm “Mức chi tiêu tối thiểu”. | 23/05/2026 — quote: “Chính Sách Mã Ưu Đãi này … có hiệu lực kể từ ngày 23/05/2026.” | verified |
| `voucher.max_uses` | lượt | giá trị do shop nhập; **CHƯA XÁC MINH** min/max platform-wide | [article 2356](https://banhang.shopee.vn/edu/article/2356): trường “Tổng lượt sử dụng tối đa”. | Không nêu ngày hiệu lực | verified (field); CHƯA XÁC MINH (range) |
| `voucher.max_uses_per_buyer` | lượt/người mua | mặc định **1**, tối đa **5** | [article 2356](https://banhang.shopee.vn/edu/article/2356): “Lượt sử dụng tối đa/Người mua: mặc định 1, tối đa 5.” | Không nêu ngày hiệu lực | verified |
| `voucher.eligibility` | enum/JSON | buyer, seller, SKU/service, expiry, min spend, cap, payment method | [Chính sách chung](https://help.shopee.vn/portal/4/article/166085): “Mã Ưu Đãi chỉ có hiệu lực với các đơn hàng … bao gồm nhưng không giới hạn ở … Mức chi tiêu tối thiểu; Người Bán, Sản phẩm … Thời hạn sử dụng; Hạn mức ưu đãi … Phương thức thanh toán.” | 23/05/2026 — quote hiệu lực như trên | verified |

**Rule engine:** evaluate `min_spend_dong` on `order_gross_eligible_dong`, not
on each SKU. Persist both the original basket threshold and the allocation
method used to spread a realized order discount to lines; a single cheap SKU can
receive a share of a voucher qualified by another line.

## 3. Stack / compatibility — không suy diễn “có thể cộng dồn”

| Field đề xuất | Giá trị an toàn | Nguồn + quote | Hiệu lực | Tin cậy |
|---|---|---|---|---|
| `voucher.stack_policy` | `prohibited_unless_explicitly_allowed` (default) | [Chính sách chung](https://help.shopee.vn/portal/4/article/166085): “Trừ khi có quy định khác, Mã Ưu Đãi không thể được sử dụng kết hợp với các chương trình khuyến mãi hoặc ưu đãi khác.” | 23/05/2026 — quote: “... có hiệu lực kể từ ngày 23/05/2026.” | verified |
| `voucher.combinability_source` | URL/terms snapshot của từng voucher; không dùng một boolean global | Cùng policy: người dùng “có trách nhiệm kiểm tra các điều khoản và điều kiện áp dụng cho từng Mã Ưu Đãi”. | 23/05/2026 — quote hiệu lực như trên | verified |
| `voucher.redemption_per_purchase` | một voucher chỉ dùng **1** lần cho một lần mua | [Chính sách chung](https://help.shopee.vn/portal/4/article/166085): “Mã Ưu Đãi chỉ có thể sử dụng một lần cho một lần mua hàng.” | 23/05/2026 — quote: “... có hiệu lực kể từ ngày 23/05/2026.” | verified |
| `voucher.stackable` (legacy) | **Không đủ dữ liệu** nếu chỉ boolean; giữ `false` khi không có terms riêng và dùng matrix pairwise | Bằng chứng ở hai dòng trên chỉ cho default policy, không xác nhận cặp shop/platform/coin/live cụ thể nào. | 23/05/2026 | verified (default); CHƯA XÁC MINH (các cặp) |

Không đưa một “stack thứ tự chuẩn” vào engine. Phải lưu `applied_voucher_ids`,
`eligibility_snapshot`, `compatibility_decision` và dữ liệu order thực tế; nếu
platform trả về tổ hợp đã áp dụng thì tính theo tổ hợp đó, còn scenario giả lập
chỉ được generate từ các cặp có terms cho phép.

## 4. Đồng tài trợ platform voucher

| Field | Đơn vị | Giá trị | Nguồn + quote có số | Hiệu lực | Tin cậy |
|---|---:|---|---|---|---|
| `cofund.platform_share_bps` | bps | **6.000** (60%) | [Chính sách chung](https://help.shopee.vn/portal/4/article/166085): “Từ ngày 23/05/2026, Shopee cập nhật … Tỷ lệ (%) … Từ 23/05/2026: Shopee 60”. | 23/05/2026 — quote: “... có hiệu lực kể từ ngày 23/05/2026.” | verified |
| `cofund.seller_share_bps` | bps | **4.000** (40%) | Cùng nguồn: “Người Bán | 30 (Tối đa 50.000 đồng/sản phẩm) | 40 (Tối đa 50.000 đồng/sản phẩm)”. | 23/05/2026 | verified |
| `cofund.seller_cap_dong_per_product` | đồng/sản phẩm | **50.000** | Cùng nguồn: “Mức tài trợ tối đa của Người bán là 50.000 Đồng trên mỗi sản phẩm.” | 23/05/2026 | verified |
| `cofund.seller_amount_formula` | đồng | `min(face_value_dong × 0.40, 50_000)` cho mỗi sản phẩm thuộc policy | Cùng nguồn: “Giá trị Mã ưu đãi Đồng Tài Trợ do Người bán chịu = Tỷ lệ chia sẻ (%) x Giá trị Mã Ưu Đãi…” và quote cap ngay trên. | 23/05/2026 | verified |
| `cofund.excluded_family` | enum[] | `coin_cashback`, `freeship`, `partner_voucher`, gift/promo-specific, on a policy basis | Cùng nguồn, mục ngoại lệ liệt kê “Mã Ưu Đãi hoàn Shopee Xu”, “Mã Ưu Đãi Miễn phí Vận chuyển …”, “Mã Ưu Đãi được hợp tác phát hành với các đối tác của Shopee”. | 23/05/2026 | verified |
| `cofund.programme_override` | enum | `voucher_xtra => excluded`; do **not** encode as `cofund_share_bps=0` on the voucher | [Voucher Xtra](https://banhang.shopee.vn/edu/article/18182): “Từ ngày 01/10/2025, trong thời gian tham gia Gói Voucher Xtra, Chính sách Đồng Tài Trợ Mã ưu đãi sẽ không đồng thời áp dụng trên tất cả đơn hàng của Shop.” | 01/10/2025 | verified |

`cofund` là policy có phiên bản, không phải thuộc tính bất biến của một voucher:
chính policy chính thức nói tỷ lệ “có thể thay đổi trong từng thời điểm hoặc
theo từng chương trình”. Lưu `policy_version/effective_from/source_url` cùng
order snapshot.

## 5. Voucher Xtra và Freeship Xtra

| Field | Đơn vị | Giá trị | Nguồn + quote có số | Hiệu lực | Tin cậy |
|---|---:|---|---|---|---|
| `voucher_xtra.service_fee_bps` | bps | **550** (5,5% giá trị mỗi sản phẩm) | [Seller Education Hub, article 18182](https://banhang.shopee.vn/edu/article/18182): “Phí dịch vụ Gói Voucher Xtra là 5,5% giá trị mỗi sản phẩm.” | 23/05/2026 (trang cập nhật 14/05/2026; mức mới áp dụng 23/05/2026) | verified |
| `voucher_xtra.fee_cap_dong_per_product` | đồng/sản phẩm | **50.000** | [article 18182](https://banhang.shopee.vn/edu/article/18182): “Phí dịch vụ … tối đa 50.000đ/sản phẩm.” | 23/05/2026 | verified |
| `voucher_xtra.fee_formula` | đồng/sản phẩm | `min(fee_base × 0.055, 50_000)`; `fee_base` phải được lưu phiên bản vì nguồn công khai chỉ nói “giá trị mỗi sản phẩm” | Hai câu rate/cap của [article 18182](https://banhang.shopee.vn/edu/article/18182) ở trên. | 23/05/2026 | verified (rate/cap); CHƯA XÁC MINH (fee base chi tiết) |
| `voucher_xtra.min_commitment_days` | ngày | **15** | [article 18182](https://banhang.shopee.vn/edu/article/18182): “Người bán cần tham gia gói trong ít nhất 15 ngày kể từ ngày kích hoạt thành công mới được phê duyệt thay đổi gia hạn/ngừng tham gia gói.” | Không nêu ngày hiệu lực riêng; áp dụng theo trang gói đang hiệu lực | verified |
| `voucher_xtra.cofund_exclusive` | bool | `true` | [article 18182](https://banhang.shopee.vn/edu/article/18182): “Từ ngày 01/10/2025, trong thời gian tham gia Gói Voucher Xtra, Chính sách Đồng Tài Trợ Mã ưu đãi sẽ không đồng thời áp dụng…” | 01/10/2025 | verified |
| `freeship_xtra.available_non_mall` | bool | `false` | [Seller Education Hub, article 12073](https://banhang.shopee.vn/edu/article/12073): “Từ ngày 01/04/2025, Gói Freeship Xtra sẽ ngừng cung cấp cho Người bán không thuộc Shopee Mall.” | 01/04/2025 | verified |
| `freeship_xtra.service_fee_bps` | bps | **CHƯA XÁC MINH — để trống** | Không dùng mức 8%/7,85% từ blog: không có trang official 2025–2026 đang hiệu lực đã đọc nêu rate, đồng thời gói non-Mall đã dừng. | — | CHƯA XÁC MINH |
| `freeship_voucher.seller_subsidy_dong` | đồng/đơn hoặc đồng/sản phẩm | **CHƯA XÁC MINH — per-campaign config** | Chính sách chung chỉ xác nhận family freeship và đây là ngoại lệ cofund; không nêu seller share/rate. | 23/05/2026 | CHƯA XÁC MINH |

**Quyết định cho Margin Guard:** `programme_enrolment` cần giữ
`programme=voucher_xtra`, `active_from`, `lock_until`, `fee_schedule_version`
và trạng thái `committing`. Tham gia/rời Voucher Xtra luôn cần seller approval;
[15 ngày](https://banhang.shopee.vn/edu/article/18182) khiến nó không thể được xử lý như hành động undo được. Không tạo
enrolment Freeship Xtra mới cho non-Mall 2026.

## Những điểm chưa xác minh

- Ma trận stack chính xác giữa shop voucher, platform voucher, Hoàn Xu,
  livestream, freeship và voucher đối tác; policy chung chỉ đặt default “không
  kết hợp”, còn terms từng voucher mới quyết định ngoại lệ.
- Funding/cost của Voucher Shopee Live, Hoàn Xu và voucher freeship theo campaign;
  không có rate chung chính thức trong nguồn đã đọc.
- Affiliate/KOC commission VN, điều kiện attribution và liệu một mã partner cụ
  thể có phải affiliate hay không. Không suy từ trang Shopee Singapore hay blog.
- Cơ sở tính chi tiết của phí Voucher Xtra sau khuyến mãi/voucher và status
  Freeship Xtra cho Mall; không lấp bằng mức fee lịch sử.
- Min/max tổng lượt dùng voucher ở toàn platform; hiện chỉ biết đây là field
  cấu hình shop và per-buyer default 1, max 5.

## 5 đề xuất field bổ sung cho schema

- `voucher.benefit_type` (`cash_discount` / `coin_cashback` / `shipping_subsidy`)
  và `voucher.scope` để không đánh đồng `Hoàn Xu`, live và freeship với `kind`.
- `voucher_compatibility` (pairwise/tuple rule, `allowed`, `source_url`,
  `effective_from`, `terms_snapshot_hash`) thay cho một `stackable` boolean.
- `voucher.eligibility_basis` + `min_spend_basis` + `eligible_sku_set_id`, để
  engine xét điều kiện ở basket rồi phân bổ auditably về order line.
- `funding_rule` versioned (`seller_share_bps`, `seller_cap_dong_per_product`,
  `excluded_family`, `policy_version`) tách khỏi voucher instance.
- `programme_enrolment.fee_basis`, `fee_schedule_version`, `commitment_days`,
  `approval_required` và `source_url` để Voucher Xtra/Freeship Xtra không bị
  biến thành một rate hard-code hoặc một action có thể undo sai.
