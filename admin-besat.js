/* ══════════════════════════════════════════
   BESAT ADMIN — برنامه‌های فرهنگی بعثه (برنامه ثابت روزانه هر شهر)
   داده: besat = { enabled, title, logo, emblem, cities: { najaf: [program, ...] } }
   program = { id, title, start:'HH:MM', end, days:[0..6] (خالی = هر روز), place, mapNeshanUrl, mapGoogleUrl, speaker, desc, poster }
══════════════════════════════════════════ */
const BESAT_TITLE = 'برنامه‌های فرهنگی بعثه مقام معظم رهبری';
/* ترتیب هفته ایرانی؛ عدد = getDay() جاوااسکریپت */
const BESAT_DAYS = [[6, 'شنبه'], [0, 'یکشنبه'], [1, 'دوشنبه'], [2, 'سه‌شنبه'], [3, 'چهارشنبه'], [4, 'پنجشنبه'], [5, 'جمعه']];
const bid = () => 'bp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
let besatState = { enabled: false, title: BESAT_TITLE, logo: '', emblem: '', cities: {} };
const besatOpen = {};

function initBesat() {
  const b = CARAVAN_DATA.besat || {};
  besatState = { enabled: !!b.enabled, title: b.title || BESAT_TITLE, logo: b.logo || '', emblem: b.emblem || '', cities: {} };
  ALL_CITIES.forEach(id => {
    besatState.cities[id] = ((b.cities || {})[id] || []).map(p => ({
      id: p.id || bid(), title: p.title || '', start: p.start || '', end: p.end || '', days: (p.days || []).slice(),
      place: p.place || '', mapNeshanUrl: p.mapNeshanUrl || '', mapGoogleUrl: p.mapGoogleUrl || '',
      speaker: p.speaker || '', desc: p.desc || '', poster: p.poster || ''
    }));
    besatOpen[id] = -1;
  });
  renderBesatAdmin();
}

function renderBesatAdmin() {
  const el = document.getElementById('besat-admin');
  if (!el) return;
  const on = besatState.enabled;
  el.innerHTML = `
  <div class="sec-card open">
    <div class="sec-card-head no-toggle">
      <div class="sec-head-icon ico-gen">👁️</div>
      <div class="sec-head-info"><div class="sec-head-title">وضعیت نمایش برای کاربران</div><div class="sec-head-sub">تا برنامه‌ها کامل نشده، این بخش را خاموش نگه دارید</div></div>
    </div>
    <div class="sec-body" style="display:block">
      <label class="fswitch">
        <input type="checkbox" ${on ? 'checked' : ''} onchange="besatState.enabled=this.checked;renderBesatAdmin()">
        <span class="fsw-track"><span class="fsw-dot"></span></span>
        <b>${on ? '✅ برنامه‌های بعثه برای همه کاربران نمایش داده می‌شود' : '⛔ برنامه‌های بعثه فعلاً برای کاربران پنهان است'}</b>
      </label>
      <div class="empty-msg" style="line-height:2">وقتی خاموش است، فقط شما در «پیش‌نمایش» و روی همین دستگاه آن را با برچسب «پنهان از کاربران» می‌بینید.</div>
      <div style="padding:0 16px 14px"><button class="add-row-btn" style="margin:0;width:100%" onclick="openPreview()">👁 پیش‌نمایش زنده در تب جدید (بدون انتشار)</button></div>
    </div>
  </div>

  <div class="sec-card open">
    <div class="sec-card-head no-toggle">
      <div class="sec-head-icon ico-gen">🏷️</div>
      <div class="sec-head-info"><div class="sec-head-title">عنوان و آرم</div><div class="sec-head-sub">آرم کوچک کنار برنامه هر شهر و آرم کامل بالای صفحه برنامه‌ها</div></div>
    </div>
    <div class="sec-body" style="display:block">
      <div class="field"><div class="field-label">عنوان بخش</div>
        <input type="text" class="input-full" value="${escH(besatState.title)}" oninput="besatState.title=this.value"></div>
      <div class="field" style="display:grid;grid-template-columns:1fr 2fr;gap:12px;align-items:end">
        ${besatLogoPick('emblem', 'آرم کوچک (مربعی)', 'besat-emblem.png')}
        ${besatLogoPick('logo', 'آرم کامل (با نوشته)', 'besat-logo.png')}
      </div>
    </div>
  </div>

  ${ALL_CITIES.map(id => `
  <div class="sec-card ${besatState.cities[id].length || id === 'najaf' || id === 'karbala' ? 'open' : ''}" id="card-besat-${id}">
    <div class="sec-card-head" onclick="toggleCard('besat-${id}')">
      <div class="sec-head-icon ico-gen">🕌</div>
      <div class="sec-head-info"><div class="sec-head-title">برنامه روزانه ${escH((cityMeta[id] && cityMeta[id].name) || DEFAULT_CITY[id])}</div>
        <div class="sec-head-sub" id="besat-cnt-${id}">${besatCountLabel(id)}</div></div>
      <span class="sec-chevron">▼</span>
    </div>
    <div class="sec-body" id="besat-${id}">${besatListHTML(id)}</div>
  </div>`).join('')}`;
}

