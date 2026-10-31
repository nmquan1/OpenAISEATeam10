import {
  categories,
  feeCatalog,
  type Category,
  type EvaluationInput,
  type Programme,
} from '@market-maker/contracts';
import { NumberField } from './Field';

export function MarketplaceFields({
  input,
  onChange,
}: {
  input: EvaluationInput;
  onChange: (input: EvaluationInput) => void;
}) {
  return (
    <fieldset>
      <legend>Nguồn phí sàn</legend>
      <label>
        Ngành hàng Shopee
        <select
          aria-label="Ngành hàng Shopee"
          value={input.marketplace?.category ?? ''}
          onChange={(event) => {
            if (!event.target.value) {
              const { marketplace: _marketplace, ...manual } = input;
              onChange(manual);
            } else {
              onChange({
                ...input,
                marketplace: {
                  category: event.target.value as Category,
                  programme: input.marketplace?.programme ?? 'standard',
                  platform_voucher_dong: input.marketplace?.platform_voucher_dong ?? 0,
                },
              });
            }
          }}
        >
          <option value="">Tự nhập phí và thuế</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {feeCatalog.commission.categories[category].label}
            </option>
          ))}
        </select>
      </label>
      {input.marketplace && (
        <>
          <label>
            Chương trình Shopee
            <select
              aria-label="Chương trình Shopee"
              value={input.marketplace.programme}
              onChange={(event) =>
                onChange({
                  ...input,
                  marketplace: {
                    ...input.marketplace!,
                    programme: event.target.value as Programme,
                  },
                })
              }
            >
              <option value="standard">Không tham gia Voucher Xtra</option>
              <option value="voucher_xtra">Voucher Xtra</option>
            </select>
          </label>
          <NumberField
            label="Voucher Shopee / giỏ (₫)"
            value={input.marketplace.platform_voucher_dong}
            money
            onChange={(platform_voucher_dong) =>
              onChange({ ...input, marketplace: { ...input.marketplace!, platform_voucher_dong } })
            }
            hint="Voucher sàn riêng với voucher shop; engine tính phần shop đồng tài trợ theo catalog."
          />
          <p className="hint">
            Catalog {feeCatalog.version}, ghi nhận ngày {feeCatalog.checked_at}, dành cho người bán
            không Mall. Cùng ngành hàng áp dụng cho mọi SKU trong giỏ. Phí và thuế catalog thay thế
            hai tỷ lệ nhập tay; ship, ads, đóng gói và hoàn hàng vẫn theo thiết lập của bạn. Thuế
            catalog dành cho hộ/cá nhân bán hàng hóa.
          </p>
        </>
      )}
    </fieldset>
  );
}
