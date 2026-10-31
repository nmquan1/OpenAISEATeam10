# Dữ liệu để chọn voucher phù hợp sản phẩm và người bán

Trạng thái: **contract đề xuất**. Prototype hiện dùng baseline kịch bản; chưa triển khai nhập CSV, hiệu chuẩn demand, nối Shopee hoặc suy ra tác động nhân quả từ lịch sử. File [history-template.csv](../data/history-template.csv) chỉ chứa header, không có số liệu được giả làm dữ liệu thật.

## Vì sao cần dữ liệu

Với giá trị giỏ hàng đủ điều kiện `B`, voucher 50% cap 10.000đ cho mức giảm `min(0,5 × B, 10.000đ)`, trước quy tắc làm tròn của engine. Voucher cố định 10.000đ cho mức giảm `min(B, 10.000đ)`. Khi `B ≥ 20.000đ`, hai voucher giảm cùng số tiền **nếu** có cùng min spend, eligibility, quota, thời gian, stacking và nguồn tài trợ. Ví dụ giỏ 40.000đ: cả hai giảm 10.000đ; giỏ 15.000đ: lần lượt 7.500đ và 10.000đ nếu đều đủ điều kiện.

Số tiền bằng nhau không chứng minh hiệu quả hành vi bằng nhau: cách hiển thị “50%” và “10k” có thể đổi tỷ lệ click, đổi giỏ và redeem. Chưa đo thì phải xem tác động này là chưa biết. Cũng chưa thể kết luận “tốt nhất” nếu chưa biết COGS, phí, return cost, tồn kho, mục tiêu và phân bố giỏ hàng của shop.

## Grain và đơn vị

CSV là dữ liệu **tổng hợp theo shop ẩn danh × time bucket × campaign × experiment arm × segment × SKU × basket band**. Các dòng là các ô không giao nhau; không nhân bản tổng visits/orders toàn shop lên từng SKU. Mỗi đơn được gán một primary SKU theo quy tắc cố định để cộng orders mà không double count; line-level units/revenue/cost được phân bổ về ô đó. `sku_id=__ALL__` dùng khi chỉ có dữ liệu shop; không cộng các dòng aggregate đó với dòng chi tiết.

Không gửi tên, điện thoại, địa chỉ, email, buyer ID hay nội dung chat. `shop_key` là mã nội bộ giả danh. Segment là cohort tổng hợp (new/returning/unknown), không phải hồ sơ cá nhân. Gộp cohort quá nhỏ theo chính sách dữ liệu của team.

| Nhóm field | Ý nghĩa |
|---|---|
| `bucket_start`, `bucket_end`, `timezone` | ISO timestamp có offset; thường bucket theo giờ ngày sale, ngày ở giai đoạn thường; timezone Asia/Ho_Chi_Minh |
| `shop_key`, `campaign_id`, `event_type`, `category_id`, `sku_id`, `segment`, `basket_band` | Context để so sánh cùng shop/category/khách/giỏ; event_type normal/mega_sale; basket band lấy trước voucher |
| `experiment_id`, `arm`, `assignment_unit`, `allocation_probability_bps` | Metadata thử nghiệm ngẫu nhiên; để trống nếu observational; không tự nhận causal |
| `eligible_exposures`, `product_clicks`, `product_visits`, `orders`, `units` | Exposure đủ điều kiện, click, visit và đơn hoàn tất đặt; cùng phạm vi attribution/window được ghi trong manifest |
| `voucher_redemptions`, `cancelled_orders`, `returned_orders`, `refused_orders`, `outcome_matured_at` | Dùng voucher và outcomes; cancelled/returned/refused phải phân loại loại trừ nhau; chờ đủ cửa sổ outcome |
| `gross_sales_dong`, `shop_discount_dong`, `seller_platform_cofund_dong`, `platform_subsidy_dong` | Tổng giá trị và khoản trợ giá ở ô; subsidy sàn không được trừ vào chi phí shop lần nữa |
| `cogs_dong`, `packaging_dong`, `seller_shipping_dong`, `platform_fees_dong`, `tax_dong`, `ad_spend_dong`, `return_loss_dong` | Tổng chi phí đã phân bổ cho ô; quy ước fee/tax không trùng; return_loss chỉ phần bổ sung chưa có trong COGS/các dòng khác |
| `reference_price_dong`, `selling_price_dong`, `stock_start_units`, `stockout_minutes`, `capacity_orders` | Giá, khả năng bán và supply censoring; nếu giá đổi thì tách bucket |
| `voucher_type`, `voucher_value`, `voucher_cap_dong`, `min_spend_dong`, `quota`, `seller_funding_bps`, `stacking_policy_id` | Fixed: value đồng; percent: value bps (50%=5000); policy ID trỏ bản ghi eligibility/time/stacking trong manifest |
| `traffic_source`, `fee_schedule_version`, `source`, `observed_at`, `data_status` | Organic/paid/mixed, version phí, nguồn export và trạng thái verified/user/default |