function besatLogoPick(k, label, def) {
  const src = besatState[k + 'Data'] || besatState[k + 'Preview'] || besatState[k] || def;
  return `<div><div class="field-label">${label}</div>
    <div style="background:#fff;border:1px solid var(--border-s);border-radius:10px;padding:8px;display:flex;align-items:center;justify-content:center;height:84px">
      <img src="${escH(src)}" alt="" style="max-width:100%;max-height:68px"></div>
    <div class="hero-btns" style="margin-top:6px"><label>🔄 تغییر<input type="file" accept="image/*" hidden onchange="pickBesatLogo('${k}',this)"></label>
      ${besatState[k] || besatState[k + 'Data'] ? `<label style="border-color:rgba(231,76,60,.4);color:var(--red);background:var(--red-bg)" onclick="besatState['${k}']='';delete besatState['${k}Data'];delete besatState['${k}Preview'];renderBesatAdmin()">↩️</label>` : ''}</div></div>`;
}
/* PNG تا شفافیت آرم حفظ شود */
function pngResize(file, maxW) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxW / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); res(cv.toDataURL('image/png'));
    };
    img.onerror = () => rej(new Error('تصویر خوانده نشد'));
    img.src = url;
  });
}
async function pickBesatLogo(k, input) {
  const f = input.files && input.files[0];
  if (!f) return;
  try { besatState[k + 'Data'] = await pngResize(f, k === 'logo' ? 900 : 300); renderBesatAdmin(); showToast('آرم انتخاب شد — برای ثبت، «انتشار» را بزنید'); }
  catch (e) { showToast('❌ ' + e.message); }
}

