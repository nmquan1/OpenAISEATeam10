import type { OrderFees } from '@market-maker/contracts';
import { money, type Strategy } from '../types';

const feeLabels: Record<keyof OrderFees, string> = {
  commission: 'Phí cố định theo ngành',
  transaction: 'Phí xử lý giao dịch',
  infrastructure: 'Phí hạ tầng',
  voucherXtra: 'Voucher Xtra',
  cofund: 'Shop đồng tài trợ voucher sàn',
  tax: 'Thuế khấu trừ',
  total: 'Tổng phí và đồng tài trợ',
};

export function MarketplaceFees({ strategy }: { strategy: Strategy }) {
  if (!strategy.fees) return null;
  const { fees } = strategy;
  return (
    <details className="marketplace-fees">
      <summary>Chi tiết phí Shopee / giỏ · {fees.catalog_version}</summary>
      <p className="hint">
        So sánh cùng một giỏ, trước điều chỉnh hoàn hàng. Cột có voucher dùng đúng chiến lược đang
        chọn; phần đồng tài trợ đã nằm trong phép tính doanh thu, không trừ lại.
      </p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Chi tiết phí Shopee">
        <table>
          <caption className="sr-only">Phí trên mỗi giỏ của {strategy.name}</caption>
          <thead>
            <tr>
              <th scope="col">Khoản phí</th>
              <th scope="col">Không voucher shop</th>
              <th scope="col">Chiến lược đang chọn</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(feeLabels) as (keyof OrderFees)[]).map((key) => (
              <tr key={key}>
                <th scope="row">{feeLabels[key]}</th>
                <td>{money(fees.without_voucher[key])}</td>
                <td>{money(fees.with_voucher[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
