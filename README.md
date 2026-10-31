# Market Maker

Ứng dụng lập chiến lược voucher cho ngày sale lớn, theo theme Shopee. Stage hiện tại là **mô phỏng một SKU/đơn có đề xuất AI**, với data contract dùng chung và API chia theo route; chưa phải dịch vụ production đa người dùng.

## Chạy local

Node.js >=22; không có dependency runtime.

```sh
npm ci
cp .env.example .env
npm start
```

Mở http://localhost:4173. Mô phỏng không cần key. Để dùng “Đề xuất bằng AI”, điền `OPENAI_API_KEY` vào `.env` rồi restart server. `npm run dev` chạy cùng service; `npm run check` kiểm tra cú pháp JS/MJS, chạy tests và build UI. Root dùng npm workspaces `backend` và `frontend`; `npm --prefix backend start` cũng khởi động app từ package backend. `npm run build` xuất frontend tĩnh vào `dist/`; artifact này không chứa API AI.

Server bind `127.0.0.1`, kiểm tra Host/Origin của localhost, giới hạn body/rate/concurrency và có graceful shutdown. `PORT` phải là số nguyên 1–65535. Không đưa key hoặc token server vào trình duyệt.

## App làm được gì ở stage hiện tại

App có giao diện nhập sản phẩm, giá vốn/phí, voucher, tồn kho, ngân sách, traffic/CVR và khẩu vị; so sánh không voucher, giảm 60% mức ưu đãi và voucher đầy đủ qua ba kịch bản traffic; hiển thị đơn hàng, chi voucher, doanh thu/lợi nhuận và xuất kế hoạch JSON.

Nút AI gửi input và bối cảnh tới provider qua server, nhận tối đa 5 cấu hình voucher, thêm baseline/current voucher rồi dùng engine xác định để xếp hạng. Thiếu key hoặc provider lỗi trả lỗi rõ; không thay bằng dữ liệu giả. Chưa xác minh gọi live bằng key ở lần kiểm tra này; tests dùng provider stub. Roundtable Finance/Growth/Risk trên màn hình là phần diễn giải demo, không phải ba agent đang tranh luận.

Backend bổ sung shared validator, tách route health/evaluate/recommend, phân loại lỗi HTTP, request ID, kiểm tra Host/Origin, bearer token tùy chọn cho client server-to-server và kiểm thử biên. Frontend và backend dùng cùng engine để tránh hai phiên bản công thức.

## Cấu trúc project

```text
backend/
  src/server.mjs          entrypoint, cấu hình và graceful shutdown
  src/api/                app, HTTP helpers, routers theo chức năng
  src/agent/              provider và xếp hạng voucher candidate
  src/engine/             engine xác định, dùng chung với trình duyệt
  test/                   kiểm thử model, engine, provider và HTTP
frontend/
  index.html
  src/                    giao diện và stylesheet
contracts/
  model.js                validator, defaults và kiểu dữ liệu đầu vào
scripts/                  build và kiểm tra từ root
docs/                     nghiên cứu, kiến trúc và HTTP/data contracts
data/                     CSV template
```

[Backend](backend/README.md), [frontend](frontend/README.md) và [contracts](contracts/README.md) có hướng dẫn riêng. Cấu trúc bám `../margin-guard` theo trách nhiệm; không tạo các module database, guardrail hoặc MCP khi app chưa triển khai chúng. Backend phục vụ frontend và API trên cùng origin; `/engine/index.js` và `/contracts/model.js` là hai module dùng chung được allowlist rõ, không mở cả thư mục backend làm static assets.

### Data model và API

`contracts/model.js` là nguồn validation dùng chung cho trình duyệt, engine và HTTP boundary. Tiền là số nguyên đồng; dữ liệu đếm là số nguyên; phần trăm vẫn dùng đơn vị `%` của UI. API yêu cầu đầy đủ input và từ chối field lạ thay vì âm thầm chấp nhận hoặc đổi kiểu.

| Route | Chức năng |
|---|---|
| `GET /api/health` | Trạng thái tiến trình và phiên bản contract |
| `POST /api/evaluate` | Validate input rồi tính ba chiến lược bằng engine |
| `POST /api/recommend` | Validate input/context, gọi provider và tính lại/xếp hạng candidate |

Xem [HTTP contract, bounds và lỗi](docs/api.md). Token `MARKET_MAKER_API_TOKEN` tùy chọn chỉ dành cho API client/gateway; UI chưa có luồng đăng nhập hoặc gửi token. Bật token sẽ chặn request AI từ UI hiện tại.

## Checkout/review và merge tuần tự

