# Brief: Margin Guard input research (time-box 15 phút)
Problem: tìm strategy voucher + combination (voucher stack, giá, chương trình) cho merchant sàn TMĐT VN (Shopee trọng tâm; Lazada/TikTok Shop để so sánh) sao cho combination đạt lợi nhuận tốt nhất mà không âm margin.
Margin Guard cần 3 nhóm INPUT: (1) Voucher (2) Pricing (3) Strategy.
Đọc nhanh schema hiện có: docs/legacy/margin-guard/design-docs/07-data-schemas.md và 02-domain-facts.md.
Yêu cầu output: file markdown của bạn trong docs/research/margin-guard-inputs/, gồm:
- Bảng các field/tham số cụ thể (tên, đơn vị, giá trị ví dụ/range thực tế VN 2025-2026), mỗi dòng có nguồn URL + mức tin cậy (verified/secondary/assumption).
- Ghi rõ gì chưa xác minh được. Không bịa số. Ưu tiên nguồn chính thức (Seller Center, banhang.shopee.vn, trung tâm hỗ trợ người bán).
- Cuối file: 5 gạch đầu dòng "đề xuất field bổ sung cho schema".

## Quy tắc dữ liệu (bắt buộc)
- Mỗi con số PHẢI có URL nguồn mở được + ngày hiệu lực + trích nguyên văn câu chứa số đó (quote).
- Không có nguồn → ghi "CHƯA XÁC MINH", để trống giá trị. Tuyệt đối không ước lượng/bịa.
- Nhãn: verified (trang chính thức Shopee/Lazada/TikTok/văn bản pháp luật), secondary (MISA/Sapo/báo), assumption (cấm dùng cho số).
