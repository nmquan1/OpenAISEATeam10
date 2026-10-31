import { useEffect, useRef, useState, type FormEvent } from 'react';
import { feeCatalog, type EvaluationInput } from '@market-maker/contracts';
import type { PortfolioResult } from '@market-maker/contracts/portfolio';
import { planPortfolio } from '../api';
import { count, money } from '../types';
import { NumberField } from './Field';

const matrixLabels = {
  yes: 'Cho phép theo mẫu',
  no: 'Không kết hợp',
  best_of: 'Chỉ lấy ưu đãi tốt hơn',
};

export function PortfolioPanel({ input, disabled }: { input: EvaluationInput; disabled: boolean }) {
  const [customers, setCustomers] = useState(1000);
  const [vouchers, setVouchers] = useState(input.constraints.quota);
  const [floor, setFloor] = useState(20);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    setResult(null);
    setError('');
    setBusy(false);
    return () => controller.current?.abort();
  }, [input]);

  function changeSetting(update: (value: number) => void, value: number) {
    controller.current?.abort();
    setBusy(false);
    setResult(null);
    setError('');
    update(value);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.marketplace || disabled || busy) return;
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const category = input.marketplace.category;
      const data = await planPortfolio(
        {
          products: input.product.lines.map((line) => ({
            name: line.sku_id,
            price: line.unit_price_dong,
            cost: line.unit_cost_dong,
            category,
          })),
          customers,
          vouchers,
          floor,
          programme: input.marketplace.programme,
        },
        pending.signal,
      );
      if (!pending.signal.aborted) setResult(data);
    } catch (reason) {
      if (!pending.signal.aborted)
        setError(reason instanceof Error ? reason.message : 'Không tạo được danh mục voucher.');
    } finally {
      if (!pending.signal.aborted) setBusy(false);
    }
  }

  return (
    <section className="card portfolio-panel" aria-labelledby="portfolio-heading">
      <div className="section-heading">
        <h2 id="portfolio-heading">Danh mục voucher phối hợp</h2>
        <span className="pill">Quy tắc tham khảo</span>
      </div>
      <p className="hint">
        Lập mã freeship, ưu đãi % hoặc quà tặng cho danh sách SKU theo catalog {feeCatalog.version}.
        Đây là công cụ phân bổ riêng; không dùng số lượng SKU trong giỏ, traffic, ship/ads/hoàn hàng
        của dashboard và không dự báo doanh thu.
      </p>
      {!input.marketplace ? (
        <p className="notice">Chọn ngành hàng Shopee ở phần thiết lập để lập danh mục voucher.</p>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            <div className="field-grid">
              <NumberField
                label="Số khách hàng mục tiêu"
                value={customers}
                max={1_000_000}
                onChange={(value) => changeSetting(setCustomers, value)}
                hint="Nhập số khách bạn muốn tiếp cận; không phải lượt truy cập. Giá trị ban đầu chỉ là mẫu."
              />
              <NumberField
                label="Tổng voucher phân bổ"
                value={vouchers}
                max={1_000_000}
                onChange={(value) => changeSetting(setVouchers, value)}
              />
              <NumberField
                label="Biên đóng góp tối thiểu (%)"
                value={floor}
                max={90}
                step={0.01}
                onChange={(value) => changeSetting(setFloor, value)}
              />
            </div>
            <button type="submit" className="secondary" disabled={disabled || busy}>
              {busy ? 'Đang lập danh mục…' : 'Lập danh mục voucher'}
            </button>
          </form>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {result && (
            <div className="portfolio-result">
              <p role="status">
                {result.status === 'ok'
                  ? `Đã phân bổ ${count(result.vouchers.reduce((sum, voucher) => sum + voucher.qty, 0))} voucher.`
                  : 'Chưa có danh mục giữ được biên yêu cầu theo mô hình này.'}
              </p>
              <p className="hint">
                Giá trị giỏ giả định {money(result.assumptions.aov)} · ngưỡng đơn{' '}
                {money(result.assumptions.min_order)} · biên mục tiêu {result.assumptions.floor_pct}
                %.
              </p>
              {result.vouchers.length > 0 && (
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Danh mục voucher được phân bổ"
                >
                  <table>
                    <caption className="sr-only">Mã voucher, số lượng và điều kiện sử dụng</caption>
                    <thead>
                      <tr>
                        <th scope="col">Mã</th>
                        <th scope="col">Số lượng</th>
                        <th scope="col">Điều kiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.vouchers.map((voucher) => (
                        <tr key={voucher.code}>
                          <th scope="row">{voucher.code}</th>
                          <td>{count(voucher.qty)}</td>
                          <td>{voucher.rule}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.warnings.map((warning, index) => (
                <p className="notice" key={index}>
                  {warning}
                </p>
              ))}
              {result.vouchers.length > 1 && (
                <details>
                  <summary>Quy tắc kết hợp từng cặp voucher</summary>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Ma trận kết hợp voucher"
                  >
                    <table>
                      <caption className="sr-only">
                        Quy tắc ghép từng cặp, không chứng minh mọi tổ hợp an toàn
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Voucher</th>
                          {result.vouchers.map((voucher) => (
                            <th scope="col" key={voucher.code}>
                              {voucher.code}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.vouchers.map((voucher) => (
                          <tr key={voucher.code}>
                            <th scope="row">{voucher.code}</th>
                            {result.vouchers.map((other) => (
                              <td key={other.code}>
                                {voucher.code === other.code
                                  ? '—'
                                  : (matrixLabels[result.matrix[voucher.code]?.[other.code]] ??
                                    'Chưa kiểm tra')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              <details>
                <summary>Giả định và giới hạn của danh mục</summary>
                <ul>
                  {result.limitations.map((limitation, index) => (
                    <li key={index}>{limitation}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </>
      )}
    </section>
  );
}
