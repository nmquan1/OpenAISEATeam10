import {defaults,evaluate} from '../engine/index.js';
import {feeCatalog} from '../contracts/fee-catalog.js';
const form=document.querySelector('#inputs');
const specs={
 'product-fields':[['price','Giá bán (₫)',1],['cost','Giá vốn / SP (₫)',0],['fee','Tổng phí (%)',0,100],['stock','Tồn kho (SP)',0]],
 'voucher-fields':[['value','Mức giảm (% hoặc ₫)',0],['cap','Giảm tối đa (₫, cho %)',0],['minimum','Đơn tối thiểu (₫)',0],['quota','Lượt sử dụng',0],['budget','Ngân sách voucher (₫)',0]],
 'traffic-fields':[['traffic','Lượt truy cập ngày thường',0],['cvr','CVR cơ sở (%)',0,100],['low','Traffic thấp (×)',0],['base','Traffic cơ sở (×)',0],['high','Traffic cao (×)',0],['uplift','Tăng CVR tương đối (%)',0]]
};
document.getElementById('fee-fields').innerHTML=`<label>Ngành hàng (phí Shopee đã xác minh)<select name="category"><option value="">Tự nhập tổng phí %</option>${Object.entries(feeCatalog.commission.categories).map(([k,c])=>`<option value="${k}">${c.label}</option>`).join('')}</select></label><label>Chương trình<select name="programme"><option value="standard">Không tham gia</option><option value="voucher_xtra">Voucher Xtra</option></select></label><label>Voucher Shopee / đơn (₫)<input type="number" name="platformVoucher" min="0" step="1" required></label><label>Biên tối thiểu (%)<input type="number" name="floor" min="0" max="90" step="0.1" required></label>`;
for(const [id,fields] of Object.entries(specs))document.getElementById(id).innerHTML=fields.map(([key,label,min,max])=>`<label>${label}<input type="number" name="${key}" min="${min}" ${max!==undefined?`max="${max}"`:''} step="${['fee','cvr','low','base','high','uplift'].includes(key)?'0.1':'1'}" required></label>`).join('');
const money=n=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(n)+' ₫';
const compact=n=>Math.abs(n)>=1e6?(n/1e6).toLocaleString('vi-VN',{maximumFractionDigits:2})+' tr':money(n);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let result,scenario='base';
function reset(){clearAI();document.querySelector('#ai-context').value='';for(const [key,value] of Object.entries(defaults))if(form.elements[key])form.elements[key].value=value;run();}
function input(){const x=Object.fromEntries(new FormData(form));for(const key of Object.keys(defaults))if(typeof defaults[key]==='number')x[key]=Number(x[key]);return x;}
function run(){if(!form.reportValidity())return;try{result=evaluate(input());document.querySelector('#error').textContent='';render();}catch(e){document.querySelector('#error').textContent=e.message;document.querySelector('#results').innerHTML='<div class="card">Cần sửa đầu vào trước khi phân tích.</div>';result=null;}}
function portfolioCard({fees,portfolio:p}){
 if(!fees)return '<article class="card"><span class="pill">PHÍ SÀN</span><p class="muted">Chọn ngành hàng để tính phí Shopee đã xác minh và đề xuất danh mục voucher.</p></article>';
 const f=fees.per_order,row=(k,l)=>`<tr><td>${l}</td><td>${money(f.without_voucher[k])}</td><td>${money(f.with_voucher[k])}</td></tr>`;
 return `<article class="card"><span class="pill">PHÍ SÀN · ${escape(fees.catalog_version)}</span><div class="table-wrap"><table><thead><tr><th>Phí / đơn</th><th>Không voucher</th><th>Có voucher</th></tr></thead><tbody>${row('commission','Phí cố định')}${row('transaction','Phí xử lý giao dịch')}${row('infrastructure','Phí hạ tầng')}${row('voucherXtra','Voucher Xtra')}${row('cofund','Đồng tài trợ')}${row('tax','Thuế khấu trừ')}${row('total','Tổng')}</tbody></table></div>
 <h3 style="margin-top:16px">Danh mục voucher ${p.status==='ok'?'':'· không có phương án an toàn'}</h3>${p.vouchers.length?`<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Chiến lược</th><th>Số lượng</th><th>Quy tắc</th></tr></thead><tbody>${p.vouchers.map(v=>`<tr><td>${escape(v.code)}</td><td>${v.strategy_id}</td><td>${v.qty}</td><td>${escape(v.rule)}</td></tr>`).join('')}</tbody></table></div>`:''}${p.warnings.map(w=>`<p class="warning">${escape(w)}</p>`).join('')}<p class="muted">Giảm tối đa giữ biên ${p.assumptions.floor_pct}%: ${p.products.map(x=>`${escape(x.name)} ${(Math.max(0,x.d_max)*100).toFixed(1)}%`).join(' · ')}</p></article>`;
}
function render(){const {recommended:r,input:x,strategies:ss}=result;const b=r.scenarios[1];const selected=r.scenarios.find(s=>s.key===scenario);const maximum=Math.max(1,...ss.map(s=>Math.abs(s.scenarios.find(v=>v.key===scenario).profit)));const mode={safe:'Lợi nhuận thấp nhất trong ba kịch bản',balanced:'70% lợi nhuận cơ sở + 30% lợi nhuận thấp nhất',growth:'Doanh thu kịch bản cơ sở'}[x.risk];
 document.querySelector('#results').innerHTML=`<article class="card recommend"><span class="pill">↗ ĐỀ XUẤT TRONG 3 PHƯƠNG ÁN</span><h2>${r.name}</h2><p>${escape(x.name)} · ${r.discount?`Giảm ${money(r.discount)} / đơn đủ điều kiện`:'Không dùng voucher shop'}</p><p>Tiêu chí: ${mode}. ${r.note}</p><div class="metrics"><div class="metric"><span>Lợi nhuận · cơ sở</span><strong class="${b.profit>=0?'positive':'negative'}">${compact(b.profit)}</strong></div><div class="metric"><span>Đơn hàng · cơ sở</span><strong>${b.orders}<small> đơn</small></strong></div><div class="metric"><span>Chi voucher · cơ sở</span><strong>${compact(b.spend)}</strong></div></div>${!result.eligible?'<div class="warning">Giá sản phẩm thấp hơn đơn tối thiểu: mô hình 1 SP/đơn không đủ điều kiện voucher.</div>':''}${r.worst<0?'<div class="warning">Ngay cả phương án đứng đầu vẫn có kịch bản lỗ. Cần điều chỉnh giá vốn, phí hoặc mức giảm trước khi chạy.</div>':''}</article>
 <article class="card"><div class="chart-head"><div><h3>Lợi nhuận thay đổi theo traffic</h3><p class="muted">Cùng đầu vào. Ba cách tiếp cận.</p></div><div class="toggle" role="group" aria-label="Kịch bản traffic">${[['low','Thấp'],['base','Cơ sở'],['high','Cao']].map(([key,label])=>`<button type="button" data-scenario="${key}" class="${scenario===key?'active':''}" aria-pressed="${scenario===key}">${label}</button>`).join('')}</div></div><div class="chart">${ss.map(s=>{const p=s.scenarios.find(v=>v.key===scenario).profit;return `<div class="bar-row"><span>${s.name}</span><div class="track"><div class="bar ${s.id===r.id?'winner':''}" style="width:${Math.abs(p)/maximum*100}%;${p<0?'background:#c03e29':''}"></div></div><strong class="${p<0?'negative':''}">${compact(p)}</strong></div>`;}).join('')}</div><div class="legend"><i></i> Phương án đề xuất <span>· ${selected.visits.toLocaleString('vi-VN')} lượt truy cập giả định · thanh thể hiện độ lớn, số âm là lỗ</span></div><div class="table-wrap"><table><thead><tr><th>Chiến lược</th><th>Giảm / đơn</th><th>Đơn hàng</th><th>Lượt voucher</th><th>Chi voucher</th></tr></thead><tbody>${ss.map(s=>{const p=s.scenarios.find(v=>v.key===scenario);return `<tr><td>${s.name}</td><td>${money(s.discount)}</td><td>${p.orders}</td><td>${p.redeemed}</td><td>${money(p.spend)}</td></tr>`;}).join('')}</tbody></table></div>${selected.stockout?'<p class="warning">Nhu cầu có thể chạm tồn kho. Lợi nhuận đã giới hạn theo số sản phẩm có thể bán.</p>':''}${selected.exhausted?'<p class="warning">Voucher có thể hết lượt hoặc ngân sách. Đơn vượt giới hạn quay về mức nhu cầu không ưu đãi.</p>':''}</article>
 <article class="card"><span class="pill">ROUNDTABLE PREVIEW</span><h3 style="margin-top:12px">Ba góc nhìn, một quyết định rõ ràng.</h3><div class="roundtable"><div class="agent"><span class="agent-icon">F</span><h3>Finance · giữ biên</h3><p>Thấp nhất trong ba kịch bản: <strong>${money(r.worst)}</strong>. Phí giả định ${x.fee}% trên doanh thu sau voucher.</p></div><div class="agent"><span class="agent-icon">G</span><h3>Growth · tìm cơ hội</h3><p>Traffic từ ${x.low}× đến ${x.high}×. Uplift CVR tối đa ${x.uplift}% tương đối là giả định cần thử nghiệm.</p></div><div class="agent"><span class="agent-icon">R</span><h3>Risk · kiểm tra giới hạn</h3><p>Ngân sách ${money(x.budget)}, ${x.quota} lượt, tồn ${x.stock} SP. ${x.risk==='growth'?'Ưu tiên doanh thu có thể hy sinh lợi nhuận.':'Thứ hạng phản ánh khẩu vị đã chọn.'}</p></div></div><details><summary>Công thức, giả định & giới hạn</summary><ul>${result.assumptions.map(a=>`<li>${a}</li>`).join('')}<li>Lợi nhuận = (đơn × giá − chi voucher) × (1 − phí%) − đơn × giá vốn.</li><li>Không có xác suất cho ba kịch bản; kết quả cơ sở không phải kỳ vọng thống kê. Đây chỉ là phương án tốt nhất trong 3 ứng viên, không phải tối ưu toàn cục.</li><li>Mô hình chưa bao gồm ngân sách ads, độ co giãn theo ngành hàng hay tác động đối thủ.</li></ul></details></article>${portfolioCard(result)}`;
 for(const btn of document.querySelectorAll('[data-scenario]'))btn.addEventListener('click',()=>{scenario=btn.dataset.scenario;render();});
}
form.addEventListener('submit',e=>{e.preventDefault();run();});
// Money fields: arrow keys step 1.000 ₫ (Shift: 10.000 ₫) and results update while typing.
const moneyFields=['price','cost','cap','minimum','budget','platformVoucher'];
form.addEventListener('keydown',e=>{if(!moneyFields.includes(e.target.name)||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=(e.shiftKey?10000:1000)*(e.key==='ArrowUp'?1:-1);e.target.value=Math.max(Number(e.target.min)||0,(Number(e.target.value)||0)+step);e.target.dispatchEvent(new Event('input',{bubbles:true}));});
let live;form.addEventListener('input',e=>{if(e.target.type!=='number')return;clearTimeout(live);live=setTimeout(()=>{if(form.checkValidity())run();},150);});
form.addEventListener('change',()=>{if(form.checkValidity())run();else{result=null;document.querySelector('#results').innerHTML='<div class="card">Đầu vào chưa hợp lệ. Sửa các trường rồi phân tích lại.</div>';}});
document.querySelector('#reset').addEventListener('click',reset);
document.querySelector('#export').addEventListener('click',()=>{if(!result||!form.reportValidity())return;run();if(!result)return;const blob=new Blob([JSON.stringify({application:'Market Maker',mode:'deterministic-demo',exportedAt:new Date().toISOString(),...result},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='market-maker-plan.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});

let aiBusy=false, aiRevision=0;
const aiButton=document.querySelector('#ai-recommend');
const aiOutput=document.querySelector('#ai-output');
function clearAI(){aiRevision++;aiOutput.replaceChildren();}
form.addEventListener('input',clearAI);
form.addEventListener('change',clearAI);
document.querySelector('#ai-context').addEventListener('input',clearAI);
function validateAI(data){
 if(!data || typeof data.provider!=='string' || typeof data.model!=='string' || !Array.isArray(data.candidates) || !data.candidates.length || !data.recommended || !Array.isArray(data.limitations))throw new Error('Phản hồi AI không đúng cấu trúc.');
 for(const c of [...data.candidates,data.recommended]){
  if(typeof c.name!=='string' || !c.voucher || !['fixed','percent'].includes(c.voucher.type) || !['value','cap','minimum'].every(k=>Number.isFinite(c.voucher[k])) || !Number.isFinite(c.worst) || !Number.isFinite(c.expected) || !Array.isArray(c.scenarios) || !c.scenarios.some(s=>s.key==='base'))throw new Error('Phương án AI thiếu thông số có thể kiểm tra.');
  for(const s of c.scenarios)if(!['profit','orders','spend'].every(k=>Number.isFinite(s[k])))throw new Error('Kết quả tính toán AI không hợp lệ.');
 }
 return data;
}
function renderAI(data){
 const voucher=v=>v.type==='percent'?`${v.value}% · tối đa ${money(v.cap)}`:money(v.value);
 const r=data.recommended;
 aiOutput.innerHTML=`<div class="ai-result"><p class="eyebrow">${escape(data.provider)} · ${escape(data.model)}</p><h3>Đề xuất: ${escape(r.name)}</h3><p>Voucher <strong>${escape(voucher(r.voucher))}</strong> · đơn tối thiểu <strong>${money(r.voucher.minimum)}</strong></p><div class="metrics"><div class="metric"><span>Lợi nhuận cơ sở</span><strong>${compact(r.expected)}</strong></div><div class="metric"><span>Lợi nhuận thấp nhất</span><strong>${compact(r.worst)}</strong></div><div class="metric"><span>Phương án được tính</span><strong>${data.candidates.length}</strong></div></div><div class="table-wrap"><table><thead><tr><th>Phương án AI</th><th>Voucher</th><th>Đơn tối thiểu</th><th>Lãi cơ sở</th><th>Lãi thấp nhất</th></tr></thead><tbody>${data.candidates.map(c=>`<tr><td>${escape(c.name)}</td><td>${escape(voucher(c.voucher))}</td><td>${money(c.voucher.minimum)}</td><td>${money(c.expected)}</td><td>${money(c.worst)}</td></tr>`).join('')}</tbody></table></div><details open><summary>Giới hạn của đề xuất</summary><ul>${data.limitations.map(s=>`<li>${escape(s)}</li>`).join('')}</ul></details></div>`;
}
aiButton.addEventListener('click',async()=>{
 if(aiBusy || !form.reportValidity())return;
 run();if(!result)return;
 aiBusy=true;aiButton.disabled=true;aiButton.textContent='Đang phân tích bằng AI…';
 const revision=++aiRevision;
 aiOutput.textContent='Đang tạo phương án và kiểm tra các kịch bản. Có thể mất khoảng một phút.';
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),120000);
 try{
  const response=await fetch('/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:input(),context:document.querySelector('#ai-context').value}),signal:controller.signal});
  let data;try{data=await response.json();}catch{throw new Error('Server chưa hỗ trợ API AI hoặc trả về dữ liệu không hợp lệ.');}
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Không thể lấy đề xuất AI. Kiểm tra cấu hình server.');
  if(revision===aiRevision)renderAI(validateAI(data));
 }catch(error){if(revision===aiRevision){aiOutput.replaceChildren();const p=document.createElement('p');p.className='warning';p.setAttribute('role','alert');p.textContent=error.name==='AbortError'?'AI phản hồi quá lâu. Bạn có thể thử lại.':error.message;aiOutput.append(p);}}
 finally{clearTimeout(timeout);aiBusy=false;aiButton.disabled=false;aiButton.textContent='Đề xuất bằng AI ↗';}
});
reset();
