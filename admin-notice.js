/* ══════════════════════════════════════════
   NOTICES — اطلاعیه‌های عمومی برای همه زائران (بالای صفحه اول برنامه نمایش داده می‌شود)
══════════════════════════════════════════ */
const NOTICE_DAYS = [[1, '۱ روز'], [2, '۲ روز'], [3, '۳ روز'], [5, '۵ روز'], [7, '۱ هفته'], [14, '۲ هفته'], [0, 'تا وقتی خودم حذف کنم']];
let noticeState = [];

function initNotices() {
  noticeState = (((CARAVAN_DATA.site || {}).notices) || []).map(n => ({ id: n.id, text: n.text || '', created: n.created || Date.now(), days: n.days || 0, cities: (n.cities || []).slice() }));
  renderNotices();
}
function noticeExpired(n) { return n.days && Date.now() > n.created + n.days * 864e5; }
function noticeLeft(n) {
  if (!n.days) return 'تا وقتی حذفش کنید نمایش داده می‌شود';
  const h = Math.round((n.created + n.days * 864e5 - Date.now()) / 36e5);
  if (h <= 0) return '⛔ زمانش تمام شده — دیگر نمایش داده نمی‌شود و با انتشار بعدی پاک می‌شود';
  return 'تا ' + (h < 24 ? h.toLocaleString('fa') + ' ساعت' : Math.round(h / 24).toLocaleString('fa') + ' روز') + ' دیگر نمایش داده می‌شود';
}

function renderNotices() {
  const el = document.getElementById('notice-editor');
  if (!el) return;
  el.innerHTML = `
    <button class="add-row-btn" onclick="addNotice()">+ اطلاعیه جدید</button>
    ${noticeState.map((n, i) => `<div class="lay-slide" style="${noticeExpired(n) ? 'opacity:.55' : ''}">
      <textarea rows="3" class="input-full" style="resize:vertical;min-height:80px;height:100px;background:#fff;color:#1a1a1a;border:1px solid #cfd8d3;border-radius:10px;padding:10px;font-family:inherit;line-height:1.8"
        placeholder="مثلاً: به دلیل ازدحام، ورودی باب‌القبله حرم امام حسین (ع) امروز از ساعت ۱۸ تا ۲۲ بسته است."
        oninput="noticeState[${i}].text=this.value">${escH(n.text)}</textarea>
      <div class="field-label" style="margin:4px 0 0">مدت نمایش</div>
      <select class="fsel-a" onchange="noticeState[${i}].days=+this.value;renderNotices()">
        ${NOTICE_DAYS.map(([d, l]) => `<option value="${d}" ${n.days === d ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="empty-msg" style="padding:0">${noticeLeft(n)}</div>
      <div class="field-label" style="margin:4px 0 0">در کدام شهرها؟ (هیچ‌کدام = همه شهرها)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${ALL_CITIES.map(c => `<label class="fchk" style="padding:0"><input type="checkbox" ${n.cities.includes(c) ? 'checked' : ''}
        onchange="const a=noticeState[${i}].cities,k=a.indexOf('${c}');if(this.checked&&k<0)a.push('${c}');if(!this.checked&&k>=0)a.splice(k,1)"> ${escH((cityMeta[c] && cityMeta[c].name) || DEFAULT_CITY[c])}</label>`).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="add-row-btn" style="margin:0;width:auto;flex:1" onclick="noticeState[${i}].created=Date.now();renderNotices();showToast('زمان اطلاعیه از الان حساب می‌شود و دوباره برچسب «جدید» می‌گیرد')">🔄 دوباره «جدید» شود</button>
        <button class="del-btn" style="width:auto;height:auto;min-height:40px;padding:0 12px;display:flex;align-items:center;gap:4px;white-space:nowrap" onclick="if(confirm('این اطلاعیه حذف شود؟')){noticeState.splice(${i},1);renderNotices()}">🗑 حذف</button>
      </div>
    </div>`).join('')}
    <div class="empty-msg">اطلاعیه‌ها بالای صفحه اول برنامه با رنگ زرد نمایش داده می‌شوند؛ تا ۲۴ ساعت برچسب «جدید» دارند. کاربر می‌تواند اطلاعیه را ببندد و بعداً از «بیشتر ← اطلاعیه‌ها» دوباره ببیند. برای نوشتن پررنگ، متن را بین ** و ** بگذارید. برای ثبت، «انتشار» را بزنید.</div>`;
}
function addNotice() {
  noticeState.unshift({ id: 'n' + Date.now().toString(36), text: '', created: Date.now(), days: 1, cities: [] });
  renderNotices();
  const t = document.querySelector('#notice-editor textarea');
  if (t) t.focus();
}
function noticesOut() {
  const list = noticeState.filter(n => n.text.trim() && !noticeExpired(n))
    .map(n => ({ id: n.id, text: n.text.trim(), created: n.created, days: n.days, ...(n.cities.length ? { cities: n.cities.slice() } : {}) }));
  return list.length ? { notices: list } : {};
}
