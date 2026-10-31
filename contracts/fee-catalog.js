// Verified Shopee VN fee catalog for non-Mall sellers. Source of truth for engine fees.
// Every value was read verbatim from banhang.shopee.vn on 2026-10-31; see
// docs/research/margin-guard-inputs/VERIFIED-DATA.md. The research engine
// (scripts/research) proposes changes as candidates; it never edits this file.
// Rates are basis points; money is integer VND.
export const feeCatalog = Object.freeze({
  version: 'fees@2026-10-31',
  market: 'shopee-vn',
  seller: 'non_mall',
  checked_at: '2026-10-31',
  commission: Object.freeze({
    // Phí Cố Định per product value, VAT-inclusive, from 2026-05-23. [min, max] bps.
    effective_from: '2026-05-23',
    source_url: 'https://banhang.shopee.vn/edu/article/27540',
    quote: 'Phí Cố Định (đã bao gồm thuế GTGT) sẽ được tính trên giá trị mỗi sản phẩm theo biểu phí từng ngành hàng.',
    categories: Object.freeze({
      beauty: {label: 'Sắc Đẹp', bps: [1700, 1700]},
      health: {label: 'Sức Khỏe', bps: [1550, 1700]},
      fashion: {label: 'Thời trang', bps: [1350, 1650]},
      pet: {label: 'Chăm sóc thú cưng', bps: [1400, 1400]},
      mom_baby_care: {label: 'Mẹ & Bé · chăm sóc da / tắm gội bé', bps: [1050, 1050]},
      fmcg_other: {label: 'Tiêu dùng nhanh còn lại', bps: [1100, 1600]},
      home_other: {label: 'Nhà cửa & Đời sống còn lại', bps: [1300, 1600]},
      books: {label: 'Sách & Tạp chí', bps: [1400, 1500]},
      stationery: {label: 'Văn phòng phẩm', bps: [1100, 1600]},
      hobby: {label: 'Sở thích & Sưu tầm', bps: [1500, 1700]},
      auto: {label: 'Ô tô', bps: [350, 350]},
      motorbike: {label: 'Mô tô, xe máy', bps: [150, 150]},
      laptop_monitor: {label: 'Laptop, màn hình', bps: [200, 200]},
      phone_tablet: {label: 'Điện thoại, máy tính bảng', bps: [200, 200]},
      electronics_other: {label: 'Điện tử còn lại', bps: [850, 1500]}
    })
  }),
  transaction: Object.freeze({
    // Phí Xử Lý Giao Dịch per order, all payment methods, VAT-inclusive.
    bps: 600,
    effective_from: '2026-05-01',
    source_url: 'https://banhang.shopee.vn/edu/article/2150',
    quote: 'Phí Xử Lý Giao Dịch = ( Giá sản phẩm trước Shopee trợ giá + Phí vận chuyển Người mua trả - Khuyến mãi Người bán đã áp dụng - Khuyến mãi ngân hàng) x 6%'
  }),
  infrastructure: Object.freeze({
    dong_per_order: 3000,
    effective_from: '2025-07-01',
    source_url: 'https://banhang.shopee.vn/edu/article/25223',
    quote: 'Phí Hạ Tầng được áp dụng theo mức thu 3.000Đ (Đã bao gồm thuế GTGT …) cho mỗi đơn hàng'
  }),
  tax: Object.freeze({
    // Withheld for household / individual sellers selling goods (Nghị định 117/2025).
    vat_bps: 100,
    pit_bps: 50,
    base: 'price − seller discount − seller co-fund share; shipping excluded',
    source_url: 'https://banhang.shopee.vn/edu/article/24233',
    quote: 'Doanh thu tính thuế được tính là số tiền hàng hóa/dịch vụ sau khi đã trừ các khoản giảm giá/chiết khấu/khuyến mãi từ Người bán'
  }),
  voucher_xtra: Object.freeze({
    bps: 550,
    cap_dong: 50000,
    min_commitment_days: 15,
    excludes_cofund: true,
    effective_from: '2026-05-23',
    source_url: 'https://banhang.shopee.vn/edu/article/18182',
    quote: '5.5% giá trị mỗi sản phẩm (tối đa 50.000Đ/sản phẩm)'
  }),
  cofund: Object.freeze({
    // Applies only to Shopee-issued vouchers; never to the seller's own vouchers.
    seller_bps: 4000,
    cap_dong: 50000,
    effective_from: '2026-05-23',
    source_url: 'https://banhang.shopee.vn/edu/article/26053',
    quote: 'Giá trị Mã ưu đãi Đồng Tài Trợ của Người Bán = 40% x Giá trị Mã ưu đãi thuộc Chính sách Đồng Tài Trợ (tối đa 50.000Đ/sản phẩm)'
  })
});

export const categories = Object.keys(feeCatalog.commission.categories);
