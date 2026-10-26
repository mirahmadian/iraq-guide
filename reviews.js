/* ══════════════════════════════════════════
   REVIEWS — امتیاز (۱ تا ۵ ستاره) و نظر زائران درباره هتل‌ها
   سرور: Cloudflare Worker (پوشه worker/) — نوشتن نام اختیاری است؛ نظرها فوراً نمایش داده می‌شوند.
   نظر رکیک ثبت نمی‌شود، نظر نامناسب را هوش مصنوعی پنهان می‌کند، و نظری که ۳ نفر گزارش کنند پنهان می‌شود.
   هر گوشی برای هر هتل یک نظر دارد؛ نظر جدید جای قبلی را می‌گیرد.
══════════════════════════════════════════ */
(function injectReviewsCSS() {
  const css = `
  .rv-mini{display:inline-flex;align-items:center;gap:2px;margin-inline-start:6px;font-size:calc(11.5px * var(--fs,1));font-weight:800;color:#b7791f;white-space:nowrap}
  .rv-mini small{color:var(--dim);font-weight:600}
  .rv{margin-top:14px;padding:14px;border-radius:16px;background:var(--card);border:1px solid var(--border-s)}
  .rv-sum{display:flex;gap:14px;align-items:center}
  .rv-avg{text-align:center;min-width:84px}
  .rv-avg b{display:block;font-size:calc(34px * var(--fs,1));font-weight:900;line-height:1.1;color:var(--text)}
  .rv-avg small{font-size:calc(12px * var(--fs,1));color:var(--muted)}
  .rv-st{color:#e0a100;letter-spacing:1px;font-size:calc(15px * var(--fs,1));white-space:nowrap}
  .rv-st i{font-style:normal;color:var(--border-s)}
  .rv-dist{flex:1;display:flex;flex-direction:column;gap:3px}
  .rv-dist div{display:flex;align-items:center;gap:6px;font-size:calc(11px * var(--fs,1));color:var(--muted)}
  .rv-dist span{flex:1;height:7px;border-radius:4px;background:var(--card2);overflow:hidden}
  .rv-dist span i{display:block;height:100%;background:#e0a100;border-radius:4px}
  .rv-form{margin-top:14px;padding-top:12px;border-top:1px dashed var(--border-s)}
  .rv-form h4{margin:0 0 6px;font-size:calc(14px * var(--fs,1));font-weight:900;color:var(--text)}
  .rv-pick{display:flex;gap:4px;justify-content:center;direction:ltr;margin:6px 0 10px}
  .rv-pick button{width:46px;height:46px;border:0;background:none;font-size:34px;line-height:1;cursor:pointer;color:var(--border-s);padding:0;font-family:inherit}
  .rv-pick button.on{color:#e0a100}
  .rv-form input{width:100%;box-sizing:border-box;min-height:46px;padding:0 12px;margin-bottom:8px;border-radius:12px;border:1px solid var(--border-s);background:var(--card2);color:var(--text);
    font-family:var(--font);font-size:calc(14px * var(--fs,1))}
  .rv-form input:focus{outline:2px solid var(--gold);border-color:var(--gold)}
  .rv-who{font-weight:800;color:var(--text)}
  .rv-form textarea{width:100%;box-sizing:border-box;min-height:88px;padding:10px 12px;border-radius:12px;border:1px solid var(--border-s);background:var(--card2);color:var(--text);
    font-family:var(--font);font-size:calc(14px * var(--fs,1));line-height:1.8;resize:vertical}
  .rv-form textarea:focus{outline:2px solid var(--gold);border-color:var(--gold)}
  .rv-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;font-size:calc(12px * var(--fs,1));color:var(--dim)}
  .rv-btn{min-height:44px;padding:0 18px;border-radius:12px;border:0;background:var(--gold);color:#fff;font-family:var(--font);font-weight:900;font-size:calc(14px * var(--fs,1));cursor:pointer}
  .rv-btn:disabled{opacity:.5}
  .rv-link{background:none;border:0;color:var(--pri-ink);font-family:var(--font);font-weight:800;font-size:calc(12.5px * var(--fs,1));cursor:pointer;padding:8px 4px}
  .rv-msg{margin-top:8px;padding:10px 12px;border-radius:12px;font-size:calc(13px * var(--fs,1));line-height:1.8}
  .rv-msg.err{background:rgba(200,40,40,.1);color:var(--ruby-l,#c33)}
  .rv-msg.ok{background:var(--gold-dim);color:var(--text)}
  .rv-mine{margin-top:14px;padding:12px;border-radius:12px;background:var(--gold-dim);border:1px solid var(--gold)}
  .rv-item{padding:12px 2px;border-top:1px solid var(--border-s)}
  .rv-item p{margin:4px 0 0;font-size:calc(14px * var(--fs,1));line-height:1.9;color:var(--text);word-wrap:break-word}
  .rv-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:calc(11.5px * var(--fs,1));color:var(--dim)}
  .rv-rep{background:none;border:0;color:var(--dim);font-family:var(--font);font-size:calc(11.5px * var(--fs,1));cursor:pointer;padding:6px 4px}
  .rv-list-h{margin:16px 0 0;font-size:calc(13px * var(--fs,1));font-weight:900;color:var(--brass)}
  .rv-note{font-size:calc(11.5px * var(--fs,1));color:var(--dim);line-height:1.8;margin:10px 2px 0}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const RV_API = 'https://hamyar-reviews.hamyar-karevan.workers.dev';
const RV_SUM_KEY = 'caravan-rev-sum', RV_NAME_KEY = 'caravan-rev-name', RV_MAX = 300, RV_MAX_NAME = 30, RV_SHOW = 5;
let rvSum = {}, rvCur = null;
try { rvSum = JSON.parse(localStorage.getItem(RV_SUM_KEY) || '{}') || {}; } catch (e) {}

function rvDev() {
  let d = '';
  try { d = localStorage.getItem('caravan-dev') || ''; } catch (e) {}
  if (!/^[\w-]{16,64}$/.test(d)) {
    d = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    try { localStorage.setItem('caravan-dev', d); } catch (e) {}
  }
  return d;
}
function rvFetch(path, body) {
  return fetch(RV_API + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dev': rvDev() }, body: JSON.stringify(body) }
    : { headers: { 'X-Dev': rvDev() }, cache: 'no-store' })
    .then(r => r.json().catch(() => ({})).then(j => { if (!r.ok) throw new Error(j.error || 'خطا در ارتباط با سرور'); return j; }));
}

/* ستاره‌های کوچک در فهرست هتل‌ها */
function rvMini(cityId, hotelId) {
  const s = rvSum[cityId + '/' + hotelId];
  return `<span class="rv-mini" data-rvh="${cityId}/${hotelId}">${s ? `★ ${rvNum(s[0])} <small>(${faDigits(s[1])})</small>` : ''}</span>`;
}
function rvLoadSummary() {
  return fetch(RV_API + '/summary').then(r => r.ok ? r.json() : null).then(j => {
    if (!j) return;
    rvSum = j;
    try { localStorage.setItem(RV_SUM_KEY, JSON.stringify(j)); } catch (e) {}
    document.querySelectorAll('[data-rvh]').forEach(el => { const [c, h] = el.dataset.rvh.split('/'); el.outerHTML = rvMini(c, h); });
  }).catch(() => {});
}
rvLoadSummary();

const rvStars = n => `<span class="rv-st" aria-label="${faDigits(n)} از ۵ ستاره">${'★'.repeat(Math.round(n))}<i>${'★'.repeat(5 - Math.round(n))}</i></span>`;
const rvNum = n => faDigits(String(n).replace('.', '٫'));
function rvDate(ts) {
  const d = Math.floor((Date.now() - ts) / 864e5);
  if (d < 1) return 'امروز';
  if (d < 2) return 'دیروز';
  if (d < 30) return faDigits(d) + ' روز پیش';
  try { return new Date(ts).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' }); } catch (e) { return ''; }
}

/* جای بخش نظرها در صفحه هتل — بعد از ساخته شدن، rvLoad آن را پر می‌کند */
function rvBoxHTML(cityId, hotelId) {
  return `<div class="divider-lbl">امتیاز و نظر زائران</div><div class="rv" id="rv-box" data-h="${cityId}/${hotelId}"><div class="sr-empty">در حال دریافت نظرها…</div></div>`;
}
function rvLoad(cityId, hotelId) {
  const h = cityId + '/' + hotelId;
  rvCur = { h, data: null, pick: 0, edit: false, all: false };
  rvFetch('/list?h=' + encodeURIComponent(h)).then(d => {
    if (!rvCur || rvCur.h !== h) return;
    rvCur.data = d; rvCur.pick = d.mine ? d.mine.stars : 0;
    rvSum[h] = d.n ? [d.avg, d.n] : undefined;
    rvRender();
  }).catch(() => {
    const box = document.getElementById('rv-box');
    if (box && box.dataset.h === h) box.innerHTML = `<div class="sr-empty">برای دیدن و ثبت نظرها اینترنت لازم است.<br><button class="rv-link" onclick="rvLoad('${cityId}','${hotelId}')">🔄 تلاش دوباره</button></div>`;
  });
}

function rvRender(msg) {
  const box = document.getElementById('rv-box');
  if (!box || !rvCur || box.dataset.h !== rvCur.h || !rvCur.data) return;
  const d = rvCur.data, mine = d.mine;
  let html = d.n ? `<div class="rv-sum">
      <div class="rv-avg"><b>${rvNum(d.avg)}</b>${rvStars(d.avg)}<small>${faDigits(d.n)} رأی</small></div>
      <div class="rv-dist">${[5, 4, 3, 2, 1].map(s => `<div>${faDigits(s)}★<span><i style="width:${d.n ? Math.round(d.dist[s - 1] / d.n * 100) : 0}%"></i></span></div>`).join('')}</div>
    </div>` : `<div class="sr-empty" style="padding:4px">هنوز کسی به این هتل امتیاز نداده است. اولین نفر باشید!</div>`;

  if (mine && !rvCur.edit) {
    html += `<div class="rv-mine"><div class="rv-meta"><b style="color:var(--text)">نظر شما${mine.name ? ' — ' + escHtml(mine.name) : ''}</b>${rvStars(mine.stars)}</div>
      ${mine.text ? `<p style="margin:6px 0 0;line-height:1.9">${escHtml(mine.text)}</p>` : ''}
      ${mine.hidden ? `<div class="rv-msg err">این نظر برای دیگران نمایش داده نمی‌شود، چون نامناسب تشخیص داده شد. می‌توانید آن را ویرایش کنید.</div>` : ''}
      <div class="rv-row"><button class="rv-link" onclick="rvCur.edit=true;rvRender()">✏️ ویرایش</button><button class="rv-link" style="color:var(--dim)" onclick="rvDelete(${mine.id})">🗑 حذف نظر من</button></div>
    </div>`;
  } else {
    html += `<div class="rv-form"><h4>${mine ? 'ویرایش نظر شما' : 'شما به این هتل چند ستاره می‌دهید؟'}</h4>
      <div class="rv-pick" role="radiogroup" aria-label="امتیاز">${[1, 2, 3, 4, 5].map(s => `<button type="button" role="radio" aria-checked="${rvCur.pick === s}" aria-label="${faDigits(s)} ستاره" class="${s <= rvCur.pick ? 'on' : ''}" onclick="rvCur.pick=${s};rvPaintPick()">★</button>`).join('')}</div>
      <input id="rv-name" maxlength="${RV_MAX_NAME}" autocomplete="nickname" placeholder="نام شما (اختیاری) — مثلاً: حسین از اصفهان" value="${escHtml(rvCur.nameDraft != null ? rvCur.nameDraft : mine ? mine.name : rvSavedName())}" oninput="rvCur.nameDraft=this.value">
      <textarea id="rv-text" maxlength="${RV_MAX}" placeholder="نظر شما (اختیاری) — مثلاً درباره تمیزی، غذا، برخورد کارکنان، فاصله تا حرم…" oninput="rvCount(this)">${escHtml(rvCur.draft != null ? rvCur.draft : mine ? mine.text : '')}</textarea>
      <div class="rv-row"><span id="rv-count"></span>
        <span>${mine ? `<button class="rv-link" onclick="rvCur.edit=false;rvRender()">انصراف</button>` : ''}<button class="rv-btn" id="rv-send" onclick="rvSend()">ثبت نظر</button></span></div>
      ${msg ? `<div class="rv-msg ${msg.ok ? 'ok' : 'err'}">${escHtml(msg.text)}</div>` : ''}
    </div>`;
  }
  if (msg && mine && !rvCur.edit) html += `<div class="rv-msg ${msg.ok ? 'ok' : 'err'}">${escHtml(msg.text)}</div>`;

  const items = d.items || [];
  if (items.length) {
    html += `<div class="rv-list-h">نظر زائران</div>` + items.slice(0, rvCur.all ? items.length : RV_SHOW).map(r => `<div class="rv-item">
      <div class="rv-meta"><span><span class="rv-who">${r.name ? escHtml(r.name) : 'زائر'}</span> · ${rvDate(r.ts)}</span>${rvStars(r.stars)}</div>
      <p>${escHtml(r.text)}</p>
      <div style="text-align:left">${(d.reported || []).includes(r.id) ? '<span class="rv-rep">گزارش شد ✓</span>' : `<button class="rv-rep" onclick="rvReport(${r.id})">⚑ گزارش نظر نامناسب</button>`}</div>
    </div>`).join('');
    if (!rvCur.all && items.length > RV_SHOW) html += `<button class="rv-link" style="width:100%" onclick="rvCur.all=true;rvRender()">نمایش همه نظرها (${faDigits(items.length)}) ▾</button>`;
  }
  html += `<p class="rv-note">نوشتن نام اختیاری است؛ بدون نام، «زائر» نمایش داده می‌شود. نظرهای توهین‌آمیز یا نامربوط خودکار حذف می‌شوند.</p>`;
  box.innerHTML = html;
  const t = document.getElementById('rv-text');
  if (t) rvCount(t);
  const sp = document.querySelector('.rv-mini[data-rvh="' + rvCur.h + '"]');
  if (sp) { const [c, h] = rvCur.h.split('/'); sp.outerHTML = rvMini(c, h); }
}
function rvSavedName() { try { return localStorage.getItem(RV_NAME_KEY) || ''; } catch (e) { return ''; } }
function rvPaintPick() {
  document.querySelectorAll('.rv-pick button').forEach((b, i) => { b.classList.toggle('on', i < rvCur.pick); b.setAttribute('aria-checked', i + 1 === rvCur.pick); });
}
function rvCount(t) {
  rvCur.draft = t.value.replace(/\s*\n+\s*/g, ' ');
  if (t.value !== rvCur.draft) t.value = rvCur.draft; /* فقط یک پاراگراف */
  const el = document.getElementById('rv-count');
  if (el) el.textContent = faDigits(t.value.length) + ' / ' + faDigits(RV_MAX);
}
function rvSend() {
  if (!rvCur.pick) { rvRender({ text: 'اول با زدن روی ستاره‌ها امتیاز بدهید.' }); return; }
  const btn = document.getElementById('rv-send'), text = (document.getElementById('rv-text') || {}).value || '';
  const name = ((document.getElementById('rv-name') || {}).value || '').trim();
  try { localStorage.setItem(RV_NAME_KEY, name); } catch (e) {}
  if (btn) { btn.disabled = true; btn.textContent = 'در حال ثبت…'; }
  const h = rvCur.h;
  rvFetch('/post', { h, stars: rvCur.pick, text, name }).then(res => {
    rvCur.draft = rvCur.nameDraft = null; rvCur.edit = false;
    return rvFetch('/list?h=' + encodeURIComponent(h)).then(d => {
      if (!rvCur || rvCur.h !== h) return;
      rvCur.data = d; rvSum[h] = d.n ? [d.avg, d.n] : undefined;
      rvRender(res.hidden ? { text: 'نظر شما ثبت شد اما چون نامناسب تشخیص داده شد، برای دیگران نمایش داده نمی‌شود.' } : { ok: 1, text: '✅ نظر شما ثبت شد. ممنون!' });
    });
  }).catch(e => {
    rvRender({ text: navigator.onLine === false ? 'اینترنت وصل نیست. بعداً دوباره امتحان کنید.' : e.message });
  });
}
function rvReport(id) {
  if (!confirm('این نظر توهین‌آمیز، نامربوط یا تبلیغاتی است؟ اگر چند نفر گزارش کنند، پنهان می‌شود.')) return;
  rvFetch('/report', { id }).then(() => {
    (rvCur.data.reported = rvCur.data.reported || []).push(id);
    rvRender(); showToast('گزارش شما ثبت شد. ممنون!');
  }).catch(e => showToast(e.message));
}
function rvDelete(id) {
  if (!confirm('نظر و امتیاز شما برای این هتل حذف شود؟')) return;
  const h = rvCur.h;
  rvFetch('/delete', { id }).then(() => { const [c, ho] = h.split('/'); rvLoad(c, ho); showToast('نظر شما حذف شد'); }).catch(e => showToast(e.message));
}