Manifest đi cùng dataset phải ghi: định nghĩa exposure, attribution window, thời điểm hoàn tất return window, cách phân bổ chi phí/primary SKU, eligibility voucher, thời gian hiệu lực, khuyến mãi đồng thời và dữ liệu thiếu. Blank khác zero; không điền zero cho dữ liệu không có.

## Tối thiểu để tính và để học

Để tính lợi nhuận từng phương án: giá/basket, COGS, fees có basis rõ, seller funding, voucher rule, shipping/ads/return cost và constraints. Để ước lượng demand: exposures/visits, orders, phân bố basket, redemption, giá, campaign/time/segment và stock availability. Orders một mình không phân biệt traffic tăng với conversion tăng; stockout khiến observed demand bị chặn dưới.

Để học framing 50% cap10k so với fixed10k: chạy hai arm cùng giá, eligibility, min spend và ngân sách, randomize ở đơn vị tránh một khách nhìn cả hai ưu đãi trong cùng cửa sổ. CSV chỉ giữ tổng hợp và assignment metadata. Outcome chính là contribution profit trên eligible exposure; phụ là CVR, redemption, AOV, return/cancel và budget burn. Phải định nghĩa denominator trước; không chỉ so profit trên những đơn đã redeem vì selection bias.

Tính `CVR = orders / product_visits`, `CTR = product_clicks / eligible_exposures` khi denominator tương ứng thật sự cùng scope. Với nhiều dòng, dùng tổng numerator/tổng denominator, không trung bình tỷ lệ. Redeem rate phải nói rõ tính trên orders hay voucher-eligible exposure. Zero denominator trả unavailable. Profit cần engine với fee schedule và return accounting thống nhất, không để LLM tự cộng.

Không đặt một sample size chung cho mọi shop. Tính trước từ baseline metric, minimum detectable effect, variance, randomization unit, mức tin cậy và power; xét seasonality, clustering và multiple comparisons. Holdout theo thời gian/campaign giúp đo dự báo; chỉ thử nghiệm đủ thiết kế hoặc phương pháp causal có giả định được bảo vệ mới hỗ trợ kết luận tác động. Không ngoại suy ngày thường thành 11.11 bằng một hệ số toàn sàn cố định.

## Seller context và API đề xuất

Ngoài số liệu, có thể nhận `seller_context` là string tùy chọn: “shop mới, ưu tiên khách mới; biên thấp, không muốn lỗ; chỉ xử lý được ... đơn/ngày”. Context giúp Setup hỏi/đề xuất cấu hình. Những con số hoặc constraints trích từ lời người bán phải trở thành field typed có provenance `user`, hiển thị để xác nhận; không được âm thầm override giá vốn/ngân sách đã nhập.

Đề xuất request tương lai:

```json
{
  "config_id": "cfg_example",
  "seller_context": "Ưu tiên lợi nhuận và tránh hết voucher trước buổi tối",
  "history_dataset_id": null,
  "objective": "max_profit"
}
```

`history_dataset_id=null` nghĩa là chưa có dataset; output phải ghi `scenario_only`, không `calibrated`. Endpoint ingest/calibrate và field trên là **thiết kế**, không cam kết đã được prototype phục vụ. Dữ liệu lịch sử sau ingest cần schema validation, manifest/version/hash và quality report trước khi cho model đọc phần tóm tắt.

LLM nhận aggregate context, assumptions và result refs; không nhận raw buyer data. Candidate generation dùng seller objective và product economics. Ranking vẫn do engine/optimizer làm; trả “tốt hơn trong kịch bản X” và yếu tố khiến thứ hạng đổi, thay vì “voucher này chắc chắn tối ưu cho shop”.
