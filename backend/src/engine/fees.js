// Per-order Shopee fees from the verified catalog. Pure and browser-compatible.
import {feeCatalog} from '../../../contracts/fee-catalog.js';
export {feeCatalog};

const bps = (amount, rate) => Math.round(amount * rate / 10000);

// Commission range is [min, max]; the engine uses max so profit is never overstated.
export function commissionBps(category) {
  const entry = feeCatalog.commission.categories[category];
  if (!entry) throw new Error(`Unknown category ${category}`);
  return entry.bps[1];
}

// One product per order. `discount` is the seller's own voucher; `platformVoucher`
// is a Shopee-issued voucher the buyer applies; the seller co-funds it unless enrolled in Voucher Xtra.
export function orderFees({price, discount = 0, category, programme = 'standard', platformVoucher = 0}) {
  const c = feeCatalog;
  const sellerPrice = price - discount;
  const xtraOn = programme === 'voucher_xtra';
  const cofund = !xtraOn && platformVoucher > 0
    ? Math.min(bps(Math.min(platformVoucher, sellerPrice), c.cofund.seller_bps), c.cofund.cap_dong) : 0;
  const commission = bps(sellerPrice, commissionBps(category));
  const transaction = bps(sellerPrice, c.transaction.bps);
  const infrastructure = c.infrastructure.dong_per_order;
  const voucherXtra = xtraOn ? Math.min(bps(price, c.voucher_xtra.bps), c.voucher_xtra.cap_dong) : 0;
  const tax = bps(sellerPrice - cofund, c.tax.vat_bps + c.tax.pit_bps);
  const total = commission + transaction + infrastructure + voucherXtra + cofund + tax;
  return {commission, transaction, infrastructure, voucherXtra, cofund, tax, total};
}

// Share of the discounted price taken by percentage fees (excludes the per-order flat fee).
export function feeRateBps({category, programme = 'standard'}) {
  const c = feeCatalog;
  return commissionBps(category) + c.transaction.bps + c.tax.vat_bps + c.tax.pit_bps + (programme === 'voucher_xtra' ? c.voucher_xtra.bps : 0);
}

export const feeAssumptions = [
  `Phí theo ${feeCatalog.version} (Shopee, người bán không Mall), đã xác minh trên banhang.shopee.vn.`,
  'Phí cố định lấy cận trên của dải ngành để không đánh giá lợi nhuận quá cao.',
  'Phí cố định và phí xử lý giao dịch tính trên giá sau voucher shop; Shopee chưa công bố rõ cơ sở này cho phí cố định.',
  'Chưa cộng phí ship người mua trả vào cơ sở phí xử lý giao dịch.',
  'Thuế khấu trừ 1,5% áp cho hộ kinh doanh / cá nhân bán hàng hóa; công ty không bị khấu trừ.'
];
