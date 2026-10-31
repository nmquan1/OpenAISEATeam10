# Market Maker

MVP lập kế hoạch voucher: nhập giỏ hàng/chi phí/traffic, so sánh kịch bản, tùy chọn nhờ OpenAI đề xuất thêm voucher và xuất phương án đang chọn.

## Bắt đầu trong 3 phút

Dùng Node.js 22. Chạy tại root:

```sh
npm ci
cp -n .env.example .env
npm run dev
```

- App React: http://localhost:5173
- API + Swagger **Try it out**: http://localhost:4173/api/docs
- OpenAPI JSON: http://localhost:4173/api/docs/json
- Health/readiness: http://localhost:4173/api/health

Mô phỏng không cần credential. MVP không có đăng nhập; mọi người truy cập cùng một workspace. Lịch sử server được lưu mặc định ở `.local/workspace-runs.json`, không commit vào Git.

Để chạy bản build cùng backend tại http://localhost:4173:

```sh
npm run build
npm start
```

## Bật OpenAI sau

Điền hai giá trị server-only trong `.env`, rồi restart:

```dotenv
OPENAI_API_KEY=your-key
OPENAI_MODEL=your-enabled-responses-model
```

Chọn model có quyền Responses + strict Structured Outputs trong tài khoản của bạn. Không có model mặc định ẩn, không mock thành AI thật khi thiếu key. `OPENAI_TIMEOUT_MS`, output-token limit và quota ngày đã có placeholder/cấu hình trong `.env.example`. Không đặt key trong biến `VITE_*`.

## Kiểm thử dễ hiểu

| Lệnh/công cụ                | Dùng để làm gì                                                |
| --------------------------- | ------------------------------------------------------------- |
| `/api/docs`                 | Bấm Execute với ví dụ schema, xem request/response/error      |
| `npm test`                  | Test engine, contract, provider fixture, storage và API       |
| `npm run test:ui`           | Playwright UI: chọn test, chạy browser, xem từng bước         |
| `npm run test:e2e`          | Chạy browser regression trên artifact Vite đã build           |
| `npm run check`             | TypeScript + ESLint + tests + build                           |
| `npm run format:check`      | Kiểm tra format code                                          |
| `npm run eval:ai`           | Benchmark fixture/grid offline, không gọi API trả phí         |
| `npm run eval:ai -- --live` | Tùy chọn gọi OpenAI thật với credentials của bạn; có tính phí |

Trước lần browser test đầu: `npx playwright install chromium`. Chạy `npm run build` trước E2E/UI mode. CI tự làm các bước này, không cần key AI.

## Cấu trúc để đọc code

```text
contracts/                  TypeBox schema, TypeScript types, fixture examples
backend/src/
  api/routers/              HTTP endpoints, schema, Swagger descriptions
  api/plugins/              Origin/Host/CORS, rate limits, errors
  engine/                   Pure deterministic basket economics
  agent/                    OpenAI transport, prompt, context, recommendation service
  history/                  CSV aggregate validation
  store/                    Local atomic file / optional Supabase database
  server.ts                 Configuration and process lifecycle
backend/test/               Behavioral tests
frontend/src/
  components/               Forms, context, results and AI panels
  api.ts                    Typed HTTP client
  draft.ts                  Validated import/export and browser draft
  App.tsx                   State and user flow
  main.tsx                  Browser entry
scripts/                    Dev/check/build/evaluation/deployment commands
e2e/                        Browser workflows and exported-plan checks
docs/                       Contracts, deployment, research and pitching source
```

Đọc theo thứ tự: `contracts/model.ts` → `contracts/fixtures.ts` → `backend/src/engine/index.ts` → `backend/src/api/routers/evaluate.ts` → `frontend/src/App.tsx`.

## Dữ liệu và AI quyết định như thế nào

- Basket là một thành phần giỏ cố định, có thể nhiều SKU; không phải phân bố mọi giỏ khách mua.
- Tiền đồng nguyên, tỷ lệ bps; BigInt ở bước trung gian và làm tròn từng khoản phí trên mỗi đơn.
- Cùng voucher thực tế dùng cùng đường CVR trên cả đường mô phỏng lẫn AI.
- Chi phí/phí/thuế/hoàn hàng, tồn, quota và ngân sách là typed inputs; engine không cho AI sửa.
- Seller notes và CSV lịch sử chỉ ảnh hưởng cách AI đề xuất voucher; không tự biến thành traffic/forecast.
- AI trả candidate; engine bổ sung baseline/measured/current, tính lại rồi xếp hạng theo mục tiêu.
- Mọi kết quả ghi `scenario_only`, phiên bản schema/engine và snapshot input; OpenAI bổ sung prompt/model/usage/context metadata.
- Export ghi **phương án đang chọn**, bao gồm kết quả và context AI nếu đang xem AI.
- Giao diện chỉ offer **tối đa top 5 chiến lược** theo thứ hạng engine; kết quả đầy đủ vẫn giữ trong lịch sử và export để truy lại phép so sánh.
- Chọn từng chiến lược để mở dashboard doanh thu, lợi nhuận, đơn hàng, ngân sách/quota; đổi kịch bản thấp/cơ sở/cao hoặc bấm cột biểu đồ để xem số liệu. Doanh thu đã trừ phần ưu đãi shop tài trợ và điều chỉnh hoàn hàng, trước phí và chi phí vận hành.