function besatListHTML(id) {
  const list = besatState.cities[id], open = besatOpen[id];
  const add = `<div class="hotel-tools"><button class="add-row-btn" onclick="addBesat('${id}')">+ برنامه جدید</button></div>`;
  if (!list.length) return add + '<div class="empty-msg">برنامه‌ای ثبت نشده. مثلاً: «سخنرانی صبحگاهی — ساعت ۹ — حسینیه ...»</div>';
  return add + list.map((p, i) => {
    let h = `
    <div class="hotel-entry ${open === i ? 'open' : ''}">
      <div class="hotel-entry-head" onclick="toggleBesat('${id}',${i})">
        <div class="hotel-num">${i + 1}</div>
        <div class="hotel-thumb-a" id="bt-${id}-${i}" style="font-size:12px;font-weight:800;width:auto;padding:0 8px" dir="ltr">${escH(p.start || '--:--')}</div>
        <div style="flex:1;min-width:0">
          <div class="hotel-entry-name" id="bn-${id}-${i}">${escH(p.title) || 'برنامه جدید'}</div>
          <div class="hotel-meta">${besatDaysLabel(p.days)}${p.place ? ' · ' + escH(p.place) : ''}</div>
        </div>
        <div class="hotel-ctl" onclick="event.stopPropagation()">
          <button title="کپی این برنامه" onclick="dupBesat('${id}',${i})">⧉</button>
          <button title="بالاتر" onclick="moveBesat('${id}',${i},-1)">▲</button>
          <button title="پایین‌تر" onclick="moveBesat('${id}',${i},1)">▼</button>
          <button class="del-btn" title="حذف" onclick="delBesat('${id}',${i})">🗑</button>
        </div>
        <span class="hotel-chev">▼</span>
      </div>`;
    if (open !== i) return h + '</div>';
    const f = (k, lbl, ph, type = 'text', ltr) => `<div><div class="field-label">${lbl}</div>
      <input type="${type}" class="input-full" value="${escH(p[k])}" placeholder="${ph}" ${ltr ? 'dir="ltr"' : ''} oninput="setBesat('${id}',${i},'${k}',this.value)"></div>`;
    const poster = p.posterData || p.posterPreview || p.poster;
    h += `
      <div class="hotel-fields">
        ${f('title', 'عنوان برنامه', 'مثلاً: دعای کمیل و سخنرانی')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${f('start', '🕐 ساعت شروع', '', 'time', true)}
          ${f('end', '🕐 ساعت پایان (اختیاری)', '', 'time', true)}
        </div>
        <div><div class="field-label">📅 روزهای اجرا — هیچ‌کدام را انتخاب نکنید یعنی «هر روز»</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${BESAT_DAYS.map(([d, l]) => `<button type="button" class="add-row-btn"
            style="margin:0;width:auto;padding:6px 12px;${p.days.includes(d) ? 'background:var(--gold);color:#fff;border-style:solid' : ''}"
            onclick="toggleBesatDay('${id}',${i},${d})">${l}</button>`).join('')}</div></div>
        ${f('place', '📍 مکان اجرا', 'مثلاً: صحن حضرت عباس (ع)، رواق ...')}
        ${f('mapGoogleUrl', '🌍 لینک گوگل مپ مکان (برای دکمه مسیریابی)', 'https://maps.google.com/...', 'text', true)}
        ${f('mapNeshanUrl', '🗺️ لینک نقشه نشان (اختیاری)', 'https://nshn.ir/...', 'text', true)}
        ${f('speaker', '🎤 سخنران / مداح (اختیاری)', 'مثلاً: حجت‌الاسلام ...')}
        <div><div class="field-label">📝 توضیح کوتاه (اختیاری)</div>
          <textarea class="input-full" rows="3" style="height:auto;min-height:70px;background:var(--bg);color:var(--text);border:1px solid var(--border-s);border-radius:10px;padding:10px 12px;font-size:14px;line-height:1.8;resize:vertical" oninput="setBesat('${id}',${i},'desc',this.value)">${escH(p.desc)}</textarea></div>
        <div><div class="field-label">🖼️ پوستر (اختیاری)</div>
          ${poster ? `<img src="${escH(poster)}" alt="" style="max-width:160px;border-radius:10px;display:block;margin-bottom:6px">` : ''}
          <div class="hero-btns"><label>${poster ? '🔄 تغییر پوستر' : '📷 انتخاب پوستر'}<input type="file" accept="image/*" hidden onchange="pickBesatPoster('${id}',${i},this)"></label>
          ${poster ? `<label style="border-color:rgba(231,76,60,.4);color:var(--red);background:var(--red-bg)" onclick="clearBesatPoster('${id}',${i})">🗑 حذف</label>` : ''}</div></div>
      </div>
    </div>`;
    return h;
  }).join('');
}
function besatDaysLabel(days) {
  if (!days.length || days.length === 7) return 'هر روز';
  return BESAT_DAYS.filter(([d]) => days.includes(d)).map(([, l]) => l).join('، ');
}
function besatCountLabel(id) { const n = besatState.cities[id].length; return n ? n + ' برنامه' : 'هنوز برنامه‌ای ثبت نشده'; }
function renderBesatCity(id) {
  const el = document.getElementById('besat-' + id);
  if (el) el.innerHTML = besatListHTML(id);
  const c = document.getElementById('besat-cnt-' + id);
  if (c) c.textContent = besatCountLabel(id);
}
function toggleBesat(id, i) { besatOpen[id] = besatOpen[id] === i ? -1 : i; renderBesatCity(id); }
function addBesat(id) {
  besatState.cities[id].push({ id: bid(), title: '', start: '', end: '', days: [], place: '', mapNeshanUrl: '', mapGoogleUrl: '', speaker: '', desc: '', poster: '' });
  besatOpen[id] = besatState.cities[id].length - 1; renderBesatCity(id);
}
function dupBesat(id, i) {
  const p = besatState.cities[id][i];
  besatState.cities[id].splice(i + 1, 0, { ...p, id: bid(), days: p.days.slice(), title: p.title });
  besatOpen[id] = i + 1; renderBesatCity(id);
  showToast('برنامه کپی شد — ساعت یا روزهای آن را عوض کنید');
}
function moveBesat(id, i, d) {
  const a = besatState.cities[id], j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]]; besatOpen[id] = -1; renderBesatCity(id);
}
function delBesat(id, i) {
  if (!confirm('این برنامه حذف شود؟')) return;
  besatState.cities[id].splice(i, 1); besatOpen[id] = -1; renderBesatCity(id);
}
function setBesat(id, i, k, v) {
  besatState.cities[id][i][k] = v;
  if (k === 'title') { const n = document.getElementById(`bn-${id}-${i}`); if (n) n.textContent = v || 'برنامه جدید'; }
  if (k === 'start') { const n = document.getElementById(`bt-${id}-${i}`); if (n) n.textContent = v || '--:--'; }
}
function toggleBesatDay(id, i, d) {
  const days = besatState.cities[id][i].days, k = days.indexOf(d);
  if (k >= 0) days.splice(k, 1); else days.push(d);
  renderBesatCity(id);
}
async function pickBesatPoster(id, i, input) {
  const f = input.files && input.files[0];
  if (!f) return;
  try { besatState.cities[id][i].posterData = await resizeMax(f, 1200); renderBesatCity(id); showToast('پوستر انتخاب شد — برای ثبت، «انتشار» را بزنید'); }
  catch (e) { showToast('❌ ' + e.message); }
}
function clearBesatPoster(id, i) {
  const p = besatState.cities[id][i];
  delete p.posterData; delete p.posterPreview; p.poster = ''; renderBesatCity(id);
}

