/* ══════════════════════════════════════════
   NOTICES — اطلاعیه‌های عمومی (از پنل مدیریت ← عمومی ← اطلاعیه‌ها)
   site.notices = [{ id, text, created(ms), days(0 = تا وقتی حذف شود), cities[] }]
   کاربر می‌تواند اطلاعیه را از صفحه اول ببندد؛ همه اطلاعیه‌ها در «بیشتر ← اطلاعیه‌ها» می‌ماند.
══════════════════════════════════════════ */
(function injectNoticeCSS() {
  const css = `
  .notices{display:flex;flex-direction:column;gap:8px;margin-top:12px}
  .ntc{position:relative;display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:var(--r);text-align:right;
    background:var(--card);border:1px solid var(--border);color:var(--text);font-family:var(--font)}
  .ntc-ic{width:40px;height:40px;border-radius:13px;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:2px;
    color:var(--brass);background:rgba(201,162,75,.14);box-shadow:0 0 0 2px var(--card),0 0 0 3px var(--brass-l)}
  .ntc-ic .ico{width:22px;height:22px}
  .ntc-body{flex:1;min-width:0;font-size:calc(14.5px * var(--fs,1));font-weight:700;line-height:1.9;overflow-wrap:anywhere}
  .ntc-body a{color:inherit;text-decoration:underline}
  .ntc-meta{display:flex;align-items:center;gap:8px;margin-top:2px;font-size:calc(11.5px * var(--fs,1));font-weight:600;color:var(--muted)}
  .ntc-new{display:inline-block;padding:0 8px;border-radius:100px;background:var(--c-clinic);color:#fff;font-size:calc(11px * var(--fs,1));font-weight:800;opacity:1}
  .ntc-x{flex-shrink:0;width:36px;height:36px;margin:-4px -6px 0 -6px;border:none;background:none;color:var(--dim);cursor:pointer;display:flex;align-items:center;justify-content:center}
  .ntc-x .ico{width:18px;height:18px}
  .ntc-all{align-self:flex-start;border:none;background:none;padding:0 4px;font-family:var(--font);font-size:calc(12px * var(--fs,1));font-weight:800;color:var(--pri-ink);cursor:pointer}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const NTC_KEY = 'caravan-notices-closed';
function ntcClosed() { try { return JSON.parse(localStorage.getItem(NTC_KEY) || '[]'); } catch (e) { return []; } }
function noticesFor(cityId, now = Date.now()) {
  return ((CARAVAN_DATA.site || {}).notices || []).filter(n => n.text &&
    (!n.days || now < n.created + n.days * 864e5) &&
    (!n.cities || !n.cities.length || n.cities.includes(cityId)))
    .sort((a, b) => b.created - a.created);
}
function ntcAgo(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 2) return 'همین الان';
  if (m < 60) return m.toLocaleString('fa') + ' دقیقه پیش';
  if (m < 1440) return Math.round(m / 60).toLocaleString('fa') + ' ساعت پیش';
  return Math.round(m / 1440).toLocaleString('fa') + ' روز پیش';
}
function ntcText(t) { return richText(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
function ntcHTML(n, closable) {
  const fresh = Date.now() - n.created < 864e5;
  return `<div class="ntc" role="note">
    <span class="ntc-ic" aria-hidden="true">${ico('megaphone')}</span>
    <div class="ntc-body">${ntcText(n.text)}
      <div class="ntc-meta">${fresh ? '<span class="ntc-new">جدید</span>' : ''}<span>${ntcAgo(n.created)}</span></div></div>
    ${closable ? `<button class="ntc-x" onclick="closeNotice('${escHtml(n.id)}')" aria-label="بستن اطلاعیه">${ico('x')}</button>` : ''}
  </div>`;
}
function noticesHTML(c) {
  const all = noticesFor(c.id), closed = ntcClosed(), open = all.filter(n => !closed.includes(n.id));
  if (!all.length) return '';
  return `<div class="notices" id="homeNotices">${open.map(n => ntcHTML(n, true)).join('')}
    ${open.length < all.length ? `<button class="ntc-all" onclick="openNotices()">${(all.length - open.length).toLocaleString('fa')} اطلاعیه بسته‌شده — دیدن همه ›</button>` : ''}</div>`;
}
function closeNotice(id) {
  const closed = ntcClosed();
  if (!closed.includes(id)) closed.push(id);
  try { localStorage.setItem(NTC_KEY, JSON.stringify(closed.slice(-100))); } catch (e) {}
  const el = document.getElementById('homeNotices');
  if (el) el.outerHTML = noticesHTML(homeCity()) || '<span></span>';
  showToast('اطلاعیه بسته شد — از «بیشتر ← اطلاعیه‌ها» دوباره دیده می‌شود');
}
function openNotices() {
  const c = homeCity(), all = c ? noticesFor(c.id) : [];
  openPage('اطلاعیه‌ها' + (c ? ' — ' + c.name : ''), all.length
    ? `<div class="notices">${all.map(n => ntcHTML(n, false)).join('')}</div>`
    : '<div class="sr-empty">در حال حاضر اطلاعیه‌ای نیست</div>');
}
