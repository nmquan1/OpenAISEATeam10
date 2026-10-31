# Market Maker

Prototype lập chiến lược voucher cho ngày sale lớn, theo theme Shopee.

## Chạy local

Node.js >=22; không có dependency runtime.

```sh
npm ci
npm run dev
```

Mở http://localhost:4173. `npm run check` chạy kiểm tra engine và build; `npm run build` xuất `dist/`.

## Phạm vi

Nhập sản phẩm, chi phí/phí, voucher, tồn kho, ngân sách, traffic/CVR và khẩu vị. Engine so sánh voucher gốc, mức giảm 60% và không voucher qua ba kịch bản. Đây là mô phỏng minh bạch theo giả định người dùng, chưa phải dự báo được hiệu chỉnh; roundtable trong UI là demo, chưa gọi LLM hoặc Shopee. Không nhập secret vào trình duyệt.

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
