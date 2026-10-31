// Multi-voucher portfolio from docs/agent-strategy/01-strategy-engine.md.
// Deterministic: product guard → pick & score → allocate + matrix → worst-stack check.
// Pure and browser-compatible; fees come from the verified catalog.
import {feeCatalog, feeRateBps} from './fees.js';

export const strategyCatalogVersion = 'strategies@2026-10-31';

// Lower-bound gross margin used only when cost is missing (heuristic, flagged `inferred`).
const inferredMargin = {beauty:.6, health:.6, fashion:.5, fmcg_other:.25, mom_baby_care:.25, electronics_other:.1, laptop_monitor:.1, phone_tablet:.1};
const DEFAULT_MARGIN = .3;
const SHIP_SUBSIDY = 25000; // domestic VN shipping assumption for freeship vouchers
const MIN_PCT = 3, MAX_PCT = 10, EXCLUDE_BELOW = .1;

const median = xs => {const s = [...xs].sort((a,b)=>a-b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;};
const threshold = aov => Math.max(1000, Math.ceil(aov / 100000) * 100000 - 1000);

// Highest discount d keeping contribution ≥ floor: price(1−d)(1−fee−floor) ≥ cost + flat fee.
function guard(p, floorBps, programme) {
  const rate = feeRateBps({category:p.category, programme}) / 10000;
  const room = p.price * (1 - rate - floorBps / 10000);
  const dMax = room > 0 ? 1 - (p.cost + feeCatalog.infrastructure.dong_per_order) / room : -1;
  return {...p, fee_rate_bps:Math.round(rate * 10000), d_max:Math.round(dMax * 1000) / 1000, eligible:dMax >= EXCLUDE_BELOW};
}

// Contribution of one basket after vouchers, all fees per item, shipping and gift cost.
function contribution(items, {pct = 0, freeship = false, gift = null}, programme) {
  const gross = items.reduce((a,p)=>a + p.price, 0);
  const discount = Math.round(gross * pct / 100);
  const net = gross - discount;
  const fees = items.reduce((a,p)=>a + Math.round(p.price * (1 - pct / 100) * p.fee_rate_bps / 10000), 0) + feeCatalog.infrastructure.dong_per_order;
  const cost = items.reduce((a,p)=>a + p.cost, 0) + (gift ? gift.cost : 0) + (freeship ? SHIP_SUBSIDY : 0);
  return {gross, net, cm:net - fees - cost, cm_bps:net > 0 ? Math.round((net - fees - cost) / net * 10000) : -10000};
}

export function planPortfolio({products, customers, vouchers, floor = 20, programme = 'standard'}) {
  const floorBps = Math.round(floor * 100);
  const inferred = [];
  const rows = products.map(p => {
    if (Number.isFinite(p.cost)) return {...p, inferred:false};
    inferred.push(`cost:${p.name}`);
    return {...p, cost:Math.round(p.price * (1 - (inferredMargin[p.category] ?? DEFAULT_MARGIN))), inferred:true};
  }).map(p => guard(p, floorBps, programme));
  const eligible = rows.filter(p => p.eligible);
  const gifts = rows.filter(p => !p.eligible).sort((a,b)=>a.cost - b.cost);
  const aov = Math.round(1.75 * median(rows.map(p=>p.price)));
  const min = threshold(aov);
  const coverage = customers > 0 ? vouchers / customers : 0;
  const warnings = [];
  if (coverage > .25) warnings.push(`Số voucher bằng ${Math.round(coverage*100)}% số khách: dễ "dạy" khách chờ giảm giá. Nên giảm số lượng và dùng mã riêng cho từng người.`);
  for (const p of rows) if (!p.eligible) warnings.push(`${p.name}: sau phí sàn ${(p.fee_rate_bps/100).toFixed(1)}% chỉ còn giảm được tối đa ${(Math.max(0,p.d_max)*100).toFixed(1)}%, loại khỏi voucher %.`);

  // Percent depth: largest whole percent every eligible product can absorb, clamped.
  const depth = eligible.length ? Math.min(MAX_PCT, Math.floor(Math.min(...eligible.map(p=>p.d_max)) * 100)) : 0;
  const pctOk = depth >= MIN_PCT;
  const candidates = [
    {code:`FREESHIP${Math.round(min/1000)}`, strategy_id:'AOV-02', score:18, kind:'freeship', rule:`free_ship min_order=${min}`, ok:eligible.length > 0},
    {code:`TIER${Math.round(min/1000)}-${depth}`, strategy_id:'AOV-01', score:15, kind:'pct', pct:depth, rule:`percent=${depth} min_order=${min}`, ok:pctOk},
    {code:`WELCOME${depth}`, strategy_id:'ACQ-01', score:14, kind:'pct', pct:depth, rule:`percent=${depth} first_order unique_code`, ok:pctOk},
    {code:`GWP${Math.round(min/1000)}`, strategy_id:'AOV-03', score:13, kind:'gift', gift:gifts[0], rule:`gift=${gifts[0]?.name} min_order=${min}`, ok:gifts.length > 0 && eligible.length > 0}
  ].filter(c => c.ok);
  const keep = coverage < .1 ? 2 : 4;
  let picked = candidates.slice(0, keep);

  // Worst basket: cheapest repeat of the lowest-headroom eligible product reaching the threshold.
  const worstItem = eligible.slice().sort((a,b)=>a.d_max - b.d_max)[0];
  const basket = worstItem ? Array(Math.max(1, Math.ceil(min / worstItem.price))).fill(worstItem) : [];
  const stackOf = list => ({pct:Math.max(0, ...list.filter(v=>v.kind==='pct').map(v=>v.pct)), freeship:list.some(v=>v.kind==='freeship'), gift:list.find(v=>v.kind==='gift')?.gift ?? null});
  const worst = [];
  const matrix = {};
  for (const a of picked) matrix[a.code] = {};
  for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) {
    const a = picked[i], b = picked[j];
    if (a.kind === 'pct' && b.kind === 'pct') {matrix[a.code][b.code] = matrix[b.code][a.code] = 'best_of'; continue;}
    const r = contribution(basket, stackOf([a,b]), programme);
    const pass = r.cm_bps >= floorBps;
    matrix[a.code][b.code] = matrix[b.code][a.code] = pass ? 'yes' : 'no';
    worst.push({basket:`${basket.length} × ${worstItem.name}`, stack:[a.code,b.code], cm_bps:r.cm_bps, pass});
  }
  for (const v of picked) {
    const r = contribution(basket, stackOf([v]), programme);
    v.pass = !basket.length || r.cm_bps >= floorBps;
    worst.push({basket:basket.length ? `${basket.length} × ${worstItem.name}` : '—', stack:[v.code], cm_bps:r.cm_bps, pass:v.pass});
  }
  const dropped = picked.filter(v => !v.pass);
  for (const v of dropped) warnings.push(`${v.code}: giỏ xấu nhất chỉ còn biên ${(worst.find(w=>w.stack.length===1&&w.stack[0]===v.code).cm_bps/100).toFixed(1)}% < floor ${floor}%, đã bỏ.`);
  picked = picked.filter(v => v.pass);
  for (const v of dropped) {delete matrix[v.code]; for (const k of Object.keys(matrix)) delete matrix[k][v.code];}

  // Allocate quantities by score, rounded to tens; remainder goes to the top strategy.
  const total = picked.reduce((a,v)=>a + v.score, 0);
  const allocation = picked.map(v => ({...v, qty:Math.floor(vouchers * v.score / total / 10) * 10}));
  if (allocation.length) allocation[0].qty += vouchers - allocation.reduce((a,v)=>a + v.qty, 0);

  const status = allocation.length ? 'ok' : 'no_feasible_strategy';
  if (!allocation.length) warnings.push(`Không có voucher nào giữ được floor ${floor}% sau phí sàn. Cân nhắc tăng giá, giảm giá vốn hoặc hạ floor.`);
  return {
    status,
    catalog_version:feeCatalog.version,
    strategy_version:strategyCatalogVersion,
    assumptions:{aov, min_order:min, floor_pct:floor, programme, ship_subsidy:SHIP_SUBSIDY, coverage_bps:Math.round(coverage*10000), inferred},
    products:rows.map(({name,price,cost,category,inferred,fee_rate_bps,d_max,eligible})=>({name,price,cost,category,inferred,fee_rate_bps,d_max,eligible})),
    excluded_from_pct:rows.filter(p=>!p.eligible).map(p=>p.name),
    vouchers:allocation.map(({code,strategy_id,qty,rule})=>({code,strategy_id,qty,rule})),
    matrix,
    worst_stack:worst,
    warnings
  };
}