Xem [data contract](docs/data-contract.md) và [API docs](docs/api.md). CSV template chỉ có header; không giả dữ liệu bán hàng thật.

## Reference dữ liệu cho AI

Trong phần bối cảnh, nhập **Tìm reference cho AI** rồi bấm **Xem reference · không gọi AI** để kiểm tra nguồn/mẫu số/giới hạn trước. Để trống là tắt; không tự biến tên sản phẩm hay lịch sử campaign thành truy vấn. Gói local có 4.328 feature tổng hợp; chưa embedding hoặc dùng vector DB. Khi bấm AI, server gửi các reference phù hợp và lưu ID/version trong kết quả/export, giữ nguyên các giả định kinh tế của shop.

- [Cách dùng UI/API, dữ liệu và tái tạo snapshot](docs/evidence-integration.md)
- [Benchmark có/không evidence và giới hạn chi phí](docs/evidence-evaluation.md)
- `npm run eval:evidence`: chạy fixture offline, không gọi OpenAI.

### Đánh giá kỹ thuật AI

- [Kết quả 72 lượt live và giới hạn diễn giải](docs/ai-evaluation-results.md)
- [So sánh kiến trúc và bước tiếp theo](docs/ai-alternatives.md)
- `npm run eval:technical`: fixture offline, chấm candidate riêng trước khi thêm baseline.
- `npm run eval:retrieval`: precision/recall/nDCG trên qrels của corpus đầy đủ, không gọi model.
- Chạy live cần bật rõ `--live --max-calls 72 --max-cost-usd 8`; giá token lấy từ `.env`, đây là trần ước tính, không phải hạn mức hóa đơn.

## Phạm vi đã biết

Chế độ mặc định dùng fee/tax do người bán nhập. Chọn ngành hàng để dùng snapshot phí Shopee có nguồn và ngày ghi nhận; snapshot không tự xác minh lại khi chạy. Response curve do người dùng giả định, chưa được hiệu chuẩn hay chứng minh causal lift. Không hỗ trợ toàn bộ stacking, phân bổ lãi từng SKU hoặc tự publish voucher lên sàn. Thiếu credentials thì AI disabled. Tests fixture không xác minh chất lượng live model.

## Deploy và sản phẩm

- [Deploy local/cloud, credentials và rollback](docs/deployment.md)
- [Product brief đầy đủ + outline pitching slides](docs/product-pitch.md)
- [Checklist sửa critique và giới hạn còn lại](docs/migration-status.md)
- [Nghiên cứu](docs/research.md)

Deployment cloud/Supabase/OpenAI thật cần cấu hình tài khoản; repository cung cấp scaffold và test offline, không khẳng định đã deploy hoặc kiểm chứng cloud khi chưa có credentials.

## Phí Shopee và danh mục voucher

Chọn **Ngành hàng Shopee** để dùng catalog `fees@2026-10-31`, chương trình thường/Voucher Xtra và voucher sàn đồng tài trợ. Catalog thay thế hai tỷ lệ phí/thuế nhập tay cho toàn giỏ; cùng một ngành áp dụng cho mọi SKU. Bảng phí của từng chiến lược khớp voucher đang chọn. Engine `2.1.0` ghi rõ snapshot đầu vào và phiên bản catalog; bản lưu `2.0.0` vẫn đọc được.

**Danh mục voucher phối hợp** gọi `/api/strategy`: nhập số khách mục tiêu, số voucher và biên tối thiểu để phân bổ mã/kiểm tra kết hợp theo quy tắc. Đây là công cụ heuristic riêng, không dự báo doanh thu và không thay kết quả dashboard.

Các ô tiền nhận số đồng nguyên bất kỳ; ArrowUp/Down tăng/giảm 1.000đ, giữ Shift là 10.000đ.

`npm run research -- --dry-run` kiểm tra pipeline không gọi provider. Chạy thật cần `OPENAI_API_KEY` và `OPENAI_RESEARCH_MODEL` (hoặc `OPENAI_MODEL`), chỉ ghi đề xuất vào `data/fees/candidates/`; người phụ trách phải review trước khi sửa catalog. Workflow hằng ngày dùng secret `OPENAI_API_KEY_TEAM10_HACKATHON` và repository variable `OPENAI_RESEARCH_MODEL`; không có cấu hình thì bỏ qua.