/* خروجی برای data.js */
function getBesatData() {
  const img = k => besatState[k] || (BUILD_PENDING && besatState[k + 'Data']) || '';
  const cities = {};
  ALL_CITIES.forEach(id => {
    const list = besatState.cities[id].filter(p => p.title.trim()).map(p => {
      const o = { id: p.id, title: p.title.trim(), start: p.start, ...(p.end ? { end: p.end } : {}),
        days: p.days.slice().sort((a, b) => a - b), place: p.place.trim() };
      ['mapNeshanUrl', 'mapGoogleUrl', 'speaker', 'desc'].forEach(k => { if (p[k].trim()) o[k] = p[k].trim(); });
      const poster = p.poster || (BUILD_PENDING && p.posterData);
      if (poster) o.poster = poster;
      return o;
    });
    if (list.length) cities[id] = list;
  });
  return { enabled: besatState.enabled, title: besatState.title.trim() || BESAT_TITLE,
    ...(img('logo') ? { logo: img('logo') } : {}), ...(img('emblem') ? { emblem: img('emblem') } : {}), cities };
}

async function uploadPendingBesat(token) {
  let any = false;
  for (const k of ['logo', 'emblem']) {
    if (!besatState[k + 'Data']) continue;
    const path = `besat/${k}-${Date.now()}.png`;
    await putFile(path, '', 'Add Besat logo', token, besatState[k + 'Data'].split(',')[1]);
    besatState[k] = path; besatState[k + 'Preview'] = besatState[k + 'Data']; delete besatState[k + 'Data']; any = true;
  }
  for (const id of ALL_CITIES) for (const p of besatState.cities[id]) {
    if (!p.posterData) continue;
    const path = 'besat/p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
    await putFile(path, '', 'Add Besat poster', token, p.posterData.split(',')[1]);
    p.poster = path; any = true;
    p.posterPreview = p.posterData; delete p.posterData;
  }
  if (any) renderBesatAdmin();
}
