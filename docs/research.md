# Market Maker — evidence register và thiết kế thử nghiệm

Ngày kiểm tra: 31/10/2026. Đây là cơ sở nghiên cứu, không phải bằng chứng rằng prototype đã dự báo chính xác lợi nhuận 11.11. Mọi multiplier demo phải mang nhãn giả định; không dùng thống kê toàn sàn làm dự báo cho một SKU.

## Voucher: nguồn người dùng cung cấp

[Shopee Uni PDF](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/6d2e4faf6824474888d82452fbd4ce64/T%C3%ACm%20hi%E1%BB%83u%20c%C3%A1c%20CCKM%20c%E1%BB%A7a%20Shopee.pdf), cập nhật 08/10/2020. Trang 81 là mẹo; cấu hình nằm ở trang 73–78. Đây là quy tắc lịch sử, chưa xác nhận chính sách hiện hành.

| Input     | Theo tài liệu                                                      |
| --------- | ------------------------------------------------------------------ |
| Phạm vi   | Toàn shop / sản phẩm chọn                                          |
| Loại      | Khuyến mãi / hoàn xu                                               |
| Giảm      | Tiền / phần trăm; hoàn xu chỉ phần trăm                            |
| Ràng buộc | Trần giảm %, đơn tối thiểu, thời gian, số lượng                    |
| Định danh | Tên chương trình; mã A–Z/0–9 tối đa 5 ký tự                        |
| Lượt dùng | Một lần/người mua/mã                                               |
| Hiển thị  | Công khai, Live/Feed, chia sẻ mã; voucher sản phẩm không công khai |

Không hard-code giới hạn cũ thành policy hiện hành. Lưu `policyVersion`, nguồn, ngày hiệu lực và trạng thái xác minh. Budget, phí, tồn kho và khẩu vị rủi ro là input Market Maker bổ sung.

## Thống kê và mức độ áp dụng

