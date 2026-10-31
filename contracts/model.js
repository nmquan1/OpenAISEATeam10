// Shared contract for the browser, deterministic engine and HTTP boundary.
// Money is integer VND; percentages remain percent units for this v1 UI contract.
export const defaults = Object.freeze({ name:'Serum phục hồi 30ml', price:299000, cost:125000, fee:15, stock:500, traffic:3000, cvr:3, low:1.5, base:3, high:5, uplift:20, risk:'balanced', type:'percent', value:15, cap:50000, minimum:199000, quota:300, budget:10000000, start:'2026-11-11T00:00', end:'2026-11-11T23:59', scope:'product', code:'MAKER1111' });
export class ValidationError extends Error {}
export function object(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError(`${label}: object required`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new ValidationError(`${label}: unknown field ${key}`);
}
export function parseInput(input = {}, {complete = false} = {}) {
  object(input, Object.keys(defaults), 'input');
  if (complete) for (const key of Object.keys(defaults)) if (!Object.hasOwn(input,key)) throw new ValidationError(`input: missing ${key}`);
  const x = {...defaults, ...input};
  const integers = ['price','cost','stock','traffic','cap','minimum','quota','budget'];
  for (const key of Object.keys(defaults).filter(k=>typeof defaults[k] === 'number')) {
    const max = ['fee','cvr'].includes(key) ? 100 : ['low','base','high'].includes(key) ? 100 : key === 'uplift' ? 1000 : ['stock','traffic','quota'].includes(key) ? 1e6 : 1e9;
    if (!Number.isFinite(x[key]) || x[key] < 0 || x[key] > max || (integers.includes(key) && !Number.isSafeInteger(x[key]))) throw new ValidationError(`input.${key}: invalid number (0..${max})`);
  }
  if (x.price === 0) throw new ValidationError('input.price must be positive');
  for (const [key,max] of [['name',100],['code',30]]) if (typeof x[key] !== 'string' || !x[key].trim() || x[key].length > max) throw new ValidationError(`input.${key}: invalid text`);
  for (const [key,values] of Object.entries({type:['fixed','percent'],risk:['safe','balanced','growth'],scope:['product','shop']})) if (!values.includes(x[key])) throw new ValidationError(`input.${key}: invalid option`);
  if (x.type === 'percent' ? x.value > 100 : !Number.isSafeInteger(x.value)) throw new ValidationError('input.value: invalid discount');
  if (x.low > x.base || x.base > x.high) throw new ValidationError('Traffic cần theo thứ tự thấp ≤ cơ sở ≤ cao.');
  // Campaign wall-clock time has an explicit contract: Asia/Ho_Chi_Minh.
  const timestamp = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
    const date = new Date(`${value}:00Z`);
    return Number.isFinite(+date) && date.toISOString().slice(0,16) === value ? +date : NaN;
  };
  if (!Number.isFinite(timestamp(x.start)) || !Number.isFinite(timestamp(x.end)) || timestamp(x.start) >= timestamp(x.end)) throw new ValidationError('Thời gian kết thúc phải sau thời gian bắt đầu; định dạng YYYY-MM-DDTHH:mm.');
  return x;
}
export function parseRequest(body, {context = false} = {}) {
  object(body, context ? ['input','context'] : ['input'], 'request');
  const input = parseInput(body.input, {complete:true});
  const text = Object.hasOwn(body,'context') ? body.context : '';
  if (context && (typeof text !== 'string' || text.length > 10000)) throw new ValidationError('context: at most 10000 characters');
  return {input, ...(context ? {context:text} : {})};
}
