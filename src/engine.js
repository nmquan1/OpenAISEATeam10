// Transparent scenario calculator. Uplift is a seller assumption, not an LLM forecast.
export const defaults = { name:'Serum phục hồi 30ml', price:299000, cost:125000, fee:15, stock:500, traffic:3000, cvr:3, low:1.5, base:3, high:5, uplift:20, risk:'balanced', type:'percent', value:15, cap:50000, minimum:199000, quota:300, budget:10000000, start:'2026-11-11T00:00', end:'2026-11-11T23:59', scope:'product', code:'MAKER1111' };
export function evaluate(input) {
  const x = { ...defaults, ...input };
  for (const key of ['price','cost','fee','stock','traffic','cvr','low','base','high','uplift','value','cap','minimum','quota','budget']) {
    if (!Number.isFinite(x[key]) || x[key] < 0) throw new Error('Thông số phải là số không âm: ' + key);
  }
  if (!x.price || x.fee > 100 || x.cvr > 100 || (x.type === 'percent' && x.value > 100)) throw new Error('Giá phải lớn hơn 0; tỷ lệ không được vượt 100%.');
  if (x.low > x.base || x.base > x.high) throw new Error('Traffic cần theo thứ tự thấp ≤ cơ sở ≤ cao.');
  if (!Number.isFinite(Date.parse(x.start)) || !Number.isFinite(Date.parse(x.end)) || x.start >= x.end) throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu.');
  if (!['fixed','percent'].includes(x.type) || !['safe','balanced','growth'].includes(x.risk)) throw new Error('Loại voucher hoặc khẩu vị không hợp lệ.');
  const raw = x.type === 'percent' ? Math.min(x.price * x.value / 100, x.cap) : x.value;
  const discount = x.price >= x.minimum ? Math.min(x.price, raw) : 0;
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
      const profit = revenue * (1 - x.fee / 100) - orders * x.cost;
      return {key, visits, orders, redeemed, spend, revenue, profit:Math.round(profit), stockout:demand >= x.stock, exhausted:d > 0 && demand > capacity};
    });
    const worst = Math.min(...scenarios.map(y=>y.profit));
    const expected = scenarios[1].profit;
    const score = x.risk === 'safe' ? worst : x.risk === 'growth' ? scenarios[1].revenue : .7 * expected + .3 * worst;
    return {...s, discount:d, scenarios, worst, expected, score};
  }).sort((a,b)=>b.score-a.score);
  return {input:x, strategies, recommended:strategies[0], eligible:x.price >= x.minimum, assumptions:['Một sản phẩm / đơn; chưa tính hoàn hàng, vận chuyển, quảng cáo hoặc voucher sàn.', 'Phí tổng hợp tính trên doanh thu sau voucher; cần thay bằng bảng phí đã xác minh.', 'Traffic và uplift do bạn nhập, không phải dự báo hoặc xác suất thống kê.', 'Thời gian, phạm vi và mã voucher được lưu trong kế hoạch; không tự đồng bộ Shopee.']};
}
