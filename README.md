# Market Maker

Prototype lập chiến lược voucher cho ngày sale lớn, theo theme Shopee.

## Chạy local

Node.js >=22; không có dependency runtime.

```sh
npm ci
cp .env.example .env
# Điền OPENAI_API_KEY trong .env rồi:
npm run dev
```

Mở http://localhost:4173. `npm run check` chạy kiểm tra engine và build; `npm run build` xuất `dist/`.

## Phạm vi

Nhập sản phẩm, chi phí/phí, voucher, tồn kho, ngân sách, traffic/CVR và khẩu vị. Engine so sánh voucher gốc, mức giảm 60% và không voucher qua ba kịch bản. Đây là mô phỏng minh bạch theo giả định người dùng, chưa phải dự báo được hiệu chỉnh; roundtable cơ sở là demo. Nút “Đề xuất bằng AI” gọi OpenAI thật qua server; chưa gọi Shopee. Không nhập secret vào trình duyệt.

Mỗi đơn một sản phẩm; chưa hỗ trợ giỏ nhiều SKU, hoàn xu, voucher sàn cộng dồn, hoàn hàng hoặc bảng phí thực tế. Mã/phạm vi/thời gian là metadata kế hoạch. Xem nghiên cứu để phân biệt trường cấu hình trong tài liệu Shopee 2020 với phạm vi đã mô phỏng.

## Review và merge tuần tự

Các branch được xếp chồng, merge theo thứ tự (không squash nếu muốn giữ ancestry cho các PR kế tiếp):

1. `chore/market-maker-foundation` → `main`: scaffold và CI.
2. `feat/market-maker-strategy-engine` → foundation: engine và tests.
3. `feat/market-maker-workbench` → engine: giao diện và export kế hoạch.
4. `docs/market-maker-recommendation-design` → workbench: nghiên cứu, kiến trúc và hướng dẫn.

Sau khi branch cha merge, đổi target PR tiếp theo về `main`. Remote hiện là GitHub, nên tương đương MR là Pull Request. GitHub Actions chạy khi push/PR, đóng gói preview thành artifact; không tự deploy hoặc merge. Muốn bắt buộc CI trước merge cần cấu hình branch protection trong GitHub.

## Tài liệu

- [Nghiên cứu và thống kê](docs/research.md)
- [Kiến trúc recommendation](docs/architecture.md)

Kiến trúc đề xuất mở rộng stack của repo `../margin-guard`; prototype này là lớp khám phá UX độc lập, chưa thay thế backend đó.

## AI thật

`.env.example` có key, model, timeout và port. Key chỉ nằm server; không dùng tiền tố public. Sau khi sửa `.env`, restart `npm run dev`. Chọn model hỗ trợ Responses + Structured Outputs và có quyền truy cập trong project của bạn. Nút AI gửi input/context tới OpenAI; không gửi dữ liệu cá nhân hoặc secrets trong context.

Backend tạo tối đa 5 voucher, thêm baseline và voucher hiện tại, rồi engine rank theo khẩu vị. Đây là một lượt sinh candidate, chưa triển khai roundtable nhiều vòng. Thiếu key/API lỗi trả lỗi rõ, không âm thầm dùng dữ liệu giả. Static artifact `dist/` chỉ chạy mô phỏng; AI cần Node server. Server chỉ bind localhost, chưa có auth/multi-tenant cho hosting public.

Xem [data contract](docs/data-contract.md) và [CSV template](data/history-template.csv). CSV chưa được tự import; context chỉ giúp tạo candidate, chưa huấn luyện/calibrate forecast. Cùng CVR uplift đang được dùng cho mọi candidate có discount, nên chưa phân biệt hiệu ứng framing/elasticity.

API contract kiểm tra theo [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Tests dùng provider stub; chưa xác minh request live với API key.

Branch tiếp theo: `feat/market-maker-live-ai` (server/env/tests) → `feat/market-maker-ai-workbench` (UI/data docs). Merge sau các branch prototype ở trên. Các branch local chưa push được vì DNS GitHub trong môi trường thực thi.
