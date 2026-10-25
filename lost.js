/* ══════════════════════════════════════════
   LOST — «گم شده‌ام»: کارت عربی آدرس هتل برای نشان دادن به راننده/پلیس
   و فرستادن موقعیت فعلی با واتس‌اپ / پیامک. همه‌چیز بدون اینترنت کار می‌کند
   (به‌جز خود ارسال واتس‌اپ). اطلاعات کاربر فقط روی گوشی خودش ذخیره می‌شود.
══════════════════════════════════════════ */
(function injectLostCSS() {
  const css = `
  .lost-card{background:#fff;color:#111;border:3px solid #B3261E;border-radius:18px;padding:16px 16px 12px;box-shadow:0 4px 18px rgba(0,0,0,.12);font-family:var(--font)}
  .lc-h{font-size:calc(22px * var(--fs,1));font-weight:900;line-height:1.6;text-align:center;color:#B3261E}
  .lc-s{font-size:calc(16px * var(--fs,1));font-weight:700;line-height:1.8;text-align:center;margin:4px 0 10px}
  .lc-row{border-top:1px dashed #ccc;padding:9px 0}
  .lc-row small{display:block;font-size:calc(12.5px * var(--fs,1));color:#666;font-weight:700}
  .lc-row b{display:block;font-size:calc(19px * var(--fs,1));font-weight:900;line-height:1.6}
  .lc-row i{display:block;font-style:normal;font-size:calc(15px * var(--fs,1));font-weight:800;color:#333}
  .lc-ph{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 10px;padding:4px 0}
  .lc-ph + .lc-ph{border-top:1px dotted #ddd}
  .lc-ph small{display:inline;font-size:calc(12.5px * var(--fs,1));color:#555;font-weight:700}
  .lc-tel{display:inline-block;font-size:calc(22px * var(--fs,1));font-weight:900;color:#0E5A44;text-decoration:none;direction:ltr}
  .lc-fa{border-top:1px dashed #ccc;padding-top:8px;font-size:calc(12px * var(--fs,1));color:#555;line-height:1.8}
  .lc-miss{border-top:1px dashed #ccc;padding:10px 0;font-size:calc(14px * var(--fs,1));font-weight:800;color:#B3261E;text-align:center}
  .lost-p{font-size:calc(13px * var(--fs,1));color:var(--muted);line-height:1.9;margin:0 4px 8px}
  .lost-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;margin-top:10px;border:none;border-radius:14px;cursor:pointer;
    background:var(--gold);color:#fff;font-family:var(--font);font-size:calc(15px * var(--fs,1));font-weight:900;text-decoration:none}
  .lost-btn.alt{background:var(--card);color:var(--pri-ink);border:1px solid var(--gold)}
  .lost-btn.red{background:#B3261E}
  .lost-loc{margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--gold-dim);border:1px solid var(--gold);font-size:calc(13px * var(--fs,1));line-height:1.9;color:var(--text)}
  .lost-loc.err{background:rgba(179,38,30,.08);border-color:rgba(179,38,30,.4)}
  .lost-form{background:var(--card);border:1px solid var(--border-s);border-radius:16px;padding:12px 14px}
  .lost-form label{display:block;font-size:calc(12.5px * var(--fs,1));font-weight:800;color:var(--brass);margin:10px 0 4px}
  .lost-form label:first-child{margin-top:0}
  .lost-form select,.lost-form input{width:100%;min-height:46px;padding:0 12px;border-radius:12px;border:1px solid var(--border-s);background:var(--card2);color:var(--text);
    font-family:var(--font);font-size:calc(15px * var(--fs,1));box-sizing:border-box}
  .lost-hint{font-size:calc(11.5px * var(--fs,1));color:var(--dim);line-height:1.8;margin-top:8px}
  .sos-lost{display:flex;align-items:center;gap:10px;width:100%;min-height:56px;margin-bottom:12px;padding:0 16px;border:none;border-radius:16px;cursor:pointer;
    background:#B3261E;color:#fff;font-family:var(--font);font-size:calc(15px * var(--fs,1));font-weight:900;text-align:right}
  .sos-lost small{display:block;font-size:calc(11.5px * var(--fs,1));font-weight:700;opacity:.9}
  .hotel-mine{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;margin:10px 0 4px;border-radius:12px;cursor:pointer;
    border:1px dashed var(--gold);background:var(--card);color:var(--pri-ink);font-family:var(--font);font-size:calc(14px * var(--fs,1));font-weight:800}
  .hotel-mine.on{border-style:solid;background:var(--gold-dim)}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const MY_KEY = 'caravan-my';
function myInfo() {
  try { const o = JSON.parse(localStorage.getItem(MY_KEY) || '{}'); return { hotels: o.hotels || {}, name: o.name || '', phone: o.phone || '' }; }
  catch (e) { return { hotels: {}, name: '', phone: '' }; }
}
function mySave(o) { try { localStorage.setItem(MY_KEY, JSON.stringify(o)); } catch (e) {} }
function myHotel(c) { return c && (c.hotels || []).find(h => h.id === myInfo().hotels[c.id]); }
function lostIntl(num) { const n = toEnDigits(num || '').replace(/[^\d+]/g, ''); return !n ? '' : n.startsWith('+') ? n : n.startsWith('00') ? '+' + n.slice(2) : n.startsWith('0') ? '+98' + n.slice(1) : '+' + n; }
/* هر شماره در یک خط جدا، با عنوان صاحب شماره، تا دو شماره با هم اشتباه نشوند */
function lostTel(c) {
  return `<div class="lc-ph"><a class="lc-tel" href="tel:${buildPhone(c.phone, c.countryCode || '964')}">${escHtml(c.phone)}</a>${c.role ? `<small>${escHtml(c.role)}</small>` : ''}</div>`;
}

function lostCardHTML(c) {
  const me = myInfo(), h = myHotel(c), city = (c.arabic || c.name || '').split(' · ')[0];
  const hq = ((c.hq || {}).contacts || []).slice(0, 2);
  let html = `<div class="lost-card" lang="ar">
    <div class="lc-h">أنا زائر إيراني وقد ضللت الطريق</div>
    <div class="lc-s">أرجو مساعدتي للوصول إلى فندقي أو الاتصال بأحد هذه الأرقام</div>
    ${me.name ? `<div class="lc-row"><small>الاسم</small><b>${escHtml(me.name)}</b></div>` : ''}
    <div class="lc-row"><small>المدينة</small><b>${escHtml(city)}</b></div>`;
  if (h) {
    html += `<div class="lc-row"><small>الفندق</small><b>${escHtml(h.name)}</b>${h.nameEn ? `<i dir="ltr">${escHtml(h.nameEn)}</i>` : ''}</div>`;
    if (h.addressAr || h.address) html += `<div class="lc-row"><small>العنوان</small><b style="font-size:calc(17px * var(--fs,1))">${escHtml(h.addressAr || h.address)}</b></div>`;
    if ((h.contacts || []).length) html += `<div class="lc-row"><small>هاتف الفندق</small>${h.contacts.map(lostTel).join('')}</div>`;
  } else {
    html += `<div class="lc-miss">هتل شما هنوز انتخاب نشده — از پایین همین صفحه انتخابش کنید</div>`;
  }
  if (me.phone) html += `<div class="lc-row"><small>مسؤول القافلة</small><div class="lc-ph"><a class="lc-tel" href="tel:${lostIntl(me.phone)}">${escHtml(me.phone)}</a></div></div>`;
  if (hq.length) html += `<div class="lc-row"><small>مقر الزوار الإيرانيين${c.hq.title ? ' · ' + escHtml(c.hq.title) : ''}</small>${hq.map(lostTel).join('')}</div>`;
  return html + `<div class="lc-fa">ترجمه: من زائر ایرانی هستم و راه را گم کرده‌ام. لطفاً کمکم کنید به هتلم برسم یا با یکی از این شماره‌ها تماس بگیرید.</div></div>`;
}

function lostFormHTML(c) {
  const me = myInfo(), hotels = c.hotels || [], cur = me.hotels[c.id] || '';
  return `<div class="lost-form">
    ${hotels.length ? `<label for="lostHotel">🏨 هتل من در ${escHtml(c.name)}</label>
    <select id="lostHotel"><option value="">— انتخاب کنید —</option>${hotels.map(h =>
      `<option value="${escHtml(h.id)}" ${h.id === cur ? 'selected' : ''}>${escHtml(h.name)}${h.code ? ' (' + faDigits(h.code) + ')' : ''}</option>`).join('')}</select>` : ''}
    <label for="lostName">👤 نام من (اختیاری)</label>
    <input id="lostName" type="text" value="${escHtml(me.name)}" placeholder="مثلاً: علی محمدی">
    <label for="lostPhone">📞 شماره مسئول کاروان یا همراه (اختیاری)</label>
    <input id="lostPhone" type="tel" dir="ltr" value="${escHtml(me.phone)}" placeholder="0912…">
    <button class="lost-btn" onclick="lostSaveForm()">ذخیره</button>
    <div class="lost-hint">این اطلاعات فقط روی گوشی خودتان می‌ماند و برای کسی فرستاده نمی‌شود. در هر شهر، هتل همان شهر را انتخاب کنید.</div>
  </div>`;
}

function openLost() {
  const c = homeCity();
  if (!c) return;
  const h = myHotel(c);
  openPage('🆘 گم شده‌ام — ' + c.name, `<div class="lost">
    <p class="lost-p">اگر راه را گم کردید، این کارت را به <b>راننده تاکسی، پلیس یا خادمان حرم</b> نشان دهید. به عربی نوشته شده است.</p>
    ${lostCardHTML(c)}
    ${h && (h.mapNeshanUrl || h.mapGoogleUrl) ? `<div class="sec-lbl">🧭 مسیر تا هتل</div>${mapRowHTML(h.mapNeshanUrl, h.mapGoogleUrl)}` : ''}
    <div class="sec-lbl">📍 فرستادن موقعیت من</div>
    <p class="lost-p">جای فعلی‌تان را برای مسئول کاروان یا همراهتان بفرستید تا پیدایتان کنند. مکان‌یاب (GPS) گوشی باید روشن باشد.</p>
    <button class="lost-btn red" onclick="lostLocate()">📍 پیدا کردن و فرستادن موقعیت من</button>
    <div id="lostLoc"></div>
    <div class="sec-lbl">⚙️ اطلاعات من</div>
    ${lostFormHTML(c)}
  </div>`);
}

function lostSaveForm() {
  const c = homeCity(), me = myInfo(), sel = document.getElementById('lostHotel');
  if (sel) { if (sel.value) me.hotels[c.id] = sel.value; else delete me.hotels[c.id]; }
  me.name = document.getElementById('lostName').value.trim();
  me.phone = document.getElementById('lostPhone').value.trim();
  mySave(me);
  openLost();
  showToast('✓ ذخیره شد');
}
function lostSetHotel(cityId, hotelId, btn) {
  const me = myInfo(), on = me.hotels[cityId] === hotelId;
  if (on) delete me.hotels[cityId]; else me.hotels[cityId] = hotelId;
  mySave(me);
  if (btn) btn.outerHTML = hotelMineBtn(cityId, hotelId);
  showToast(on ? 'از «هتل من» برداشته شد' : '✓ هتل شما ثبت شد — در «گم شده‌ام» نشان داده می‌شود');
}
function hotelMineBtn(cityId, hotelId) {
  const on = myInfo().hotels[cityId] === hotelId, id = hotelId.replace(/'/g, "\\'");
  return `<button class="hotel-mine ${on ? 'on' : ''}" onclick="lostSetHotel('${cityId}','${id}',this)">${on ? '✓ هتل من (برای کارت «گم شده‌ام»)' : '🏨 این هتل من است'}</button>`;
}

function lostLocate() {
  const box = document.getElementById('lostLoc');
  const err = m => { box.innerHTML = `<div class="lost-loc err">${m}</div>`; };
  if (!navigator.geolocation) return err('این گوشی امکان مکان‌یابی ندارد.');
  box.innerHTML = '<div class="lost-loc">⏳ در حال پیدا کردن موقعیت… (ممکن است چند ثانیه طول بکشد)</div>';
  navigator.geolocation.getCurrentPosition(p => lostShowLoc(p.coords), e => {
    if (e.code === 1) err('اجازه دسترسی به موقعیت داده نشد. در تنظیمات گوشی، اجازه «موقعیت مکانی» را برای مرورگر یا این برنامه روشن کنید و دوباره بزنید.');
    else if (e.code === 3) err('پیدا کردن موقعیت طول کشید. اگر داخل ساختمان هستید، کنار پنجره یا در فضای باز دوباره امتحان کنید.');
    else err('موقعیت پیدا نشد. مکان‌یاب (GPS) گوشی را روشن کنید و دوباره بزنید.');
  }, { enableHighAccuracy: true, timeout: 25000, maximumAge: 60000 });
}

function lostShowLoc(co) {
  const me = myInfo(), c = homeCity(), h = myHotel(c);
  const lat = co.latitude.toFixed(6), lng = co.longitude.toFixed(6);
  const link = `https://maps.google.com/?q=${lat},${lng}`;
  const text = `🆘 ${me.name || 'من'} — موقعیت فعلی من:\n${link}` + (h ? `\nهتل: ${h.name} (${c.name})` : '');
  const t = encodeURIComponent(text), ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const ph = lostIntl(me.phone), acc = Math.round(co.accuracy || 0);
  let html = `<div class="lost-loc">✓ موقعیت پیدا شد${acc ? ` (دقت حدود ${acc.toLocaleString('fa')} متر)` : ''}. حالا یکی از راه‌های زیر را بزنید:</div>`;
  if (ph) html += `<a class="lost-btn" href="https://wa.me/${ph.replace('+', '')}?text=${t}" target="_blank" rel="noopener">💬 واتس‌اپ به ${escHtml(me.phone)}</a>`;
  html += `<a class="lost-btn ${ph ? 'alt' : ''}" href="https://wa.me/?text=${t}" target="_blank" rel="noopener">💬 واتس‌اپ (انتخاب مخاطب)</a>`;
  html += `<a class="lost-btn alt" href="sms:${ph}${ios ? '&' : '?'}body=${t}">✉️ پیامک — بدون اینترنت هم می‌رود</a>`;
  if (navigator.share) html += `<button class="lost-btn alt" onclick='navigator.share({text:${JSON.stringify(text).replace(/'/g, "&#39;")}}).catch(()=>{})'>📤 سایر برنامه‌ها (بله، ایتا، تلگرام…)</button>`;
  if (!ph) html += `<div class="lost-hint">اگر شماره مسئول کاروان را در «اطلاعات من» (پایین صفحه) وارد کنید، با یک لمس برای او فرستاده می‌شود.</div>`;
  document.getElementById('lostLoc').innerHTML = html;
}
