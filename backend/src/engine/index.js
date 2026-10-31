// Transparent scenario calculator. Uplift is a seller assumption, not an LLM forecast.
import {defaults, parseInput} from '../../../contracts/model.js';
import {orderFees, feeCatalog, feeAssumptions} from './fees.js';
import {planPortfolio} from './portfolio.js';
export {defaults};
// Symmetric half-up rounding for money, including loss values.
const roundDong = value => Math.sign(value) * Math.round(Math.abs(value));
export function evaluate(input) {
  const x = parseInput(input);
  const raw = x.type === 'percent' ? Math.min(x.price * x.value / 100, x.cap) : x.value;
  const discount = x.price >= x.minimum ? Math.min(x.price, raw) : 0;
  // With a category, profit uses the verified Shopee fee catalog per order instead of `fee`.
  const verified = x.category !== '';
  const feesFor = d => orderFees({price:x.price, discount:d, category:x.category, programme:x.programme, platformVoucher:x.platformVoucher});
  const strategies = [{id:'control', name:'Giữ biên lợi nhuận', factor:0, note:'Không chạy voucher; mốc đối chứng.'}, {id:'measured', name:'Ưu đãi có kiểm soát', factor:.6, note:'Giảm 40% mức ưu đãi bạn nhập.'}, {id:'full', name:'Tăng tốc 11.11', factor:1, note:'Áp dụng đủ mức ưu đãi bạn nhập.'}].map(s => {
    const d = Math.round(discount * s.factor);
    const scenarios = ['low','base','high'].map(key => {
      const visits = Math.round(x.traffic * x[key]);
      const organic = Math.floor(visits * x.cvr / 100);
      const demand = Math.floor(visits * Math.min(1, x.cvr / 100 * (1 + (d > 0 ? x.uplift / 100 * s.factor : 0))));
      const capacity = d > 0 ? Math.min(Math.floor(x.quota), Math.floor(x.budget / d)) : 0;
      // When quota runs out, additional sales revert to organic demand; no unlimited uplift.
      const redeemed = Math.min(Math.floor(x.stock), demand, capacity);
      const orders = Math.min(Math.floor(x.stock), Math.max(organic, redeemed));
      const spend = redeemed * d;
      const revenue = orders * x.price - spend;
      const profit = verified
        ? redeemed * (x.price - d - feesFor(d).total) + (orders - redeemed) * (x.price - feesFor(0).total) - orders * x.cost
        : revenue * (1 - x.fee / 100) - orders * x.cost;
      return {key, visits, orders, redeemed, spend, revenue, profit:roundDong(profit), stockout:demand >= x.stock, exhausted:d > 0 && demand > capacity};
    });
    const worst = Math.min(...scenarios.map(y=>y.profit));
    const expected = scenarios[1].profit;
    const score = x.risk === 'safe' ? worst : x.risk === 'growth' ? scenarios[1].revenue : .7 * expected + .3 * worst;
    return {...s, discount:d, scenarios, worst, expected, score};
  }).sort((a,b)=>b.score-a.score);
  const fees = verified ? {catalog_version:feeCatalog.version, per_order:{without_voucher:feesFor(0), with_voucher:feesFor(strategies.find(s=>s.discount>0)?.discount ?? 0)}} : null;
  const portfolio = verified ? planPortfolio({products:[{name:x.name, price:x.price, cost:x.cost, category:x.category}], customers:x.traffic, vouchers:x.quota, floor:x.floor, programme:x.programme}) : null;
  return {input:x, strategies, recommended:strategies[0], eligible:x.price >= x.minimum, fees, portfolio, assumptions:verified ? ['Một sản phẩm / đơn; chưa tính hoàn hàng, vận chuyển hoặc quảng cáo.', ...feeAssumptions, 'Traffic và uplift do bạn nhập, không phải dự báo hoặc xác suất thống kê.'] : ['Một sản phẩm / đơn; chưa tính hoàn hàng, vận chuyển, quảng cáo hoặc voucher sàn.', 'Phí tổng hợp tính trên doanh thu sau voucher; cần thay bằng bảng phí đã xác minh.', 'Traffic và uplift do bạn nhập, không phải dự báo hoặc xác suất thống kê.', 'Thời gian, phạm vi và mã voucher được lưu trong kế hoạch; không tự đồng bộ Shopee.']};
}
