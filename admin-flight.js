/* ══════════════════════════════════════════
   FLIGHT ADMIN — ابزار «✈️ ساعت حرکت به فرودگاه»: جدول ساعت‌ها و متن هشدارها
   خروجی: flight = { rules:{شهر:{فرودگاه:ساعت}}, msgs:[{k, on, at|min, title, body}] } — پیش‌فرض‌ها در flight-def.js
══════════════════════════════════════════ */
let flAdm = null;
function initFlightAdmin() {
  const d = CARAVAN_DATA.flight || {}, c = flCfg();
  flAdm = { rules: JSON.parse(JSON.stringify(c.rules)), msgs: JSON.parse(JSON.stringify(Array.isArray(d.msgs) && d.msgs.length ? d.msgs : FL_DEF.msgs)) };
  /* هشدارهای ثابت (شب قبل، صبح) همیشه در فهرست باشند */
  FL_DEF.msgs.filter(m => FL_FIXED.includes(m.k) && !flAdm.msgs.some(x => x.k === m.k)).forEach(m => flAdm.msgs.unshift({ ...m, on: false }));
  renderFlightAdmin();
}
const flaFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
function flaWhen(m, i) {
  const num = (k, v, w, min, max, step) => `<input type="number" inputmode="decimal" min="${min}" max="${max}" step="${step || 1}" value="${v}" style="width:${w}px;text-align:center;font-weight:800" onchange="flAdm.msgs[${i}].${k}=+this.value;renderFlightAdmin()">`;
  if (m.k === 'eve') return `شب قبل از روز حرکت، ساعت ${num('at', m.at ?? 20, 64, 0, 23)} <span class="fla-dim">(فقط وقتی حرکت ۸ صبح به بعد است)</span>`;
  if (m.k === 'eveN') return `روز قبل، ساعت ${num('at', m.at ?? 14, 64, 0, 23)} <span class="fla-dim">(فقط وقتی حرکت بامداد، قبل از ۸ صبح است)</span>`;
  if (m.k === 'morn') return `صبح روز حرکت، ساعت ${num('at', m.at ?? 8, 64, 0, 23)} <span class="fla-dim">(اگر دست‌کم ۳ ساعت تا حرکت مانده باشد)</span>`;
  return +m.min ? `${num('min', m.min, 76, 1, 1440, 5)} دقیقه قبل از حرکت${+m.min >= 60 ? ` <span class="fla-dim">(${flaFa(+(m.min / 60).toFixed(2))} ساعت)</span>` : ''}` : `${num('min', 0, 76, 0, 1440, 5)} دقیقه قبل — <b>سر ساعت حرکت</b>`;
}
function renderFlightAdmin() {
  const el = document.getElementById('flight-admin');
  if (!el || !flAdm) return;
  const order = flAdm.msgs.map((m, i) => i).sort((a, b) => {
    const A = flAdm.msgs[a], B = flAdm.msgs[b], fa = FL_FIXED.indexOf(A.k), fb = FL_FIXED.indexOf(B.k);
    return (fa < 0) - (fb < 0) || (fa >= 0 ? fa - fb : (+B.min || 0) - (+A.min || 0));
  });
  el.innerHTML = `
    <div class="field-label">⏱️ چند ساعت قبل از پرواز از هتل خارج شوند؟</div>
    <div style="overflow-x:auto"><table class="fla-tbl"><thead><tr><th>هتل در</th>${Object.values(FL_AIR).map(a => `<th>${a}</th>`).join('')}</tr></thead><tbody>
      ${Object.entries(FL_CITY).map(([c, n]) => `<tr><td><b>${n}</b></td>${Object.keys(FL_AIR).map(a => `<td><input type="number" inputmode="decimal" min="0.5" max="24" step="0.5" value="${flAdm.rules[c][a]}" onchange="flAdm.rules['${c}']['${a}']=+this.value||${FL_DEF.rules[c][a]}"> ساعت</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    <div class="empty-msg" style="padding:6px 0 12px">طبق جدول «برنامه ساعات حرکت کاروان‌ها» بعثه. نیم ساعت را با ۰٫۵ بنویسید (مثلاً ۴٫۵).</div>

    <div class="field-label">🔔 هشدارها و متن آن‌ها</div>
    <div class="fla-help">در عنوان و متن، این کلمه‌ها (با همین آکولاد) خودکار پر می‌شوند:
      <code>{حرکت}</code> ساعت خروج از هتل · <code>{پرواز}</code> ساعت پرواز · <code>{فرودگاه}</code> نام فرودگاه · <code>{روز}</code> روز و تاریخ حرکت</div>
    ${order.map(i => { const m = flAdm.msgs[i], fixed = FL_FIXED.includes(m.k); return `<div class="fla-msg ${m.on === false ? 'off' : ''}">
      <div class="fla-top"><label class="fla-on"><input type="checkbox" ${m.on === false ? '' : 'checked'} onchange="flAdm.msgs[${i}].on=this.checked;renderFlightAdmin()"> فعال</label>
        <div class="fla-when">${flaWhen(m, i)}</div>
        ${fixed ? '' : `<button class="del-btn" title="حذف این هشدار" onclick="if(confirm('این هشدار حذف شود؟')){flAdm.msgs.splice(${i},1);renderFlightAdmin()}">🗑</button>`}</div>
      <input type="text" class="input-full" maxlength="80" placeholder="عنوان هشدار" value="${escH(m.title || '')}" oninput="flAdm.msgs[${i}].title=this.value">
      <textarea class="fla-body" rows="3" maxlength="400" placeholder="متن هشدار" oninput="flAdm.msgs[${i}].body=this.value">${escH(m.body || '')}</textarea>
      <div class="fla-prev">پیش‌نمایش: ${escH(flaFill(m.title))} — ${escH(flaFill(m.body))}</div>
    </div>`; }).join('')}
    <button class="add-row-btn" onclick="flaAdd()">+ افزودن هشدار تازه</button>
    <button class="lock-link" onclick="flaReset()">بازگرداندن ساعت‌ها و متن‌ها به پیش‌فرض</button>
    <div class="empty-msg" style="padding:8px 0 0">تغییرها بعد از «🚀 انتشار برای کاربران» در برنامه اعمال می‌شود. کسانی که قبلاً هشدار را روشن کرده‌اند، با متن قبلی خبر می‌گیرند تا دوباره دکمه را بزنند.</div>`;
}
const flaFill = x => String(x || '').replace(/\{حرکت\}/g, '۹:۰۰ صبح').replace(/\{پرواز\}/g, '۱۴:۰۰ ظهر').replace(/\{فرودگاه\}/g, 'فرودگاه نجف').replace(/\{روز\}/g, 'پنجشنبه ۱۵ آبان');
function flaAdd() {
  const used = new Set(flAdm.msgs.map(m => m.k));
  let k; do { k = 'x' + Math.random().toString(36).slice(2, 7); } while (used.has(k));
  flAdm.msgs.push({ k, min: 90, title: '⏰ یادآوری', body: 'حرکت ساعت {حرکت}.' });
  renderFlightAdmin();
}
function flaReset() {
  if (!confirm('ساعت‌ها و همه‌ی متن‌های هشدار به حالت پیش‌فرض برگردد؟')) return;
  flAdm = { rules: JSON.parse(JSON.stringify(FL_DEF.rules)), msgs: JSON.parse(JSON.stringify(FL_DEF.msgs)) };
  renderFlightAdmin();
}
function flightOut() {
  if (!flAdm) return {};
  const rules = {};
  Object.keys(FL_CITY).forEach(c => { rules[c] = {}; Object.keys(FL_AIR).forEach(a => { const v = +flAdm.rules[c][a]; rules[c][a] = v > 0 && v <= 24 ? v : FL_DEF.rules[c][a]; }); });
  const msgs = flAdm.msgs.map(m => {
    const o = { k: m.k, title: String(m.title || '').trim(), body: String(m.body || '').trim() };
    if (m.on === false) o.on = false;
    if (FL_FIXED.includes(m.k)) o.at = Math.max(0, Math.min(23, Math.round(+m.at || 0)));
    else o.min = Math.max(0, Math.min(1440, Math.round(+m.min || 0)));
    return o;
  }).filter(m => m.title || m.body);
  return { flight: { rules, msgs } };
}

(function injectFlightAdminCSS() {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .fla-tbl{border-collapse:collapse;width:100%;font-size:13px}
  .fla-tbl th,.fla-tbl td{border-bottom:1px solid var(--border);padding:8px 6px;text-align:center;white-space:nowrap}
  .fla-tbl input{width:64px;text-align:center;font-weight:800;padding:6px;border:1px solid var(--border-s);border-radius:8px;font-family:var(--font)}
  .fla-help{font-size:12.5px;line-height:2;background:var(--card2,#f6f1e7);border-radius:10px;padding:8px 10px;margin-bottom:10px}
  .fla-help code{background:#fff;border:1px solid var(--border-s);border-radius:6px;padding:0 5px;font-family:var(--font);font-weight:800}
  .fla-msg{border:1px solid var(--border-s);border-radius:12px;padding:10px;margin-bottom:10px;display:flex;flex-direction:column;gap:6px}
  .fla-msg.off{opacity:.55}
  .fla-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px}
  .fla-when{flex:1;min-width:200px;line-height:2}
  .fla-when input{padding:4px;border:1px solid var(--border-s);border-radius:8px;font-family:var(--font)}
  .fla-on{display:flex;align-items:center;gap:4px;font-weight:800;white-space:nowrap}
  .fla-dim{color:var(--dim,#888);font-size:11.5px}
  textarea.fla-body{height:auto;min-height:64px;background:#fff;color:var(--text);direction:rtl;font-size:13px;border:1px solid var(--border-s)}
  .fla-prev{font-size:11.5px;color:var(--dim,#888);line-height:1.8}
  </style>`);
})();
