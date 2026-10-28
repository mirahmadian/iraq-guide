/* ══════════════════════════════════════════
   GUIDE — ویرایش «راهنمای زائر» (توصیه‌ها، وسایل ممنوع، جملات عربی)
══════════════════════════════════════════ */
let guideState = { title: '', sections: [] };

function initGuide() {
  const g = CARAVAN_DATA.guide || {};
  guideState = { title: g.title || 'راهنمای زائر', sections: JSON.parse(JSON.stringify(g.sections || [])) };
  renderGuide();
}
const gH = (v, js, ph, extra = '') => `<input type="text" class="input-full" placeholder="${escH(ph)}" value="${escH(v || '')}" oninput="${js}" ${extra}>`;
const gTA = (v, js, ph) => `<textarea rows="3" dir="rtl" class="input-full" style="resize:vertical;height:90px;background:#fff;color:#1a1a1a;border:1px solid #cfd8d3;border-radius:10px;padding:8px 10px;font-family:inherit;line-height:1.8" placeholder="${escH(ph)}" oninput="${js}">${escH(v || '')}</textarea>`;
const gBtn = (label, js, danger) => `<button class="${danger ? 'del-btn' : 'add-row-btn'}" style="margin:0;width:auto;height:auto;min-height:36px;padding:0 10px;white-space:nowrap" onclick="${js}">${label}</button>`;

