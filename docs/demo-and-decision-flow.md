# Demo và luồng ra quyết định

App đề xuất voucher để người bán so sánh trước khi thử nghiệm. **LLM tạo ứng viên; engine tính tiền, kiểm tra ràng buộc và xếp hạng.** Kết quả là mô phỏng theo dữ liệu và giả định đã nhập.

## Demo trong 6 bước

1. **Chuẩn bị:** chạy app theo [README](../README.md). Muốn gọi AI thật, điền `OPENAI_API_KEY` và `OPENAI_MODEL` trong `.env` ở thư mục gốc repo rồi khởi động lại backend; thiếu cấu hình thì vẫn dùng mô phỏng. Kiểm tra `/api/health` và trạng thái AI trước buổi demo.
2. **Tab “Nhập số liệu”:** nhập giỏ hàng, giá vốn, phí, tồn kho, ngân sách, phần shop tài trợ và giả định traffic/CVR/uplift. Chọn mục tiêu. Chờ engine tính xong; ghi lại đầu vào để so sánh cùng một điều kiện.
3. **Tab “Kết quả”:** xem “Phương án cơ sở”, chọn từng chiến lược và đọc dashboard doanh thu, chi phí, lợi nhuận ở các kịch bản. Đây là kết quả engine, chưa phải AI. “Không voucher” có thể đứng đầu nếu giảm giá không bù được chi phí theo giả định hiện tại; dùng chênh lệch doanh thu, chi phí và lợi nhuận để giải thích điều kiện đó, không chỉnh số chỉ để ép voucher thắng. Nếu thử độ nhạy bằng cách đổi response curve, ghi rõ đây là giả định mô phỏng, chưa được lịch sử hiệu chuẩn.
4. **Tab “Nhờ AI”:** thêm “Ghi chú về shop và khách hàng”. Mở “Reference lịch sử nước ngoài · tùy chọn”, bấm preset **“Tham khảo cơ chế % + trần + đơn tối thiểu”** (điền `source:uci voucher geometry cap minimum` vào “Tìm reference cho AI”), rồi bấm **“Xem reference · không gọi AI”**. Kiểm tra nguồn, đơn vị tiền, mẫu số và giới hạn trên card. Để ô trống thì retrieval tắt; app không tự tìm reference từ tên sản phẩm, ghi chú hoặc CSV lịch sử.
5. **Bấm “Đề xuất bằng AI”:** đây mới là bước gọi provider, có thể phát sinh phí. Khi thành công, app chuyển về “Kết quả” với “Ứng viên có AI”; so sánh tối đa 5 chiến lược đứng đầu. Nếu có báo lỗi lần gọi AI, không dùng kết quả cơ sở hoặc kết quả AI cũ làm bằng chứng cho lần gọi đó.
6. **Chọn và lưu:** bấm “Xuất phương án đang chọn” để giữ đầu vào, kết quả và reference đã cung cấp; dùng “Áp dụng voucher vào thiết lập” để đưa cấu hình về form và tính lại. Tab “Công cụ khác” chứa công cụ bổ sung/lịch sử. Chưa có thao tác đăng voucher lên sàn.

Nút “Nhập lịch sử sale CSV” nhận schema `label,visits,orders,revenue_dong,voucher_spend_dong` của merchant. File reference gần một triệu dòng không tương thích importer này. Reference tổng hợp đã có trong app; không cần tải CSV lớn lên UI. Ghi chú/lịch sử hỗ trợ AI chọn ứng viên, không tự sửa chi phí, ngân sách hoặc hiệu chỉnh response curve.

## App chọn phương án bằng cách nào?

