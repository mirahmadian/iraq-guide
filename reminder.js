/* ══════════════════════════════════════════
   REMINDER — یادآوری برنامه‌های بعثه
   برنامه وب نمی‌تواند وقتی بسته است زنگ بزند؛ پس یک رویداد تقویم (ics) با هشدار ساخته می‌شود
   و تقویم خود گوشی سر وقت خبر می‌دهد (حتی بدون اینترنت).
   وقتی برنامه باز است، خودش هم پیام یادآوری نشان می‌دهد.
══════════════════════════════════════════ */
(function injectReminderCSS() {
  const css = `
  #remOverlay{z-index:255}
  .bp-rem{display:inline-flex;align-items:center;gap:6px;min-height:40px;margin-top:10px;padding:0 14px;border-radius:100px;cursor:pointer;
    border:1px solid var(--brass-l);background:var(--card);color:var(--brass);font-family:var(--font);font-size:calc(13px * var(--fs,1));font-weight:800}
  .bp-rem.set{background:var(--gold-dim);border-color:var(--gold);color:var(--pri-ink)}
  .rem-sec{font-size:calc(12.5px * var(--fs,1));font-weight:800;color:var(--brass);margin:12px 0 6px}
  .rem-chips{display:flex;flex-wrap:wrap;gap:8px}
  .rem-chips button{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--border-s);background:var(--card2);color:var(--text);
    font-family:var(--font);font-size:calc(13px * var(--fs,1));font-weight:800;cursor:pointer}
  .rem-chips button.on{background:var(--gold);border-color:var(--gold);color:#fff}
  .rem-chips button:disabled{opacity:.4;cursor:default}
  .rem-go{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;margin-top:16px;border:none;border-radius:14px;
    background:var(--gold);color:#fff;font-family:var(--font);font-size:calc(15px * var(--fs,1));font-weight:900;cursor:pointer}
  .rem-alt{display:block;text-align:center;margin:10px 0 4px;font-size:calc(12.5px * var(--fs,1));font-weight:700;color:var(--pri-ink)}
  .rem-note{font-size:calc(12px * var(--fs,1));color:var(--dim);line-height:1.9;margin-top:8px;text-align:center}
  .rem-when{font-size:calc(13px * var(--fs,1));color:var(--muted);text-align:center;margin-top:-6px}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const REM_KEY = 'caravan-reminders';
const REM_LEADS = [10, 15, 30, 60];
let remSel = { lead: 15, scope: 'next' }, remProg = null;

function remLoad() { try { return JSON.parse(localStorage.getItem(REM_KEY) || '[]'); } catch (e) { return []; } }
function remSave(list) { try { localStorage.setItem(REM_KEY, JSON.stringify(list.filter(r => r.end > Date.now()))); } catch (e) {} }
function remIsSet(pid) { return remLoad().some(r => r.pid === pid && r.end > Date.now()); }

/* نوبت‌های آینده یک برنامه در ۷ روز آینده (زمان‌ها به میلی‌ثانیه UTC) */
function remOccurrences(cityId, p, days = 7) {
  const out = [], now = Date.now();
  for (let k = 0; k <= days; k++) {
    const ni = iraqNow(new Date(now + k * 864e5));
    if (!besatOnDay(p, ni.day)) continue;
    const base = Date.UTC(ni.y, ni.mo, ni.d) - IRAQ_TZ * 3600e3;
    const start = base + besatStart(p, cityId, ni) * 6e4, end = base + besatEnd(p, cityId, ni) * 6e4;
    if (start > now) out.push({ start, end, day: ni.day, k });
  }
  return out;
}
function remWhenText(o) {
  const ni = iraqNow(new Date(o.start)), hm = faDigits(besatHM(ni.min));
  return (o.k === 0 ? 'امروز' : o.k === 1 ? 'فردا' : BESAT_DAY_NAMES[o.day]) + ' ساعت ' + hm;
}

function openReminder(cityId, pid) {
  const p = besatList(cityId).find(x => x.id === pid);
  if (!p) return;
  remProg = { cityId, p };
  const occ = remOccurrences(cityId, p);
  if (!occ.length) { showToast('نوبت دیگری از این برنامه در هفته آینده نیست'); return; }
  if (remSel.scope === 'all' && occ.length < 2) remSel.scope = 'next';
  let v = document.getElementById('remOverlay');
  if (!v) {
    document.body.insertAdjacentHTML('beforeend', `<div class="overlay" id="remOverlay" role="dialog" aria-modal="true" aria-label="یادآوری" onclick="if(event.target===this)closeReminder()">
      <div class="modal" id="remBox"></div></div>`);
    v = document.getElementById('remOverlay');
  }
  renderReminder();
  v.classList.add('open');
}
function closeReminder() { const v = document.getElementById('remOverlay'); if (v) v.classList.remove('open'); }
function renderReminder() {
  const { cityId, p } = remProg, occ = remOccurrences(cityId, p);
  document.getElementById('remBox').innerHTML = `
    <div class="modal-handle" aria-hidden="true"></div>
    <div class="modal-title">⏰ یادآوری «${escHtml(p.title)}»</div>
    <div class="rem-when">نوبت بعدی: ${remWhenText(occ[0])}${p.at ? ' (حدودی، بعد از اذان)' : ''}</div>
    <div class="rem-sec">چند دقیقه قبل خبرم کن؟</div>
    <div class="rem-chips">${REM_LEADS.map(m => `<button class="${remSel.lead === m ? 'on' : ''}" onclick="remSel.lead=${m};renderReminder()">${m.toLocaleString('fa')} دقیقه</button>`).join('')}</div>
    <div class="rem-sec">برای کدام نوبت‌ها؟</div>
    <div class="rem-chips">
      <button class="${remSel.scope === 'next' ? 'on' : ''}" onclick="remSel.scope='next';renderReminder()">فقط نوبت بعدی</button>
      <button class="${remSel.scope === 'all' ? 'on' : ''}" ${occ.length < 2 ? 'disabled' : ''} onclick="remSel.scope='all';renderReminder()">همه نوبت‌های ۷ روز آینده (${occ.length.toLocaleString('fa')} بار)</button>
    </div>
    <button class="rem-go" onclick="addReminder()">📅 افزودن به تقویم گوشی</button>
    <a class="rem-alt" href="${remGoogleUrl(cityId, p, occ[0])}" target="_blank" rel="noopener" onclick="remRemember()">یا: افزودن با تقویم گوگل (نیاز به اینترنت) ›</a>
    <div class="rem-note">گوشی می‌پرسد «به تقویم اضافه شود؟» — «افزودن / ذخیره» را بزنید.<br>از آن به بعد تقویم گوشی سر وقت خبرتان می‌کند، حتی اگر این برنامه بسته باشد.</div>
    <button class="modal-close" style="margin-top:12px" onclick="closeReminder()">بستن</button>`;
}

/* ── فایل تقویم (iCalendar) ── */
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTime = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/* خطوط بلندتر از ۷۵ بایت باید شکسته شوند (بدون شکستن حروف چندبایتی فارسی) */
function icsFold(line) {
  const enc = new TextEncoder(), parts = [];
  let cur = '', size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
function buildIcs(cityId, p, occs, lead) {
  const city = CARAVAN_DATA.cities.find(c => c.id === cityId) || {};
  const desc = [(besat() || {}).title || 'برنامه‌های فرهنگی بعثه', p.at ? PRAYER_LABEL[p.at] : '', p.speaker ? 'سخنران: ' + p.speaker : '', p.desc || ''].filter(Boolean).join('\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//iraq-guide//besat//FA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  occs.forEach(o => lines.push(
    'BEGIN:VEVENT', `UID:${p.id}-${icsTime(o.start)}@iraq-guide`, `DTSTAMP:${icsTime(Date.now())}`,
    `DTSTART:${icsTime(o.start)}`, `DTEND:${icsTime(o.end)}`,
    `SUMMARY:${icsEsc(p.title)}`, `LOCATION:${icsEsc([p.place, city.name].filter(Boolean).join('، '))}`, `DESCRIPTION:${icsEsc(desc)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(p.title)}`, `TRIGGER:-PT${lead}M`, 'END:VALARM', 'END:VEVENT'));
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
function remGoogleUrl(cityId, p, o) {
  const city = CARAVAN_DATA.cities.find(c => c.id === cityId) || {};
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(p.title) +
    '&dates=' + icsTime(o.start) + '/' + icsTime(o.end) + '&location=' + encodeURIComponent([p.place, city.name].filter(Boolean).join('، ')) +
    '&details=' + encodeURIComponent(((besat() || {}).title || '') + (p.at ? '\n' + PRAYER_LABEL[p.at] : ''));
}

function remRemember(occs) {
  const { cityId, p } = remProg;
  occs = occs || remOccurrences(cityId, p).slice(0, 1);
  const list = remLoad().filter(r => !(r.pid === p.id && occs.some(o => o.start === r.start)));
  occs.forEach(o => list.push({ pid: p.id, city: cityId, title: p.title, place: p.place || '', start: o.start, end: o.end, lead: remSel.lead, shown: false }));
  remSave(list);
  if ('Notification' in window && Notification.permission === 'default') try { Notification.requestPermission(); } catch (e) {}
  const b = document.getElementById('besatView');
  if (b && b.classList.contains('open')) renderBesatView();
}
function addReminder() {
  const { cityId, p } = remProg, all = remOccurrences(cityId, p);
  const occs = remSel.scope === 'all' ? all : all.slice(0, 1);
  const ics = buildIcs(cityId, p, occs, remSel.lead), name = 'یادآوری ' + p.title + '.ics';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) {
    location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  } else {
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  remRemember(occs);
  closeReminder();
  showToast(ios ? 'در پنجره باز شده «Add to Calendar» را بزنید' : 'فایل تقویم دانلود شد — آن را باز کنید و «ذخیره» را بزنید', 6000);
}

/* وقتی برنامه باز است: یادآوری داخل خود برنامه */
function remTick() {
  const now = Date.now(), list = remLoad();
  let changed = false;
  list.forEach(r => {
    if (r.shown || now < r.start - r.lead * 6e4 || now > r.end) return;
    r.shown = true; changed = true;
    const mins = Math.max(0, Math.round((r.start - now) / 6e4));
    const msg = `⏰ ${r.title} — ${mins ? mins.toLocaleString('fa') + ' دقیقه دیگر' : 'هم‌اکنون'}${r.place ? ' · ' + r.place : ''}`;
    showToast(msg, 10000);
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
    if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker)
      navigator.serviceWorker.ready.then(reg => reg.showNotification(r.title, { body: msg, icon: 'app-icon-192.png', lang: 'fa', dir: 'rtl', tag: r.pid + r.start })).catch(() => {});
  });
  if (changed) remSave(list);
}
setInterval(remTick, 30000);
setTimeout(remTick, 2000);
