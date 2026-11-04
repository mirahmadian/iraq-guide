/* ══════════════════════════════════════════
   BALE — مشترکان بازوی بله @HamyarKaravan_Bot و ارسال پیام به آن‌ها (سرور: worker/bale.js)
   زائر با رضایت خودش شماره‌اش را در بله می‌فرستد؛ فهرست شماره‌ها فقط برای مدیر اصلی نمایش داده می‌شود.
══════════════════════════════════════════ */
let baleData = null, baleErr = '', baleBusy = false, baleShowList = false;

function baleLoad() {
  if (!ghToken && !STAFF) return;
  baleErr = '';
  adminFetch('/admin/bale', null, adminAuth()).then(d => { baleData = d; renderBale(); }).catch(e => { baleErr = e.message; renderBale(); });
}
function renderBale() {
  const el = document.getElementById('bale-admin');
  if (!el) return;
  const d = baleData, n = x => (+x || 0).toLocaleString('fa');
  const cityName = id => { const c = (CARAVAN_DATA.cities || []).find(x => x.id === id); return c ? c.name : id ? id : 'بدون شهر'; };
  el.innerHTML = baleErr ? `<div class="empty-msg" style="color:var(--red)">${escH(baleErr)}</div>`
    : !d ? `<div class="empty-msg">در حال دریافت… <button class="lock-link" onclick="baleLoad()">🔄</button></div>`
    : !d.ready ? '<div class="empty-msg">بازوی بله هنوز راه‌اندازی نشده است (توکن بازو روی سرور ثبت نشده).</div>' : `
    <div class="field"><b style="font-size:20px">${n(d.active)}</b> زائر عضو هستند${d.total > d.active ? ` <span style="color:#888">(${n(d.total - d.active)} نفر لغو کرده‌اند)</span>` : ''}
      ${d.city.length ? `<div style="font-size:13px;color:#555;margin-top:4px">${d.city.map(c => `${escH(cityName(c.k))}: ${n(c.n)}`).join(' · ')}</div>` : ''}</div>
    <div class="field"><div class="field-label">ارسال پیام در بله</div>
      <textarea id="baleText" rows="4" dir="rtl" class="input-full" style="resize:vertical;min-height:90px;background:#fff;color:#1a1a1a;border:1px solid #cfd8d3;border-radius:10px;padding:10px;font-family:inherit;line-height:1.8"
        placeholder="مثلاً: زائران محترم کربلا، به دلیل ازدحام، ورودی باب‌القبله امروز از ساعت ۱۸ تا ۲۲ بسته است."></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">
        <select id="baleCity" class="fsel-a" style="flex:1;min-width:160px"><option value="">همه مشترکان (${n(d.active)})</option>
          ${d.city.filter(c => c.k).map(c => `<option value="${escH(c.k)}">فقط زائرانی که الان ${escH(cityName(c.k))} را انتخاب کرده‌اند (${n(c.n)})</option>`).join('')}</select>
        <button class="pub-btn" id="baleBtn" onclick="baleSend()" ${baleBusy ? 'disabled' : ''}>📩 ارسال</button>
      </div>
      <div id="baleProg" class="empty-msg" style="padding:6px 0"></div></div>
    ${d.list ? `<div class="field"><button class="add-row-btn" style="margin:0" onclick="baleShowList=!baleShowList;renderBale()">${baleShowList ? '▴ بستن فهرست شماره‌ها' : '▾ فهرست شماره‌ها (فقط برای شما)'}</button>
      ${baleShowList ? `<button class="add-row-btn" style="margin:6px 0 0" onclick="baleCsv()">⬇️ دانلود فهرست (اکسل/CSV)</button>
      <div style="max-height:320px;overflow:auto;margin-top:6px;font-size:13px">${d.list.map(u => `<div style="display:flex;gap:8px;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;${u.active ? '' : 'opacity:.5'}">
        <span>${escH(u.name || '—')}</span><span dir="ltr">${escH(u.phone || '')}</span><span>${escH(u.city ? cityName(u.city) : '')}</span></div>`).join('')}</div>` : ''}</div>` : ''}
    <div class="empty-msg" style="padding:0">زائران از «بیشتر ← اطلاعیه‌ها در بله» در برنامه عضو می‌شوند. هر کس با نوشتن «لغو» در بازو، اشتراکش را لغو می‌کند.</div>`;
}
async function baleSend() {
  const text = document.getElementById('baleText').value.trim(), city = document.getElementById('baleCity').value;
  const opt = document.getElementById('baleCity').selectedOptions[0].textContent;
  if (!text) return showToast('متن پیام را بنویسید');
  if (!confirm(`این پیام برای «${opt}» در بله فرستاده شود؟\n\n${text}`)) return;
  baleBusy = true; document.getElementById('baleBtn').disabled = true;
  const prog = document.getElementById('baleProg');
  let after = 0, sent = 0, failed = 0;
  try {
    do {
      const r = await adminFetch('/admin/bale/send', { text, city, after }, adminAuth());
      sent += r.sent; failed += r.failed; after = r.next;
      prog.textContent = `در حال ارسال… ${sent.toLocaleString('fa')} نفر`;
    } while (after);
    prog.textContent = `✅ برای ${sent.toLocaleString('fa')} نفر فرستاده شد` + (failed ? ` (${failed.toLocaleString('fa')} نفر بازو را بسته‌اند)` : '');
    document.getElementById('baleText').value = '';
  } catch (e) { prog.textContent = '❌ ' + e.message + ` — تا این‌جا ${sent.toLocaleString('fa')} نفر`; }
  baleBusy = false; document.getElementById('baleBtn').disabled = false;
}
function baleCsv() {
  const rows = [['نام در بله', 'شماره', 'شهر', 'تاریخ عضویت', 'وضعیت']].concat(baleData.list.map(u => [u.name || '', u.phone || '', u.city || '', new Date(u.created).toLocaleDateString('fa-IR'), u.active ? 'عضو' : 'لغو کرده']));
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'hamyar-bale.csv'; document.body.appendChild(a); a.click(); a.remove();
}
renderBale();