- **Bộ so sánh:** không voucher, voucher hiện tại giảm 40% ưu đãi, voucher hiện tại; khi gọi AI thành công thêm tối đa 5 cấu hình AI. Mọi phương án đi qua cùng engine và response curve.
- **Tiền giảm:** với giỏ đủ minimum spend, voucher phần trăm giảm `min(rate × giá trị giỏ, cap)`; engine tính phần shop tài trợ, phí, giá vốn và kiểm tra quota/ngân sách/tồn kho. Tiền dùng số học nguyên chính xác với quy tắc làm tròn theo đơn.
- **An toàn (`safe`):** điểm là lợi nhuận thấp nhất trong ba kịch bản. **Cân bằng (`balanced`):** điểm là `70% lợi nhuận cơ sở + 30% lợi nhuận thấp nhất`, làm tròn theo engine. **Tăng trưởng (`growth`):** điểm là doanh thu kịch bản cơ sở; không phải tối đa lợi nhuận.
- **Xếp hạng:** điểm giảm dần; hòa điểm ưu tiên mức giảm thấp hơn rồi ID ổn định. Các voucher có cùng tiền giảm và phần shop tài trợ trên giỏ hiện tại được gộp; UI lấy top 5. Sự tương đương này chỉ áp dụng cho giỏ đang tính.
- **“Cơ sở” và 70/30:** đây là kịch bản và trọng số chính sách, không phải kỳ vọng thống kê hay xác suất đã học từ lịch sử.

## Demo chứng minh được gì?

- Preview chứng minh app truy xuất reference có nguồn, mẫu số, giới hạn và hash/version; preview không cần key, không gọi OpenAI.
- Một lần AI thành công chứng minh luồng context → provider → validation → engine → dashboard/export hoạt động với cấu hình hiện tại.
- Reference trong kết quả là **dấu vết context đã cung cấp**, không phải citation do model tạo hoặc bằng chứng model đã dùng đúng từng card.
- Test và benchmark offline kiểm tra hợp đồng, tính toán, truy xuất và khả năng tái lập; chưa chứng minh LLM đề xuất tốt hơn grid search hoặc làm tăng lợi nhuận thực tế.

## Lần chạy AI thật đã kiểm tra

Ngày 31/10/2026, case `high-headline-small-cap` chạy một cặp A/B với `gpt-6-astra`: **1 case, 2 lần gọi**, cùng input hash/model/prompt; cả hai response hợp lệ, không vi phạm ràng buộc. Nhánh có reference nhận 4 card; cả hai nhánh đều chọn baseline **không voucher**, cùng điểm **28.951.425**. Tổng chi phí ước tính theo token và đơn giá cấu hình là **$0,08951**, không phải số đối soát hóa đơn.

Lần smoke test này xác nhận luồng AI thật và phép so sánh A/B chạy được; **không cho thấy retrieval cải thiện xếp hạng**. Một cặp chưa đo độ ổn định hay chất lượng tổng quát. Báo cáo cục bộ, không commit: `.local/evidence-eval/2026-10-31T08-00-30-974Z-live/report.json` và `runs.csv`.

Muốn chạy lại (có phí, cần cấu hình model và đơn giá trong `.env`):

```sh
npm run eval:evidence -- --live --case high-headline-small-cap --repeats 1 --max-calls 2 --max-cost-usd 2
```

## Chưa giải quyết được

- Engine dùng giỏ cố định; minimum spend chưa mô phỏng khách mua thêm, đổi giỏ hay phản ứng tâm lý với headline % cao.
- Dữ liệu lịch sử nước ngoài không hiệu chuẩn CVR/elasticity/uplift cho shop Việt Nam; mua kèm không chứng minh tác động nhân quả, replay voucher không phải kết quả chiến dịch thật.
- Provider trả cấu hình voucher; chưa có lời giải thích quyết định hoặc citation theo evidence ID để đánh giá chất lượng lập luận.
- Smoke test live hiện tại chưa chứng minh lợi ích riêng của LLM hoặc retrieval; cần nhiều case/lần lặp có ngân sách và ghi nhận cả trường hợp thất bại hoặc không cải thiện.
- Chưa tự publish voucher, đồng bộ đơn hàng hoặc đo outcome sau hủy/hoàn từ sàn.
- App là workspace dùng chung, không đăng nhập/phân quyền theo người dùng; giới hạn lượt gọi không thay thế tenant isolation.

Chi tiết: [tích hợp reference](evidence-integration.md), [benchmark và giới hạn đánh giá](evidence-evaluation.md), [API/Swagger](api.md), [nguồn và provenance](../data/evidence/README.md).
