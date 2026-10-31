import type { FormEvent } from 'react';
import type { EvaluationInput, Voucher } from '@market-maker/contracts';
import { NumberField, PercentField } from './Field';
import { MarketplaceFields } from './MarketplaceFields';

type Props = {
  input: EvaluationInput;
  onChange: (input: EvaluationInput) => void;
  onSubmit: () => void;
  busy: boolean;
  disabled: boolean;
};
const economicsLabels: Record<keyof EvaluationInput['economics'], string> = {
  fee_bps: 'Phí tổng hợp (%)',
  tax_bps: 'Thuế (%)',
  shipping_dong: 'Shop chịu ship / đơn (₫)',
  ads_dong: 'Ads / đơn (₫)',
  return_rate_bps: 'Tỷ lệ hoàn (%)',
  return_resale_bps: 'Hàng hoàn bán lại được (%)',
  nonrefunded_fee_bps: 'Phần phí không hoàn (%)',
  return_shipping_dong: 'Ship hoàn / đơn (₫)',
};

export function StrategyForm({ input, onChange, onSubmit, busy, disabled }: Props) {
  function updateVoucher(value: Partial<Voucher>) {
    onChange({ ...input, voucher: { ...input.voucher, ...value } as Voucher });
  }
  function setLine(index: number, key: string, value: string | number) {
    onChange({
      ...input,
      product: {
        ...input.product,
        lines: input.product.lines.map((line, i) =>
          i === index ? { ...line, [key]: value } : line,
        ),
      },
    });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <form id="strategy-form" className="card strategy-form" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 · THIẾT LẬP</p>
          <h2>Giỏ hàng & kinh tế đơn</h2>
        </div>
        <span className="pill">Đồng Việt Nam</span>
      </div>
      <label>
        Tên kế hoạch / sản phẩm
        <input
          value={input.product.name}
          required
          maxLength={100}
          onChange={(event) =>
            onChange({ ...input, product: { ...input.product, name: event.target.value } })
          }
        />
      </label>
      <p className="hint">
        Mỗi đơn dùng cùng thành phần giỏ bên dưới. Tồn kho được giới hạn theo SKU khan hiếm nhất.
      </p>
      {input.product.lines.map((line, index) => (
        <fieldset className="sku-card" key={index}>
          <legend>Sản phẩm {index + 1}</legend>
          <div className="field-grid">
            <label>
              Mã SKU
              <input
                value={line.sku_id}
                required
                maxLength={64}
                onChange={(event) => setLine(index, 'sku_id', event.target.value)}
              />
            </label>
            <NumberField
              label="Số lượng / giỏ"
              value={line.quantity}
              min={1}
              max={1000}
              onChange={(value) => setLine(index, 'quantity', value)}
            />
            <NumberField
              label="Giá bán / SP (₫)"
              money
              value={line.unit_price_dong}
              min={1}
              onChange={(value) => setLine(index, 'unit_price_dong', value)}
            />
            <NumberField
              label="Giá vốn / SP (₫)"
              money
              value={line.unit_cost_dong}
              onChange={(value) => setLine(index, 'unit_cost_dong', value)}
            />
            <NumberField
              label="Đóng gói / SP (₫)"
              money
              value={line.packaging_dong}
              onChange={(value) => setLine(index, 'packaging_dong', value)}
            />
            <NumberField
              label="Tồn kho (SP)"
              value={line.stock_units}
              max={1_000_000}
              onChange={(value) => setLine(index, 'stock_units', value)}
            />
          </div>
          {input.product.lines.length > 1 && (
            <button
              className="text-button danger"
              type="button"
              onClick={() =>
                onChange({
                  ...input,
                  product: {
                    ...input.product,
                    lines: input.product.lines.filter((_, i) => i !== index),
                  },
                })
              }
            >
              Xóa sản phẩm {index + 1}
            </button>
          )}
        </fieldset>
      ))}
      <button
        className="secondary"
        type="button"
        disabled={input.product.lines.length >= 20}
        onClick={() => {
          const sku = `SKU-${Date.now().toString(36)}`;
          onChange({
            ...input,
            product: {
              ...input.product,
              lines: [
                ...input.product.lines,
                {
                  sku_id: sku,
                  quantity: 1,
                  unit_price_dong: 100000,
                  unit_cost_dong: 50000,
                  packaging_dong: 0,
                  stock_units: 100,
                },
              ],
            },
          });
        }}
      >
        + Thêm SKU vào giỏ
      </button>

      <fieldset>
        <legend>Voucher shop</legend>
        <label>
          Hình thức
          <select
            value={input.voucher.type}
            onChange={(event) => {
              const shared = {
                minimum_dong: input.voucher.minimum_dong,
                seller_funding_bps: input.voucher.seller_funding_bps,
              };
              const voucher: Voucher =
                event.target.value === 'percent'
                  ? { type: 'percent', rate_bps: 1500, cap_dong: 50000, ...shared }
                  : { type: 'fixed', amount_dong: 10000, ...shared };
              onChange({ ...input, voucher });
            }}
          >
            <option value="percent">Giảm theo phần trăm</option>
            <option value="fixed">Giảm số tiền cố định</option>
          </select>
        </label>
        <div className="field-grid">
          {input.voucher.type === 'percent' ? (
            <>
              <PercentField
                label="Mức giảm (%)"
                value={input.voucher.rate_bps}
                onChange={(rate_bps) => updateVoucher({ rate_bps })}
              />
              <NumberField
                label="Giảm tối đa / giỏ (₫)"
                money
                value={input.voucher.cap_dong}
                onChange={(cap_dong) => updateVoucher({ cap_dong })}
              />
            </>
          ) : (
            <NumberField
              label="Mức giảm / giỏ (₫)"
              money
              value={input.voucher.amount_dong}
              onChange={(amount_dong) => updateVoucher({ amount_dong })}
            />
          )}
          <NumberField
            label="Giỏ tối thiểu (₫)"
            money
            value={input.voucher.minimum_dong}
            onChange={(minimum_dong) => updateVoucher({ minimum_dong })}
          />
          <PercentField
            label="Shop tài trợ (%)"
            value={input.voucher.seller_funding_bps}
            onChange={(seller_funding_bps) => updateVoucher({ seller_funding_bps })}
            hint="Phần còn lại giả định bên khác tài trợ; phải có thỏa thuận thực tế."
          />
          <NumberField
            label="Ngân sách shop (₫)"
            money
            value={input.constraints.budget_dong}
            onChange={(budget_dong) =>
              onChange({ ...input, constraints: { ...input.constraints, budget_dong } })
            }
          />
          <NumberField
            label="Lượt voucher tối đa"
            value={input.constraints.quota}
            max={1_000_000}
            onChange={(quota) =>
              onChange({ ...input, constraints: { ...input.constraints, quota } })
            }
          />
        </div>
      </fieldset>
      <MarketplaceFields input={input} onChange={onChange} />
      <details className="advanced">
        <summary>Phí, thuế, ship và hoàn hàng</summary>
        <p className="hint">
          {input.marketplace
            ? 'Phí tổng hợp và thuế nhập tay đang tắt vì dùng catalog Shopee. Các chi phí khác vẫn áp dụng.'
            : 'Phí và thuế là giả định do bạn nhập. Chọn ngành hàng ở trên nếu muốn dùng catalog Shopee.'}
        </p>
        <div className="field-grid">
          {(Object.keys(economicsLabels) as (keyof EvaluationInput['economics'])[]).map((key) => {
            const props = {
              label: economicsLabels[key],
              value: input.economics[key],
              onChange: (value: number) =>
                onChange({ ...input, economics: { ...input.economics, [key]: value } }),
            };
            return key.endsWith('_bps') ? (
              <PercentField
                key={key}
                {...props}
                disabled={Boolean(input.marketplace) && ['fee_bps', 'tax_bps'].includes(key)}
              />
            ) : (
              <NumberField key={key} {...props} money />
            );
          })}
        </div>
      </details>
      <fieldset>
        <legend>Traffic & mục tiêu</legend>
        <div className="field-grid">
          <NumberField
            label="Lượt truy cập cơ sở"
            value={input.assumptions.visits}
            max={1_000_000}
            onChange={(visits) =>
              onChange({ ...input, assumptions: { ...input.assumptions, visits } })
            }
          />
          <PercentField
            label="CVR không voucher (%)"
            value={input.assumptions.cvr_bps}
            onChange={(cvr_bps) =>
              onChange({ ...input, assumptions: { ...input.assumptions, cvr_bps } })
            }
          />
          {(['low_bps', 'base_bps', 'high_bps'] as const).map((key, i) => (
            <NumberField
              key={key}
              label={`Traffic ${['thấp', 'cơ sở', 'cao'][i]} (×)`}
              value={input.assumptions.traffic[key] / 10000}
              max={100}
              step={0.01}
              onChange={(value) =>
                onChange({
                  ...input,
                  assumptions: {
                    ...input.assumptions,
                    traffic: { ...input.assumptions.traffic, [key]: Math.round(value * 10000) },
                  },
                })
              }
            />
          ))}
        </div>
        <label>
          Ưu tiên quyết định
          <select
            value={input.objective}
            onChange={(event) =>
              onChange({ ...input, objective: event.target.value as EvaluationInput['objective'] })
            }
          >
            <option value="safe">Thận trọng · bảo vệ lợi nhuận thấp nhất</option>
            <option value="balanced">Cân bằng · 70% cơ sở + 30% thấp nhất</option>
            <option value="growth">Tăng trưởng · doanh thu cơ sở</option>
          </select>
        </label>
      </fieldset>
      <details className="advanced">
        <summary>Giả định phản ứng khách hàng với mức giảm</summary>
        <p className="hint">
          Không phải dự báo AI. CVR được nội suy theo % giảm thực tế của giỏ; cùng số tiền giảm cho
          cùng nhu cầu. Điểm đầu luôn là không giảm → CVR ×1.
        </p>
        {input.assumptions.response_curve.map((point, index) => (
          <div className="curve-row" key={index}>
            <PercentField
              label={`Điểm ${index + 1} · giảm (%)`}
              value={point.discount_bps}
              disabled={index === 0}
              onChange={(discount_bps) =>
                onChange({
                  ...input,
                  assumptions: {
                    ...input.assumptions,
                    response_curve: input.assumptions.response_curve.map((p, i) =>
                      i === index ? { ...p, discount_bps } : p,
                    ),
                  },
                })
              }
            />
            <NumberField
              label="CVR nhân (×)"
              value={point.cvr_multiplier_bps / 10000}
              disabled={index === 0}
              min={1}
              max={10}
              step={0.01}
              onChange={(value) =>
                onChange({
                  ...input,
                  assumptions: {
                    ...input.assumptions,
                    response_curve: input.assumptions.response_curve.map((p, i) =>
                      i === index ? { ...p, cvr_multiplier_bps: Math.round(value * 10000) } : p,
                    ),
                  },
                })
              }
            />
            {index > 0 && (
              <button
                type="button"
                className="text-button danger"
                onClick={() =>
                  onChange({
                    ...input,
                    assumptions: {
                      ...input.assumptions,
                      response_curve: input.assumptions.response_curve.filter(
                        (_, i) => i !== index,
                      ),
                    },
                  })
                }
              >
                Xóa điểm {index + 1}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          disabled={
            input.assumptions.response_curve.length >= 20 ||
            input.assumptions.response_curve.at(-1)!.discount_bps >= 10000
          }
          onClick={() => {
            const last = input.assumptions.response_curve.at(-1)!;
            onChange({
              ...input,
              assumptions: {
                ...input.assumptions,
                response_curve: [
                  ...input.assumptions.response_curve,
                  {
                    discount_bps: Math.min(10000, last.discount_bps + 1000),
                    cvr_multiplier_bps: last.cvr_multiplier_bps,
                  },
                ],
              },
            });
          }}
        >
          + Thêm điểm phản ứng
        </button>
        <p className="hint">Mức giảm phải tăng dần và hệ số CVR không giảm giữa các điểm.</p>
      </details>
      <button className="primary full-width" disabled={busy || disabled}>
        {busy ? 'Đang tính…' : 'Phân tích chiến lược'}
      </button>
      <p className="hint">
        Số liệu được server tính lại khi nhập. Trường tiền: ↑/↓ đổi 1.000đ, giữ Shift đổi 10.000đ;
        vẫn nhập được từng đồng. Không tự áp dụng voucher lên Shopee.
      </p>
    </form>
  );
}
