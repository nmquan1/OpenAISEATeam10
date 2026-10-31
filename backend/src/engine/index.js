// Transparent scenario calculator. Uplift is a seller assumption, not an LLM forecast.
import {defaults, parseInput} from '../../../contracts/model.js';
export {defaults};
// Symmetric half-up rounding for money, including loss values.
const roundDong = value => Math.sign(value) * Math.round(Math.abs(value));
// Preserve decimal rates exactly before flooring counts (e.g. 100 visits × 29%).
function decimalRatio(value) {
  const [mantissa, exponent = '0'] = String(value).split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponent);
  const numerator = BigInt(whole + fraction);
  return scale >= 0 ? [numerator, 10n ** BigInt(scale)] : [numerator * 10n ** BigInt(-scale), 1n];
}
function conversionOrders(visits, cvr, uplift = 0, factor = 0) {
  const [c, cd] = decimalRatio(cvr);
  const [u, ud] = decimalRatio(uplift);
  const [f, fd] = decimalRatio(factor);
  const upliftBase = 100n * ud * fd;
  const orders = BigInt(visits) * c * (upliftBase + u * f) / (100n * cd * upliftBase);
  return Number(orders > BigInt(visits) ? BigInt(visits) : orders);
}
export function evaluate(input) {
  const x = parseInput(input);
  const raw = x.type === 'percent' ? Math.min(x.price * x.value / 100, x.cap) : x.value;
  const discount = x.price >= x.minimum ? Math.min(x.price, raw) : 0;
  const strategies = [{id:'control', name:'Giữ biên lợi nhuận', factor:0, note:'Không chạy voucher; mốc đối chứng.'}, {id:'measured', name:'Ưu đãi có kiểm soát', factor:.6, note:'Giảm 40% mức ưu đãi bạn nhập.'}, {id:'full', name:'Tăng tốc 11.11', factor:1, note:'Áp dụng đủ mức ưu đãi bạn nhập.'}].map(s => {
    const d = Math.round(discount * s.factor);
    const scenarios = ['low','base','high'].map(key => {
      const visits = Math.round(x.traffic * x[key]);
      const organic = conversionOrders(visits, x.cvr);
      const demand = conversionOrders(visits, x.cvr, x.uplift, d > 0 ? s.factor : 0);
      const capacity = d > 0 ? Math.min(Math.floor(x.quota), Math.floor(x.budget / d)) : 0;
      // When quota runs out, additional sales revert to organic demand; no unlimited uplift.
      const redeemed = Math.min(Math.floor(x.stock), demand, capacity);
      const fundedDemand = Math.max(organic, Math.min(demand, capacity));
      const orders = Math.min(x.stock, fundedDemand);
      const spend = redeemed * d;
      const revenue = orders * x.price - spend;
      const profit = revenue * (1 - x.fee / 100) - orders * x.cost;
      return {key, visits, orders, redeemed, spend, revenue, profit:roundDong(profit), stockout:fundedDemand > 0 && fundedDemand >= x.stock, exhausted:d > 0 && Math.min(x.stock, demand) > capacity};
    });
    const worst = Math.min(...scenarios.map(y=>y.profit));
    const expected = scenarios[1].profit;
    const score = x.risk === 'safe' ? worst : x.risk === 'growth' ? scenarios[1].revenue : .7 * expected + .3 * worst;
    return {...s, discount:d, scenarios, worst, expected, score};
  }).sort((a,b)=>b.score-a.score);
  return {input:x, strategies, recommended:strategies[0], eligible:x.price >= x.minimum, assumptions:['Một sản phẩm / đơn; chưa tính hoàn hàng, vận chuyển, quảng cáo hoặc voucher sàn.', 'Phí tổng hợp tính trên doanh thu sau voucher; cần thay bằng bảng phí đã xác minh.', 'Traffic và uplift do bạn nhập, không phải dự báo hoặc xác suất thống kê.', 'Thời gian, phạm vi và mã voucher được lưu trong kế hoạch; không tự đồng bộ Shopee.']};
}