function renderGuide() {
  const el = document.getElementById('guide-admin');
  if (!el) return;
  const S = guideState.sections;
  el.innerHTML = `
  <div class="info-box"><strong>📘 راهنمای زائر</strong>
    این مطالب با آیکون «راهنمای زائر» در صفحه اول برنامه باز می‌شود. هر بخش را می‌توانید پنهان کنید (مثلاً تا وقتی متنش تأیید نشده)؛ بخش پنهان فقط در «پیش‌نمایش» دیده می‌شود.
    برای نوشتن پررنگ، متن را بین ** و ** بگذارید. برای ثبت، «انتشار» را بزنید.</div>
  <div class="sec-card open"><div class="sec-body" style="display:block">
    <div class="field"><div class="field-label">عنوان صفحه</div>${gH(guideState.title, 'guideState.title=this.value', 'راهنمای زائر')}</div>
  </div></div>
  ${S.map((s, i) => {
    const ph = s.type === 'phrases';
    return `<div class="sec-card open" style="${s.hidden ? 'opacity:.8;border-right:5px solid #c0392b' : 'border-right:5px solid #1f8a55'}">
    <div class="sec-body" style="display:block">
      <div class="field" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="text" class="input-full" style="width:56px;text-align:center;font-size:20px" value="${escH(s.icon || '')}" oninput="guideState.sections[${i}].icon=this.value" aria-label="شکلک">
        <div style="flex:1;min-width:160px">${gH(s.title, `guideState.sections[${i}].title=this.value`, 'عنوان بخش')}</div>
      </div>
      <div class="field" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;display:flex;gap:6px;min-width:220px" role="radiogroup" aria-label="نمایش برای کاربران">
          ${[[false, '👁 نمایش برای کاربران', '#1f8a55'], [true, '🙈 پنهان از کاربران', '#c0392b']].map(([h, l, c]) => `<button type="button" role="radio" aria-checked="${!!s.hidden === h}"
            style="flex:1;min-height:40px;border-radius:10px;font-family:inherit;font-weight:800;cursor:pointer;${!!s.hidden === h ? `background:${c};color:#fff;border:2px solid ${c}` : 'background:#fff;color:#888;border:1px solid #cfd8d3'}"
            onclick="guideState.sections[${i}].hidden=${h};renderGuide()">${l}</button>`).join('')}
        </div>
        ${gBtn('▲', `guideMove(${i},-1)`)}${gBtn('▼', `guideMove(${i},1)`)}${gBtn('🗑 حذف بخش', `if(confirm('بخش «${escH(s.title || '')}» با همه مطالبش حذف شود؟')){guideState.sections.splice(${i},1);renderGuide()}`, 1)}
      </div>
      <div class="field-label" style="padding:0 16px">${ph ? 'جمله‌ها (گروه، معنی فارسی، متن عربی، تلفظ)' : 'مطالب'} — ${(s.items || []).length.toLocaleString('fa')} مورد</div>
      ${(s.items || []).map((x, k) => `<div class="lay-slide" style="margin:8px 16px">
        ${ph ? `${gH(x.g, `guideState.sections[${i}].items[${k}].g=this.value`, 'گروه — مثلاً: احوالپرسی')}
          ${gH(x.fa, `guideState.sections[${i}].items[${k}].fa=this.value`, 'معنی فارسی')}
          ${gH(x.ar, `guideState.sections[${i}].items[${k}].ar=this.value`, 'متن عربی', 'lang="ar" style="font-size:18px"')}
          ${gH(x.pr, `guideState.sections[${i}].items[${k}].pr=this.value`, 'تلفظ به فارسی')}`
        : `${gH(x.t, `guideState.sections[${i}].items[${k}].t=this.value`, 'عنوان کوتاه (اختیاری)')}
          ${gTA(x.d, `guideState.sections[${i}].items[${k}].d=this.value`, 'متن')}`}
        <div style="display:flex;gap:6px;justify-content:flex-end">${gBtn('▲', `guideItemMove(${i},${k},-1)`)}${gBtn('▼', `guideItemMove(${i},${k},1)`)}${gBtn('🗑', `guideState.sections[${i}].items.splice(${k},1);renderGuide()`, 1)}</div>
      </div>`).join('')}
      <div style="padding:0 16px 12px">${gBtn(ph ? '+ جمله جدید' : '+ مطلب جدید', `guideAddItem(${i})`)}</div>
    </div></div>`;
  }).join('')}
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="add-row-btn" style="flex:1" onclick="guideState.sections.push({id:'s'+Date.now().toString(36),icon:'📄',title:'',hidden:true,items:[{t:'',d:''}]});renderGuide()">+ بخش جدید (متن)</button>
    <button class="add-row-btn" style="flex:1" onclick="guideState.sections.push({id:'p'+Date.now().toString(36),icon:'🗣️',title:'جملات کاربردی',type:'phrases',hidden:true,items:[{g:'',fa:'',ar:'',pr:''}]});renderGuide()">+ بخش جدید (جملات)</button>
  </div>`;
}
function guideMove(i, d) {
  const a = guideState.sections, j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]]; renderGuide();
}
function guideItemMove(i, k, d) {
  const a = guideState.sections[i].items, j = k + d;
  if (j < 0 || j >= a.length) return;
  [a[k], a[j]] = [a[j], a[k]]; renderGuide();
}
function guideAddItem(i) {
  const s = guideState.sections[i], last = (s.items || [])[s.items.length - 1] || {};
  s.items = s.items || [];
  s.items.push(s.type === 'phrases' ? { g: last.g || '', fa: '', ar: '', pr: '' } : { t: '', d: '' });
  renderGuide();
}
function getGuideData() {
  const clean = s => s.type === 'phrases'
    ? s.items.filter(x => (x.ar || '').trim()).map(x => ({ ...(x.g && x.g.trim() ? { g: x.g.trim() } : {}), fa: (x.fa || '').trim(), ar: x.ar.trim(), ...(x.pr && x.pr.trim() ? { pr: x.pr.trim() } : {}) }))
    : s.items.filter(x => (x.d || '').trim() || (x.t || '').trim()).map(x => ({ ...(x.t && x.t.trim() ? { t: x.t.trim() } : {}), d: (x.d || '').trim() }));
  return { title: guideState.title.trim() || 'راهنمای زائر',
    sections: guideState.sections.map(s => ({ id: s.id, icon: (s.icon || '').trim(), title: (s.title || '').trim(), ...(s.type ? { type: s.type } : {}), ...(s.hidden ? { hidden: true } : {}), items: clean({ ...s, items: s.items || [] }) })) };
}