Stack chức năng được tích hợp theo thứ tự dưới đây. Năm branch sau foundation đã được merge local vào `main` sau khi chạy kiểm tra CI tương ứng trên Node 22 trước mỗi merge. Bảng giữ lại kết quả kiểm tra ở commit gốc để giải thích khả năng của từng stage; script và cấu trúc project hiện tại đã được cập nhật ở thay đổi tiếp theo.

| Thứ tự | Branch · commit gốc | Stage và kết quả kiểm tra ở commit đó |
|---|---|---|
| 1 | `chore/market-maker-foundation` · `28823df` | Scaffold, scripts, CI. `npm run check` lỗi vì chưa có `src/engine.js`; chưa có UI để mở. CI đã kiểm tra scaffold theo điều kiện. |
| 2 | `feat/market-maker-strategy-engine` · `512c459` | Engine xác định và 5 tests pass. Full check dừng ở build vì chưa có `index.html`; chưa có UI. |
| 3 | `feat/market-maker-workbench` · `4b11ced` | Giao diện, ba kịch bản, biểu đồ và export kế hoạch. 5 tests + build pass. |
| 4 | `docs/market-maker-recommendation-design` · `a1d5c69` | Thêm nghiên cứu và thiết kế recommendation; khả năng runtime như workbench. 5 tests + build pass. |
| 5 | `feat/market-maker-live-ai` · `dc2eac8` | Backend provider, env và tests AI; UI chưa nối nút AI. 10 tests + build pass. |
| 6 | `feat/market-maker-ai-workbench` · `417c4db` | UI AI và data docs nối backend. 10 tests + build pass ở commit gốc. |

GitHub Actions chạy khi push/PR, đóng gói preview thành artifact; không tự deploy hoặc merge. Branch protection/required checks phải được cấu hình trên GitHub nếu muốn bắt buộc CI trước merge. Kết quả lỗi `npm run check` ở hai commit đầu là trạng thái lịch sử; CI của từng stage dùng điều kiện kiểm tra scaffold, engine hoặc UI khi các file tương ứng tồn tại.

## Đối chiếu repo hàng xóm và giới hạn

Đã đối chiếu `../margin-guard`: backend đó tách router theo miền, có domain model/contracts chặt và dùng giỏ hàng làm đơn vị tính, tiền đồng nguyên và rate bps. Market Maker học cách chia route/validate boundary, nhưng **không dùng chung contract hay engine** với Margin Guard. Không truyền trực tiếp input giữa hai API: ví dụ `15` ở fee UI này là 15%, không phải 15 bps.

Market Maker vẫn giới hạn một SKU/đơn, phí tổng hợp sau voucher và traffic/uplift do người dùng giả định. Chưa tính giỏ nhiều SKU, hoàn xu, voucher sàn cộng dồn, hoàn hàng, shipping/ads hoặc bảng phí thực tế. Mã/phạm vi/thời gian chỉ là metadata kế hoạch, không tự thực thi eligibility hoặc đồng bộ Shopee. Cùng uplift đang được dùng cho các voucher có discount; chưa học elasticity/framing. Kết quả là tốt nhất trong các ứng viên dưới giả định nhập, không phải tối ưu toàn thị trường hay dự báo được hiệu chỉnh.

CSV template chỉ là contract đề xuất, chưa có ingest/calibration. Không gửi thông tin cá nhân hoặc secrets trong AI context. Context giúp tạo candidate; không âm thầm override số liệu typed của người bán.

## Các bước để triển khai production công khai

1. Bổ sung gateway xác thực, quản lý phiên/người dùng, tenant authorization, TLS và cấu hình domain/Host tin cậy; không mở trực tiếp local server hiện tại ra Internet.
2. Lưu cấu hình/kết quả theo version với provenance và audit trail, database migrations, backup/restore; hiện người dùng chỉ xuất JSON.
3. Thêm quota/cost budget theo tenant và giới hạn phân tán, monitoring/alerting, log vận hành có redaction và kiểm tra phục hồi. Rate/concurrency hiện tại chỉ có hiệu lực trong một process.
4. Quyết định tích hợp engine giỏ hàng Margin Guard hoặc mở rộng domain có kiểm thử parity: integer money/bps, fee schedule version, phân bổ voucher, shipping, hoàn hàng và seller funding. Không đổi tên mô hình đơn SKU thành mô hình tài chính production.
5. Kiểm thử browser và end-to-end với provider trong môi trường triển khai, kiểm tra tải, lỗi mạng và quy trình release/rollback. Chỉ bật ingest/lịch sử khi có schema, quality report và quy tắc provenance rõ.

## Tài liệu

- [HTTP contract và vận hành](docs/api.md)
- [Nghiên cứu và thống kê](docs/research.md)
- [Kiến trúc recommendation](docs/architecture.md)
- [Data contract và CSV](docs/data-contract.md)
- [CSV template](data/history-template.csv)
