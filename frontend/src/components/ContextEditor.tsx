import { useRef } from 'react';
import type { DecisionContext } from '../types';
import { NumberField } from './Field';
import type { EvaluationInput } from '@market-maker/contracts';
import { EvidencePreview } from './EvidencePreview';

export function ContextEditor({
  input,
  context,
  onChange,
  onImportCsv,
  importBusy,
  importDisabled,
}: {
  input: EvaluationInput;
  context: DecisionContext;
  onChange: (value: DecisionContext) => void;
  onImportCsv: (file: File) => void;
  importBusy: boolean;
  importDisabled: boolean;
}) {
  const csvInput = useRef<HTMLInputElement>(null);
  const campaigns = context.history?.campaigns ?? [];
  const updateCampaign = (index: number, field: string, value: string | number) =>
    onChange({
      ...context,
      history: {
        source: 'user_reported',
        campaigns: campaigns.map((campaign, i) =>
          i === index ? { ...campaign, [field]: value } : campaign,
        ),
      },
    });
  return (
    <section className="card context-editor" aria-labelledby="context-heading">
      <h2 id="context-heading">Nhờ AI gợi ý thêm voucher</h2>
      <label htmlFor="seller-notes">
        Ghi chú về shop và khách hàng
        <textarea
          id="seller-notes"
          value={context.seller_notes}
          maxLength={4000}
          rows={4}
          placeholder="Ví dụ: shop mỹ phẩm biên thấp; ưu tiên khách quay lại; không muốn hết voucher trước buổi tối…"
          onChange={(event) => onChange({ ...context, seller_notes: event.target.value })}
        />
      </label>
      <p className="hint">
        Chỉ gửi dữ liệu tổng hợp. Không nhập tên, điện thoại, địa chỉ khách hoặc secrets. Ghi chú
        không tự đổi giá vốn/ngân sách trong form.
      </p>
      <details className="advanced">
        <summary>Reference lịch sử nước ngoài · tùy chọn</summary>
        <label htmlFor="reference-query">
          Tìm reference cho AI
          <input
            id="reference-query"
            value={context.reference_query ?? ''}
            maxLength={500}
            placeholder="Ví dụ: cat litter cat food; percent cap minimum spend"
            onChange={(event) => onChange({ ...context, reference_query: event.target.value })}
          />
        </label>
        <p className="hint">
          Để trống để tắt. Chọn từ khóa phù hợp sản phẩm; không có reference sẽ trả rỗng. Các số
          tiền nguồn không được dùng làm mức giảm VND.
        </p>
        <EvidencePreview input={input} context={context} disabled={importDisabled} />
      </details>
      <div className="actions">
        <button
          className="secondary"
          type="button"
          disabled={importBusy || importDisabled}
          onClick={() => csvInput.current?.click()}
        >
          {importBusy ? 'Đang kiểm tra CSV…' : '↑ Nhập lịch sử sale CSV'}
        </button>
        <input
          className="sr-only"
          ref={csvInput}
          type="file"
          accept=".csv,text/csv"
          aria-label="Nhập lịch sử sale CSV"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportCsv(file);
            event.target.value = '';
          }}
        />
      </div>
      <p className="hint">
        CSV có header label, visits, orders, revenue_dong, voucher_spend_dong; tối đa 20 dòng và 16
        KB. Server kiểm tra trước khi áp dụng. Số tiền là đồng, không dùng dấu phân cách hàng nghìn.
      </p>
      <details className="advanced">
        <summary>Lịch sử sale tổng hợp · tùy chọn ({campaigns.length})</summary>
        <p className="notice">
          Lịch sử do bạn cung cấp chỉ giúp AI chọn cấu hình voucher; không tự hiệu chỉnh traffic,
          CVR hoặc chứng minh quan hệ nhân quả.
        </p>
        {campaigns.map((campaign, index) => (
          <fieldset key={index}>
            <legend>Đợt sale {index + 1}</legend>
            <label>
              Tên đợt sale
              <input
                value={campaign.label}
                maxLength={100}
                required
                onChange={(event) => updateCampaign(index, 'label', event.target.value)}
              />
            </label>
            <div className="field-grid">
              <NumberField
                label="Lượt truy cập"
                value={campaign.visits}
                max={100_000_000}
                onChange={(value) => updateCampaign(index, 'visits', value)}
              />
              <NumberField
                label="Đơn hàng"
                value={campaign.orders}
                max={100_000_000}
                onChange={(value) => updateCampaign(index, 'orders', value)}
              />
              <NumberField
                label="Doanh thu (₫)"
                money
                value={campaign.revenue_dong}
                max={1_000_000_000_000}
                onChange={(value) => updateCampaign(index, 'revenue_dong', value)}
              />
              <NumberField
                label="Chi voucher shop (₫)"
                money
                value={campaign.voucher_spend_dong}
                max={1_000_000_000_000}
                onChange={(value) => updateCampaign(index, 'voucher_spend_dong', value)}
              />
            </div>
            <button
              type="button"
              className="text-button danger"
              onClick={() => {
                const remaining = campaigns.filter((_, i) => i !== index);
                onChange(
                  remaining.length
                    ? { ...context, history: { source: 'user_reported', campaigns: remaining } }
                    : {
                        seller_notes: context.seller_notes,
                        ...(context.reference_query !== undefined
                          ? { reference_query: context.reference_query }
                          : {}),
                      },
                );
              }}
            >
              Xóa đợt sale {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          className="secondary"
          type="button"
          disabled={campaigns.length >= 20}
          onClick={() =>
            onChange({
              ...context,
              history: {
                source: 'user_reported',
                campaigns: [
                  ...campaigns,
                  {
                    label: `Sale ${campaigns.length + 1}`,
                    visits: 0,
                    orders: 0,
                    revenue_dong: 0,
                    voucher_spend_dong: 0,
                  },
                ],
              },
            })
          }
        >
          + Thêm lịch sử sale
        </button>
      </details>
    </section>
  );
}