| Bằng chứng                                                                                                                                                                              | Số liệu đã kiểm tra                                                                                                                                  | Dùng vào Market Maker                                      | Giới hạn                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [Shopee Marketing Solutions, 11.11 2021](https://ms.shopee.com/news/shopee-excites-shoppers-and-uplifts-businesses-with-new-record-of-over-2-billion-items-sold-across-11-11-big-sale/) | Hơn 2 tỷ sản phẩm suốt chiến dịch; seller lần đầu tham gia có số đơn ngày 11/11 gấp 18 lần ngày trung bình; Premium brands bán gấp 50 lần tuần trước | Stress test nhiều mức cầu, phân nhóm seller                | Thông cáo marketing khu vực; không phải traffic VN, không phải causal uplift. Trang trả 403 khi mở trực tiếp; số liệu đọc từ bản index tìm kiếm |
| [Alibaba, 11.11 2024](https://www.alibabagroup.com/en-US/document-1792798062653997056)                                                                                                  | Hơn 800.000 merchants dùng hơn 2 triệu phân tích traffic; gần 290.000 merchants có tăng trưởng sales cho hơn 1,6 triệu sản phẩm với Quanzhantui      | Chứng cứ nhu cầu phân tích/AI hỗ trợ merchant ở quy mô lớn | Tmall/Taobao Trung Quốc, 14/10–11/11; số liệu chưa kiểm toán, không chứng minh LLM tạo incremental profit                                       |
| [RAP, EMNLP 2023](https://arxiv.org/abs/2305.14992)                                                                                                                                     | LLaMA-33B + planning hơn GPT-4 CoT 33% tương đối trong một setting plan generation                                                                   | Sinh nhiều candidate rồi đánh giá reward bằng tool         | Không phải bài toán voucher; không được nói lợi nhuận tăng 33%                                                                                  |
| [Tan et al., NeurIPS 2024](https://papers.neurips.cc/paper_files/paper/2024/file/6ed5bf446f59e2c6646d23058c86424b-Paper-Conference.pdf)                                                 | Ablation 3 phương pháp LLM forecasting trên 8 benchmark; bỏ/thay LLM thường không làm giảm chất lượng                                                | Forecast phải có baseline thống kê và ablation             | Không kết luận mọi mô hình ngôn ngữ đều vô dụng                                                                                                 |
| [Qiu et al., 2026, preprint](https://arxiv.org/abs/2602.14744)                                                                                                                          | 8 tỷ observations, 17 scenarios, 4 horizons; pre-alignment hơn post-alignment ở trên 90% tasks                                                       | Có hướng nghiên cứu hybrid khi đủ dữ liệu                  | Kết quả theo setup của tác giả; không chứng minh hiệu quả seller VN                                                                             |

Không tìm được bộ dữ liệu công khai đã xác minh có đủ session → voucher exposure → redemption → net profit theo SKU/ngày cho Shopee VN 11.11. Vì vậy chưa có cơ sở hợp lệ để cung cấp một hệ số traffic hoặc conversion uplift chung.

## Vai trò LLM và khẩu vị người bán

[Du et al., ICML 2024](https://arxiv.org/abs/2305.14325) cho thấy tranh luận nhiều model cải thiện reasoning/factuality trong các tác vụ nghiên cứu. Không có bằng chứng ở nguồn này rằng đồng thuận agent là xác suất đúng hoặc đảm bảo lợi nhuận. [Large Language Model Driven Recommendation](https://arxiv.org/abs/2408.10946) phân loại dữ liệu thành mô tả item, lịch sử tương tác và profile user; hội thoại giúp làm rõ sở thích. Áp dụng sau đây là thiết kế đề xuất của Market Maker:

1. Hỏi mục tiêu: contribution profit, giải phóng tồn, khách mới; mức lỗ tối đa, ngân sách cứng, margin floor và năng lực đóng gói. Không suy diễn khẩu vị từ tuổi/giới tính.
2. Growth agent đề xuất voucher/threshold/timing; Finance agent kiểm tra net economics; Operations agent phản biện stock/capacity; Moderator trả candidate hợp lệ và điều kiện thắng/thua.
3. Agent gọi calculator/simulator; không tự phát minh traffic, elasticity, phí hoặc confidence. Claim phải gắn `evidenceId`, `assumptionId`, `calculationId`.
4. Ràng buộc cứng được kiểm tra ngoài LLM. Lưu ý kiến bất đồng, không ép một đáp án khi thiếu dữ liệu. Người bán vẫn xác nhận trước khi áp dụng.

## Dữ liệu cần thu và thống kê cần tính

| Nhóm            | Fields tối thiểu                                                         | Thống kê / kiểm tra                                                      |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Sản phẩm        | SKU, category, price, COGS, stock, lead time, units/order                | Contribution/unit, margin theo giỏ hàng, khả năng hết hàng               |
| Chi phí         | Phí theo loại/base tính, shipping seller-funded, ads, packaging, returns | Net profit thực nhận; không cộng trùng phí                               |
| Funnel theo giờ | Impressions, clicks, sessions, orders, channel, spend                    | CTR=click/impressions; CVR=orders/sessions; phân biệt traffic với orders |
| Voucher         | Exposure, claims, redemption, basket, eligible SKU, seller-funded amount | Redemption rate với denominator rõ; tỷ lệ đạt ngưỡng; chi phí thực       |
| Sự kiện         | Campaign, ngày/giờ, channel, historical comparable event                 | Uplift theo nhóm, median và quantile, không chỉ average                  |
| Kết quả         | Fulfilled/cancelled/returned, payout timestamp                           | Profit sau hoàn trả; loại leakage từ tương lai                           |

Dùng time split và holdout nguyên event. So seasonal-naive với forecast có event/category/channel, báo MAE/WAPE (xử lý actual tổng bằng 0), quantile loss và interval coverage. Đánh giá incremental voucher effect qua A/B hoặc thiết kế causal có kiểm soát; tương quan discount–sales không đủ để kết luận uplift.

## Mô phỏng và hiển thị được đề xuất

`orders = min(demand, stock / unitsPerOrder, fulfillmentCapacity)` là giới hạn cơ bản, không phải mô hình hành vi đầy đủ. Redemption còn bị chặn bởi eligibility, quota và budget. Tính discount trên đúng eligible basket, sau đó seller-funded costs và fee base theo policy đã xác minh. Hoàn xu cần accounting riêng, không mặc định tương đương giảm tiền ngay.

Khi chưa có lịch sử, chạy bảng sensitivity traffic × CVR × redemption với giả định người dùng có thể sửa. Ghi “kịch bản”, không ghi P10/P50/P90 nếu chưa có phân phối hiệu chỉnh. Khi đủ dữ liệu, bootstrap/calibrated simulation mới cho phép hiển thị quantile và xác suất lỗ.

Output nên có: so sánh profit–downside; heatmap strategy thắng theo traffic/conversion; budget/quota/stock gauges; điều kiện đảo thứ hạng; evidence drawer. Conservative ưu tiên downside và margin, balanced ưu tiên trade-off, growth tăng trọng số units/new customers nhưng vẫn giữ budget cứng. Trọng số là lựa chọn sản phẩm cần công khai và kiểm nghiệm, không phải kết quả nghiên cứu.

Baseline field guide tại `Downloads/margin-guard-field-guide.html` nhấn mạnh thử plan trên khách mô phỏng, so khoảng lợi nhuận và giữ người bán kiểm soát. Market Maker kế thừa nguyên tắc đó, bổ sung roundtable có nguồn và recommendation có điều kiện. Các hệ số mô phỏng phải được kiểm nghiệm ngoài dữ liệu sinh bởi chính LLM.
