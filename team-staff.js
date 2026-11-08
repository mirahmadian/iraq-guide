'use strict';
/* ══════════════════════════════════════════
   👷 عوامل منطقه — پنل مدیر منطقه (سرور: worker/team-api، /api/admin/staff*)
   هر رکورد یک «دوره» است: نام، کد ملی، نقش، هتل، تاریخ شروع و خروج (اتباع خارجی حداکثر ۳۰ روز در عراق).
   تمدید = دوره‌ی تازه، دوره‌ی قبلی در سابقه می‌ماند. جابجایی بین هتل‌ها با سابقه (فهرست، هتل‌به‌هتل یا نقشه).
   هشدار ۵ روز / ۱ روز / روز خروج در بله (worker/teamstaff.js در hamyar-reviews).
══════════════════════════════════════════ */
const JD = (() => {
  const div = (a, b) => ~~(a / b), mod = (a, b) => a - ~~(a / b) * b;
  const BR = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function cal(jy) {
    let gy = jy + 621, leapJ = -14, jp = BR[0], jm, jump = 0, n, i;
    for (i = 1; i < BR.length; i++) { jm = BR[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
    n = jy - jp; leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
    return { gy, march: 20 + leapJ - leapG, leap };
  }
  const g2d = (gy, gm, gd) => { let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; };
  const d2g = jdn => { let j = 4 * jdn + 139361631; j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = div(mod(j, 1461), 4) * 5 + 308, gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1; return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd }; };
  const j2d = (jy, jm, jd) => { const r = cal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; };
  const d2j = jdn => { const g = d2g(jdn); let jy = g.gy - 621; const r = cal(jy); let k = jdn - g2d(g.gy, 3, r.march);
    if (k >= 0) { if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }; k -= 186; } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }; };
  const p2 = n => String(n).padStart(2, '0');
  const num = s => { const m = String(s || '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).match(/^\s*(1[34]\d\d)\D(\d{1,2})\D(\d{1,2})\s*$/);
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return null; const d = j2d(+m[1], +m[2], +m[3]), b = d2j(d); return b.jm === +m[2] && b.jd === +m[3] ? d : null; };
  const str = d => { const j = d2j(d); return `${j.jy}/${p2(j.jm)}/${p2(j.jd)}`; };
  const today = (tz = 'Asia/Baghdad') => { const o = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date()).forEach(p => o[p.type] = +p.value); return g2d(o.year, o.month, o.day); };
  return { num, str, today, g2d, d2g };
})();

(() => {
const S = { d: null, view: 'list', role: '', q: '', hist: false, el: null, opts: null, pick: null, map: null };
const NEAR = 5;
const nameOf = r => `${r.first} ${r.last}`;
const left = r => JD.num(r.d_end) - JD.num(S.d.today);
const daysTxt = n => n < 0 ? `${fa(-n)} روز گذشته` : n === 0 ? 'امروز' : n === 1 ? 'فردا' : `${fa(n)} روز`;
const lvl = r => r.status !== 'active' ? '' : left(r) < 0 ? 'over' : left(r) <= NEAR ? 'near' : '';
const normH = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏‎]/g, '').replace(/\s+/g, ' ').trim();
/* کلید مقایسه‌ی نام هتل (اکسل هفتگی ⇄ اپلیکیشن): «فندق/هتل»، نام شهر و «ال» اول کلمه حذف، ة→ه و … */
const H_STOP = new Set(['هتل', 'فندق', 'کربلا', 'کربلاء', 'المقدسه', 'نجف', 'الاشرف', 'کاظمین', 'الکاظمیه', 'بوفه', 'باز', 'السیاحی', 'سیاحی', 'hotel']);
const keyH = s => normH(s).replace(/[ةۀ]/g, 'ه').replace(/[أإآ]/g, 'ا').replace(/ء/g, '').replace(/[()\-_.]/g, ' ').split(' ').filter(w => w && !H_STOP.has(w)).map(w => w.length > 4 && w.startsWith('ال') ? w.slice(2) : w).join('');
const active = () => S.d.rows.filter(r => r.status === 'active');

window.loadStaff = async (el, opts) => {
  S.el = el; S.opts = opts || {}; injectCSS();
  try { S.d = await api('/api/admin/staff', { fresh: true }); } catch (e) { el.innerHTML = `<div class="card"><p class="err">${esc(e.message)}</p></div>`; return; }
  render();
};
async function reload() { try { S.d = await api('/api/admin/staff', { fresh: true, quiet: true }); } catch (e) { return toast(e.message, true); } render(); }

/* ═════ نمای کلی ═════ */
function render() {
  const el = S.el, A = active(), near = A.filter(r => lvl(r) === 'near'), over = A.filter(r => lvl(r) === 'over');
  el.innerHTML = `
    <div class="kpis st-kpis">
      <div class="kpi"><span class="v num">${fa(A.length)}</span><span class="k">نیروی فعال</span></div>
      ${S.d.roles.map(ro => `<div class="kpi"><span class="v num">${fa(A.filter(r => r.role === ro).length)}</span><span class="k">${esc(ro)}</span></div>`).join('')}
      <div class="kpi ${near.length ? 'st-k-near' : ''}"><span class="v num">${fa(near.length)}</span><span class="k">تا ${fa(NEAR)} روز دیگر باید خارج شوند</span></div>
      <div class="kpi ${over.length ? 'st-k-over' : ''}"><span class="v num">${fa(over.length)}</span><span class="k">تاریخ خروجشان گذشته</span></div>
    </div>
    <div class="card st-bar">
      <div class="row" style="justify-content:space-between">
        <div class="seg2 st-views" role="tablist">${[['list', '📋 فهرست'], ['board', '🏨 هتل‌به‌هتل'], ['map', '🗺️ نقشه']].map(([k, l]) => `<button role="tab" data-v="${k}" aria-pressed="${S.view === k}">${l}</button>`).join('')}</div>
        <div class="row">
          <button class="btn small" data-a="add">➕ نیروی تازه</button>
          <button class="btn small ghost" data-a="xls">📄 ورود از اکسل</button>
          <button class="btn small ghost" data-a="roles">⚙️ نقش‌ها</button>
          <button class="btn small ${S.d.bale ? 'ghost' : 'okb'}" data-a="bale">${S.d.bale ? '🔔 هشدار بله: وصل است' : '🔔 اتصال به بله برای هشدار'}</button>
        </div>
      </div>
      ${S.d.bale ? '' : '<p class="hint">با «اتصال به بله»، هر صبح کسانی که ۵ روز، ۱ روز یا امروز باید از عراق خارج شوند در بازوی بله‌ی همیار کاروان به شما خبر داده می‌شود.</p>'}
    </div>
    <div id="st-body"></div>`;
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { S.view = b.dataset.v; S.pick = null; render(); });
  el.querySelector('[data-a=add]').onclick = () => editDlg(null);
  el.querySelector('[data-a=xls]').onclick = importDlg;
  el.querySelector('[data-a=roles]').onclick = rolesDlg;
  el.querySelector('[data-a=bale]').onclick = baleDlg;
  ({ list: renderList, board: renderBoard, map: renderMap })[S.view]();
}

const roleChips = () => `<div class="row st-chips">${['', ...S.d.roles].map(r => `<button class="chip" aria-pressed="${S.role === r}" data-role="${esc(r)}">${r ? esc(r) : 'همه'}</button>`).join('')}
  <input type="search" class="st-q" placeholder="🔎 نام، کد ملی یا هتل…" value="${esc(S.q)}" aria-label="جستجو"></div>`;
function bindChips(box, again) {
  box.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { S.role = b.dataset.role; again(); });
  const q = box.querySelector('.st-q'); if (q) q.oninput = () => { S.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { again(); const n = S.el.querySelector('.st-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
}
const match = r => (!S.role || r.role === S.role) && (!S.q || normH([r.first, r.last, r.nid, r.hotel].join(' ')).includes(normH(S.q).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));

/* ═════ فهرست ═════ */
function renderList() {
  const box = document.getElementById('st-body');
  const rows = (S.hist ? S.d.rows : active()).filter(match).sort((a, b) => (a.status !== 'active') - (b.status !== 'active') || JD.num(a.d_end) - JD.num(b.d_end));
  box.innerHTML = `<div class="card">${roleChips()}
    <label class="row dim" style="font-size:12.5px;gap:6px"><input type="checkbox" id="st-hist" ${S.hist ? 'checked' : ''}> دوره‌های تمام‌شده و تمدیدشده را هم نشان بده</label>
    <div class="tbl-wrap"><table class="st-tbl"><thead><tr><th>نام</th><th>نقش</th><th>هتل (برای جابجایی بزنید)</th><th>شروع</th><th>خروج</th><th>مانده</th><th></th></tr></thead><tbody>
    ${rows.map(r => { const L = lvl(r), n = left(r);
      return `<tr class="st-r ${L}" data-id="${r.id}">
        <td><b>${esc(nameOf(r))}</b><div class="dim num" style="font-size:11.5px">${faS(r.nid)}</div></td>
        <td>${esc(r.role)}</td>
        <td>${r.status === 'active' ? `<button class="st-hbtn" data-mv="${r.id}">${r.hotel ? esc(r.hotel) : '<span class="dim">بدون هتل</span>'} <span aria-hidden="true">⇄</span></button>` : esc(r.hotel || '—')}</td>
        <td class="num">${faS(r.d_start)}</td><td class="num">${faS(r.d_end)}</td>
        <td>${r.status === 'active' ? `<span class="pill ${L === 'over' ? 'bad' : L === 'near' ? 'bad' : n <= 10 ? 'warn' : 'ok'}">${daysTxt(n)}</span>` : `<span class="pill mute">${r.status === 'left' ? 'خارج شد' + (r.left_at ? ' ' + faS(r.left_at.slice(5)) : '') : 'تمدید شد'}</span>`}</td>
        <td class="st-act">${r.status === 'active' ? `<button class="btn small ghost" data-ext="${r.id}" title="دوره‌ی تازه برای همین نفر">🔁 تمدید</button><button class="btn small ghost" data-leave="${r.id}">🚪 خارج شد</button>` : r.status === 'left' ? `<button class="btn small ghost" data-unleave="${r.id}">↩️</button>` : ''}
          <button class="btn small ghost" data-edit="${r.id}" title="ویرایش">✏️</button><button class="btn small ghost" data-hist="${r.id}" title="سابقه">🕘</button></td></tr>`; }).join('')
      || `<tr><td colspan="7" class="empty">${S.d.rows.length ? 'کسی با این جستجو پیدا نشد.' : 'هنوز نیرویی ثبت نشده است. از «➕ نیروی تازه» یا «📄 ورود از اکسل» شروع کنید.'}</td></tr>`}
    </tbody></table></div>
    <div class="legend"><span><i style="background:var(--bad)"></i>${fa(NEAR)} روز یا کمتر تا خروج، یا گذشته</span><span><i style="background:var(--warn)"></i>کمتر از ۱۰ روز</span></div></div>`;
  bindChips(box, renderList);
  box.querySelector('#st-hist').onchange = e => { S.hist = e.target.checked; renderList(); };
  bindRowActions(box);
}
function bindRowActions(box) {
  const byId = id => S.d.rows.find(r => r.id === +id);
  box.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => hotelPicker(b, h => move([+b.dataset.mv], h)));
  box.querySelectorAll('[data-ext]').forEach(b => b.onclick = () => extendDlg(byId(b.dataset.ext)));
  box.querySelectorAll('[data-leave]').forEach(b => b.onclick = () => leaveDlg(byId(b.dataset.leave)));
  box.querySelectorAll('[data-unleave]').forEach(b => b.onclick = async () => { try { await api('/api/admin/staff/leave', { body: { id: +b.dataset.unleave, undo: 1 } }); toast('دوباره فعال شد'); reload(); } catch (e) { toast(e.message, true); } });
  box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editDlg(byId(b.dataset.edit)));
  box.querySelectorAll('[data-hist]').forEach(b => b.onclick = () => histDlg(byId(b.dataset.hist)));
}

/* ═════ جابجایی ═════ */
function hotelList() {
  const cnt = new Map(); active().forEach(r => r.hotel && cnt.set(r.hotel, (cnt.get(r.hotel) || 0) + 1));
  return [...new Set([...S.d.hotels, ...cnt.keys()])].sort((a, b) => (cnt.get(b) || 0) - (cnt.get(a) || 0) || a.localeCompare(b, 'fa')).map(h => ({ h, n: cnt.get(h) || 0 }));
}
function hotelPicker(anchor, done, cur) {
  closePop();
  const pop = document.createElement('div'); pop.className = 'st-pop'; pop.id = 'st-pop';
  pop.innerHTML = `<input type="search" placeholder="🔎 نام هتل… (یا نام تازه بنویسید)" aria-label="جستجوی هتل"><div class="st-pl"></div>`;
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect(), w = Math.min(320, innerWidth - 24);
  pop.style.width = w + 'px'; pop.style.top = Math.min(innerHeight - 340, r.bottom + 4) + 'px'; pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + 'px';
  const inp = pop.querySelector('input'), pl = pop.querySelector('.st-pl');
  const paint = () => { const q = normH(inp.value), L = hotelList().filter(x => !q || normH(x.h).includes(q));
    pl.innerHTML = (q && !L.some(x => normH(x.h) === q) ? `<button data-h="${esc(inp.value.trim())}">➕ «${esc(inp.value.trim())}»</button>` : '') +
      L.map(x => `<button data-h="${esc(x.h)}" ${x.h === cur ? 'aria-current="true"' : ''}>${esc(x.h)}${x.n ? ` <span class="dim">(${fa(x.n)} نفر)</span>` : ''}</button>`).join('') +
      `<button data-h="" class="dim">بدون هتل</button>`;
    pl.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { closePop(); done(b.dataset.h); }); };
  inp.oninput = paint; paint(); setTimeout(() => inp.focus(), 30);
  setTimeout(() => document.addEventListener('pointerdown', popOut, true), 0);
}
function popOut(e) { const p = document.getElementById('st-pop'); if (p && !p.contains(e.target)) closePop(); }
function closePop() { const p = document.getElementById('st-pop'); if (p) p.remove(); document.removeEventListener('pointerdown', popOut, true); }
async function move(ids, hotel, silent) {
  try {
    const r = await api('/api/admin/staff/move', { body: { ids, hotel } });
    if (!r.moved.length) return;
    const who = r.moved.length === 1 ? nameOf(S.d.rows.find(x => x.id === r.moved[0].id)) : fa(r.moved.length) + ' نفر';
    await reload();
    if (!silent) snack(`${who} ← ${hotel || 'بدون هتل'}`, async () => { for (const m of r.moved) await api('/api/admin/staff/move', { body: { ids: [m.id], hotel: m.from } }); toast('برگردانده شد'); reload(); });
  } catch (e) { toast(e.message, true); }
}
let snackT;
function snack(msg, undo) {
  let el = document.getElementById('st-snack'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'st-snack'; el.className = 'st-snack'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>✅ ${esc(msg)}</span><button>برگرداندن</button>`; document.body.appendChild(el);
  el.querySelector('button').onclick = () => { el.remove(); undo(); };
  clearTimeout(snackT); snackT = setTimeout(() => el.remove(), 7000);
}

/* ═════ هتل‌به‌هتل (کشیدن و رها کردن روی کامپیوتر؛ روی گوشی: بزن و بزن) ═════ */
function renderBoard() {
  const box = document.getElementById('st-body'), A = active().filter(match), by = new Map();
  A.forEach(r => { const k = r.hotel || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
  const hs = [...new Set([...by.keys(), ...(S.role || S.q ? [] : S.d.hotels)])].sort((a, b) => (!a) - (!b) || (by.get(b) || []).length - (by.get(a) || []).length || a.localeCompare(b, 'fa'));
  box.innerHTML = `<div class="card">${roleChips()}
    <p class="hint">${S.pick ? `<b>«${esc(nameOf(S.pick))}»</b> را به کدام هتل ببریم؟ روی هتل مقصد بزنید. <button class="btn small ghost" id="st-unpick">انصراف</button>` : 'برای جابجایی، نام نیرو را روی هتل دیگر بکشید؛ یا روی نام بزنید و بعد روی هتل مقصد.'}</p>
    <div class="st-board">${hs.map(h => { const L = by.get(h) || [];
      return `<div class="st-col ${S.pick ? 'pickable' : ''}" data-drop="${esc(h)}"><div class="st-col-h"><b>${h ? esc(h) : 'بدون هتل'}</b><span class="dim">${fa(L.length)}</span></div>
        ${L.map(r => `<div class="st-chip ${lvl(r)} ${S.pick && S.pick.id === r.id ? 'sel' : ''}" draggable="true" data-sid="${r.id}" title="${esc(r.role)}؛ خروج ${faS(r.d_end)}">
          <span>${esc(nameOf(r))}</span><small>${esc(r.role)} · ${daysTxt(left(r))}</small></div>`).join('') || '<div class="dim st-none">—</div>'}</div>`; }).join('')}</div></div>`;
  bindChips(box, renderBoard);
  const un = box.querySelector('#st-unpick'); if (un) un.onclick = () => { S.pick = null; renderBoard(); };
  box.querySelectorAll('[data-sid]').forEach(c => {
    c.ondragstart = e => { e.dataTransfer.setData('text/plain', c.dataset.sid); e.dataTransfer.effectAllowed = 'move'; c.classList.add('drag'); };
    c.ondragend = () => c.classList.remove('drag');
    c.onclick = e => { e.stopPropagation(); const r = S.d.rows.find(x => x.id === +c.dataset.sid); S.pick = S.pick && S.pick.id === r.id ? null : r; renderBoard(); };
  });
  box.querySelectorAll('[data-drop]').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('over'); };
    col.ondragleave = () => col.classList.remove('over');
    col.ondrop = e => { e.preventDefault(); col.classList.remove('over'); const id = +e.dataTransfer.getData('text/plain'); if (id) move([id], col.dataset.drop); };
    col.onclick = () => { if (!S.pick) return; const id = S.pick.id; S.pick = null; move([id], col.dataset.drop); };
  });
}

/* ═════ نقشه ═════ */
const LEAF = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
function loadLeaflet() {
  if (window.L && L.map) return Promise.resolve();
  return new Promise((ok, no) => {
    const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = LEAF + 'leaflet.min.css'; document.head.appendChild(c);
    const s = document.createElement('script'); s.src = LEAF + 'leaflet.min.js'; s.onload = ok; s.onerror = () => no(new Error('نقشه بار نشد (اینترنت؟)')); document.head.appendChild(s);
  });
}
let APPH = null;
/* مختصات هتل‌های شهر از داده‌های خود اپلیکیشن (data.js)؛ مدیر منطقه می‌تواند هر هتل را خودش جابجا یا جانمایی کند */
async function appHotels() {
  if (APPH) return APPH;
  if (typeof CARAVAN_DATA === 'undefined') await new Promise(ok => { const s = document.createElement('script'); s.src = 'data.js'; s.onload = ok; s.onerror = ok; document.head.appendChild(s); });
  const D = typeof CARAVAN_DATA !== 'undefined' ? CARAVAN_DATA : null, out = [];
  const reg = normH(S.d.region).replace(/\s/g, '');
  for (const c of (D && D.cities) || []) {
    const cn = normH(c.name).replace(/\s/g, '');
    if (!c.hotels || !cn || !(cn.includes(reg.slice(0, 4)) || reg.includes(cn.slice(0, 4)))) continue;
    for (const h of c.hotels) {
      const u = (h.mapGoogleUrl || '') + ' ' + (h.mapNeshanUrl || '');
      const m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || u.match(/query=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (m) out.push({ name: h.name, k: keyH(h.name), lat: +m[1], lng: +m[2] });
    }
  }
  return APPH = out;
}
function geoOf(h, app) {
  const g = S.d.geo.find(x => x.hotel === h); if (g) return { lat: g.lat, lng: g.lng, own: true };
  const k = keyH(h); if (!k) return null;
  const a = app.find(x => x.k === k) || app.find(x => x.k.length > 3 && (x.k.includes(k) || k.includes(x.k)));
  return a ? { lat: a.lat, lng: a.lng } : null;
}
async function renderMap() {
  const box = document.getElementById('st-body');
  box.innerHTML = `<div class="card"><div class="empty"><span class="spin"></span>در حال آماده کردن نقشه…</div></div>`;
  let app; try { await loadLeaflet(); app = await appHotels(); } catch (e) { box.innerHTML = `<div class="card"><p class="err">${esc(e.message)}</p></div>`; return; }
  if (S.view !== 'map') return;
  const A = active(), by = new Map(); A.forEach(r => { const k = r.hotel || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
  const hs = [...new Set([...S.d.hotels, ...by.keys()])].filter(Boolean);
  const placed = hs.map(h => ({ h, g: geoOf(h, app), L: by.get(h) || [] })), noGeo = placed.filter(x => !x.g);
  box.innerHTML = `<div class="card st-mapcard">
    <div class="st-mbar" id="st-mbar"></div>
    <div class="st-mapwrap"><div id="st-map"></div>
      <aside class="st-side"><b>نیروها</b><p class="hint">روی کامپیوتر: نام را روی هتل بکشید. روی گوشی: روی هتل بزنید.</p>
        ${A.filter(match).sort((a, b) => (a.hotel || '').localeCompare(b.hotel || '', 'fa')).map(r => `<div class="st-chip ${lvl(r)}" draggable="true" data-sid="${r.id}"><span>${esc(nameOf(r))}</span><small>${esc(r.hotel || 'بدون هتل')}</small></div>`).join('') || '<div class="dim">—</div>'}
        ${noGeo.length ? `<b style="margin-top:10px">هتل‌های بدون موقعیت</b><p class="hint">یک بار روی «📍» بزنید و بعد روی محل هتل در نقشه.</p>${noGeo.map(x => `<button class="st-nogeo" data-pin="${esc(x.h)}">📍 ${esc(x.h)} <span class="dim">(${fa(x.L.length)})</span></button>`).join('')}` : ''}
      </aside></div></div>`;
  const map = L.map('st-map', { zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const pts = placed.filter(x => x.g);
  if (pts.length) map.fitBounds(L.latLngBounds(pts.map(x => [x.g.lat, x.g.lng])).pad(0.15)); else map.setView([32.616, 44.033], 15);
  const mbar = document.getElementById('st-mbar');
  const setBar = html => { mbar.innerHTML = html || ''; mbar.hidden = !html; const c = mbar.querySelector('[data-cancel]'); if (c) c.onclick = () => { S.pick = null; pinFor = null; setBar(''); }; };
  setBar('');
  let pinFor = null;
  for (const x of pts) {
    const near = x.L.some(r => lvl(r)), ic = L.divIcon({ className: '', html: `<div class="st-pin ${near ? 'hot' : ''} ${x.L.length ? '' : 'empty'}" data-drop="${esc(x.h)}"><b>${fa(x.L.length)}</b><span>${esc(x.h)}</span></div>`, iconSize: null, iconAnchor: [0, 0] });
    const mk = L.marker([x.g.lat, x.g.lng], { icon: ic }).addTo(map);
    mk.on('click', () => {
      if (S.pick) { const id = S.pick.id; S.pick = null; setBar(''); return move([id], x.h); }
      const html = `<div class="st-popup"><b>🏨 ${esc(x.h)}</b>${x.L.map(r => `<div class="st-pr ${lvl(r)}"><span>${esc(nameOf(r))}<small>${esc(r.role)} · ${daysTxt(left(r))}</small></span><button data-mvp="${r.id}">⇄ جابجایی</button></div>`).join('') || '<div class="dim">نیرویی ندارد.</div>'}
        <button class="st-relo" data-relo="${esc(x.h)}">📍 موقعیت این هتل درست نیست</button></div>`;
      L.popup({ maxWidth: 280 }).setLatLng([x.g.lat, x.g.lng]).setContent(html).openOn(map);
      setTimeout(() => {
        document.querySelectorAll('[data-mvp]').forEach(b => b.onclick = () => { S.pick = S.d.rows.find(r => r.id === +b.dataset.mvp); map.closePopup(); setBar(`<b>«${esc(nameOf(S.pick))}»</b> را به کدام هتل ببریم؟ روی هتل مقصد در نقشه بزنید. <button class="btn small ghost" data-cancel>انصراف</button>`); });
        const rl = document.querySelector('[data-relo]'); if (rl) rl.onclick = () => { pinFor = rl.dataset.relo; map.closePopup(); setBar(`محل درست «${esc(pinFor)}» را روی نقشه بزنید. <button class="btn small ghost" data-cancel>انصراف</button>`); };
      }, 0);
    });
  }
  map.on('click', async e => {
    if (!pinFor) return;
    const h = pinFor; pinFor = null; setBar('');
    try { await api('/api/admin/hotel-geo', { body: { hotel: h, lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) } }); toast(`موقعیت «${h}» ثبت شد`); await reload(); } catch (er) { toast(er.message, true); }
  });
  box.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => { pinFor = b.dataset.pin; setBar(`محل «${esc(pinFor)}» را روی نقشه بزنید. <button class="btn small ghost" data-cancel>انصراف</button>`); document.getElementById('st-map').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  /* کشیدن نام از فهرست کنار نقشه روی مارکر هتل */
  box.querySelectorAll('.st-side [data-sid]').forEach(c => {
    c.ondragstart = e => { e.dataTransfer.setData('text/plain', c.dataset.sid); c.classList.add('drag'); };
    c.ondragend = () => c.classList.remove('drag');
    c.onclick = () => { S.pick = S.d.rows.find(r => r.id === +c.dataset.sid); setBar(`<b>«${esc(nameOf(S.pick))}»</b> را به کدام هتل ببریم؟ روی هتل مقصد در نقشه بزنید. <button class="btn small ghost" data-cancel>انصراف</button>`); };
  });
  const mapEl = document.getElementById('st-map');
  mapEl.addEventListener('dragover', e => { const p = e.target.closest && e.target.closest('[data-drop]'); if (p) { e.preventDefault(); p.classList.add('over'); } });
  mapEl.addEventListener('dragleave', e => { const p = e.target.closest && e.target.closest('[data-drop]'); if (p) p.classList.remove('over'); });
  mapEl.addEventListener('drop', e => { const p = e.target.closest && e.target.closest('[data-drop]'); if (!p) return; e.preventDefault(); p.classList.remove('over'); const id = +e.dataTransfer.getData('text/plain'); if (id) move([id], p.dataset.drop); });
  S.map = map; setTimeout(() => map.invalidateSize(), 50);
}

/* ═════ پنجره‌ها ═════ */
function dlg(title, html, wide) {
  const ov = document.createElement('div'); ov.className = 'rr-ov';
  ov.innerHTML = `<div class="rr-box ${wide ? 'st-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="rr-h"><b>${esc(title)}</b><button type="button" class="rr-x" aria-label="بستن">✕</button></div>${html}</div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', k); };
  const k = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', k);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('.rr-x').onclick = close;
  return { ov, close, $: s => ov.querySelector(s) };
}
const plus = (d, n) => JD.str(JD.num(d) + n);
const dateHint = (a, b) => { const x = JD.num(a), y = JD.num(b); if (x == null || y == null) return ''; const n = y - x + 1; return n > S.d.maxDays ? `<span class="err">⚠️ ${fa(n)} روز؛ بیشتر از ${fa(S.d.maxDays)} روز مجاز اقامت در عراق</span>` : `<span class="dim">${fa(n)} روز</span>`; };

function editDlg(r) {
  const e = r || { first: '', last: '', nid: '', role: S.d.roles[0], hotel: '', d_start: S.d.today, d_end: plus(S.d.today, S.d.maxDays - 1), note: '' };
  const sug = !r ? S.d.suggest.filter(x => !S.d.rows.some(y => normH(nameOf(y)) === normH(x.name))).slice(0, 30) : [];
  const D = dlg(r ? 'ویرایش ' + nameOf(r) : '➕ نیروی تازه', `
    ${sug.length ? `<details class="st-sug"><summary>💡 نام‌هایی که در اکسل هفتگی آمده (${fa(sug.length)})</summary><div class="row">${sug.map((x, i) => `<button type="button" class="chip" data-sg="${i}">${esc(x.name)} <small class="dim">${esc(x.role)}</small></button>`).join('')}</div></details>` : ''}
    <div class="st-form">
      <label>نام<input data-f="first" value="${esc(e.first)}" autocomplete="off"></label>
      <label>نام خانوادگی<input data-f="last" value="${esc(e.last)}" autocomplete="off"></label>
      <label>کد ملی<input data-f="nid" value="${esc(e.nid)}" inputmode="numeric" dir="ltr" maxlength="12"></label>
      <label>نقش<select data-f="role">${S.d.roles.map(x => `<option ${x === e.role ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <label class="st-full">هتل<button type="button" class="st-hbtn st-hsel" data-f="hotel" data-v="${esc(e.hotel || '')}">${e.hotel ? esc(e.hotel) : '<span class="dim">انتخاب هتل…</span>'}</button></label>
      <label>تاریخ شروع<input data-f="d_start" value="${esc(faS(e.d_start))}" dir="ltr" placeholder="۱۴۰۵/۰۸/۱۷"></label>
      <label>تاریخ خروج<input data-f="d_end" value="${esc(faS(e.d_end))}" dir="ltr"></label>
      <div class="st-full st-dh"></div>
      <label class="st-full">توضیح (اختیاری)<input data-f="note" value="${esc(e.note || '')}"></label>
    </div>
    <p class="hint">تاریخ خروج خودکار ${fa(S.d.maxDays)} روز بعد از شروع پیشنهاد می‌شود (حداکثر اقامت اتباع خارجی در عراق).</p>
    <div class="rr-act"><button class="btn" data-a="save">💾 ذخیره</button>${r ? '<button class="btn danger" data-a="del">حذف (ثبت اشتباه)</button>' : ''}<button class="btn ghost" data-a="x">انصراف</button></div>`);
  const f = k => D.$(`[data-f=${k}]`);
  let endTouched = !!r;
  const dh = () => D.$('.st-dh').innerHTML = dateHint(f('d_start').value, f('d_end').value);
  f('d_start').oninput = () => { const s = JD.num(f('d_start').value); if (s != null && !endTouched) f('d_end').value = faS(JD.str(s + S.d.maxDays - 1)); dh(); };
  f('d_end').oninput = () => { endTouched = true; dh(); }; dh();
  f('hotel').onclick = () => hotelPicker(f('hotel'), h => { f('hotel').dataset.v = h; f('hotel').innerHTML = h ? esc(h) : '<span class="dim">انتخاب هتل…</span>'; }, f('hotel').dataset.v);
  D.ov.querySelectorAll('[data-sg]').forEach(b => b.onclick = () => { const x = sug[+b.dataset.sg], p = x.name.split(' '); f('first').value = p[0]; f('last').value = p.slice(1).join(' '); f('role').value = x.role; f('hotel').dataset.v = x.hotel; f('hotel').textContent = x.hotel; f('nid').focus(); });
  D.$('[data-a=x]').onclick = D.close;
  D.$('[data-a=save]').onclick = async () => {
    const b = { id: r ? r.id : 0, first: f('first').value, last: f('last').value, nid: f('nid').value, role: f('role').value, hotel: f('hotel').dataset.v, d_start: f('d_start').value, d_end: f('d_end').value, note: f('note').value };
    try { await api('/api/admin/staff', { body: b }); toast('ذخیره شد ✅'); D.close(); reload(); } catch (er) { toast(er.message, true); }
  };
  const del = D.$('[data-a=del]');
  if (del) del.onclick = async () => { if (!confirm(`«${nameOf(r)}» کامل حذف شود؟ این فقط برای ثبت اشتباه است؛ برای کسی که رفته «خارج شد» را بزنید.`)) return;
    try { await api('/api/admin/staff/del', { body: { id: r.id } }); toast('حذف شد'); D.close(); reload(); } catch (er) { toast(er.message, true); } };
  if (!r) setTimeout(() => f('first').focus(), 30);
}

function extendDlg(r) {
  const s0 = plus(r.d_end, 1) < S.d.today ? S.d.today : plus(r.d_end, 1);
  const D = dlg('🔁 تمدید ' + nameOf(r), `
    <p class="hint">دوره‌ی فعلی (${faS(r.d_start)} تا ${faS(r.d_end)}) در سابقه می‌ماند و یک دوره‌ی تازه با همان نقش و هتل ساخته می‌شود.</p>
    <div class="st-form"><label>شروع دوره‌ی تازه<input data-f="s" value="${faS(s0)}" dir="ltr"></label><label>خروج<input data-f="e" value="${faS(plus(s0, S.d.maxDays - 1))}" dir="ltr"></label><div class="st-full st-dh"></div></div>
    <div class="rr-act"><button class="btn" data-a="ok">🔁 تمدید</button><button class="btn ghost" data-a="x">انصراف</button></div>`);
  const s = D.$('[data-f=s]'), e = D.$('[data-f=e]'); let t = false;
  const dh = () => D.$('.st-dh').innerHTML = dateHint(s.value, e.value);
  s.oninput = () => { const d = JD.num(s.value); if (d != null && !t) e.value = faS(JD.str(d + S.d.maxDays - 1)); dh(); }; e.oninput = () => { t = true; dh(); }; dh();
  D.$('[data-a=x]').onclick = D.close;
  D.$('[data-a=ok]').onclick = async () => { try { await api('/api/admin/staff/extend', { body: { id: r.id, d_start: s.value, d_end: e.value } }); toast('تمدید شد ✅'); D.close(); reload(); } catch (er) { toast(er.message, true); } };
}
function leaveDlg(r) {
  const D = dlg('🚪 خروج ' + nameOf(r), `<p class="hint">دوره بسته می‌شود ولی اطلاعات و سابقه‌اش می‌ماند و دیگر هشداری برایش نمی‌آید.</p>
    <div class="st-form"><label>تاریخ خروج واقعی<input data-f="d" value="${faS(S.d.today)}" dir="ltr"></label></div>
    <div class="rr-act"><button class="btn" data-a="ok">ثبت خروج</button><button class="btn ghost" data-a="x">انصراف</button></div>`);
  D.$('[data-a=x]').onclick = D.close;
  D.$('[data-a=ok]').onclick = async () => { try { await api('/api/admin/staff/leave', { body: { id: r.id, date: D.$('[data-f=d]').value } }); toast('خروج ثبت شد'); D.close(); reload(); } catch (er) { toast(er.message, true); } };
}
function histDlg(r) {
  const P = S.d.rows.filter(x => x.nid === r.nid).sort((a, b) => JD.num(b.d_start) - JD.num(a.d_start));
  const ST = { active: ['فعال', 'ok'], extended: ['تمدید شد', 'info'], left: ['خارج شد', 'mute'] };
  dlg('🕘 سابقه‌ی ' + nameOf(r), `<div class="dim num" style="font-size:12px">کد ملی ${faS(r.nid)} · ${esc(r.role)}</div>
    ${P.map(p => { const mv = S.d.moves.filter(m => m.staff_id === p.id).reverse();
      return `<div class="st-per"><div class="row" style="justify-content:space-between"><b class="num">${faS(p.d_start)} تا ${faS(p.d_end)}</b><span class="pill ${ST[p.status][1]}">${ST[p.status][0]}${p.left_at ? ' ' + faS(p.left_at) : ''}</span></div>
        <div class="dim" style="font-size:12.5px">هتل: ${esc(p.hotel || '—')}${p.note ? ' · ' + esc(p.note) : ''}</div>
        ${mv.length ? `<ul class="st-mv">${mv.map(m => `<li><span class="num">${fmtTs(m.ts)}</span> ${esc(m.from_hotel || 'بدون هتل')} ← <b>${esc(m.to_hotel || 'بدون هتل')}</b>${m.by ? ` <span class="dim">(${esc(m.by)})</span>` : ''}</li>`).join('')}</ul>` : ''}</div>`; }).join('')}`, true);
}
function rolesDlg() {
  let roles = [...S.d.roles];
  const D = dlg('⚙️ نقش‌های عوامل', `<p class="hint">نقش‌ها را می‌توانید اضافه یا حذف کنید (مثلاً «کمک‌آشپز» یا «خدمه»). نقشی که نیروی فعال دارد حذف نمی‌شود.</p>
    <div class="st-roles"></div><div class="row"><input class="st-newrole" placeholder="نقش تازه…"><button class="btn small ghost" data-a="add">➕ افزودن</button></div>
    <div class="rr-act"><button class="btn" data-a="save">💾 ذخیره</button><button class="btn ghost" data-a="x">انصراف</button></div>`);
  const paint = () => { D.$('.st-roles').innerHTML = roles.map((r, i) => `<span class="chip">${esc(r)} <button type="button" data-rm="${i}" aria-label="حذف ${esc(r)}" style="border:0;background:none;color:var(--bad)">✕</button></span>`).join(' ');
    D.ov.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { roles.splice(+b.dataset.rm, 1); paint(); }); };
  paint();
  const add = () => { const v = D.$('.st-newrole').value.trim(); if (v && !roles.includes(v)) roles.push(v); D.$('.st-newrole').value = ''; paint(); };
  D.$('[data-a=add]').onclick = add; D.$('.st-newrole').onkeydown = e => { if (e.key === 'Enter') add(); };
  D.$('[data-a=x]').onclick = D.close;
  D.$('[data-a=save]').onclick = async () => { try { await api('/api/admin/staff/roles', { body: { roles } }); toast('ذخیره شد ✅'); D.close(); reload(); } catch (er) { toast(er.message, true); } };
}
async function baleDlg() {
  if (S.d.bale) {
    const D = dlg('🔔 هشدار بله', `<p>هشدارهای تاریخ خروج هر صبح ساعت ۸ (به وقت عراق) در بازوی بله‌ی همیار کاروان برای شما فرستاده می‌شود.</p>
      <div class="rr-act"><button class="btn danger" data-a="off">قطع اتصال</button><button class="btn ghost" data-a="x">بستن</button></div>`);
    D.$('[data-a=x]').onclick = D.close;
    D.$('[data-a=off]').onclick = async () => { try { await api('/api/admin/bale/off', { body: {} }); D.close(); reload(); } catch (e) { toast(e.message, true); } };
    return;
  }
  let r; try { r = await api('/api/admin/bale/link', { body: {} }); } catch (e) { return toast(e.message, true); }
  const D = dlg('🔔 اتصال به بله', `<ol class="st-steps"><li>دکمه‌ی زیر را بزنید تا بازوی بله‌ی <b dir="ltr">@HamyarKaravan_Bot</b> باز شود.</li><li>در بله «شروع» را بزنید.</li><li>پیام «اتصال برقرار شد» می‌آید؛ به این صفحه برگردید.</li></ol>
    <a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">باز کردن بله</a>
    <p class="hint">لینک تا ۱۵ دقیقه معتبر است. شماره‌ی تلفن لازم نیست.</p>`);
  const t = setInterval(async () => {
    if (!document.body.contains(D.ov)) return clearInterval(t);
    try { const s = await api('/api/admin/bale', { fresh: true, quiet: true }); if (s.linked) { clearInterval(t); D.close(); toast('✅ به بله وصل شد'); reload(); } } catch (e) {}
  }, 4000);
}

/* ═════ اکسل ═════ */
const XCOLS = ['نام', 'نام خانوادگی', 'کد ملی', 'نقش', 'هتل', 'تاریخ شروع', 'تاریخ خروج', 'توضیح'];
function xDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) return JD.str(JD.g2d(1899, 12, 30) + Math.floor(v));   /* تاریخ میلادی خود اکسل */
  if (v instanceof Date) return JD.str(JD.g2d(v.getFullYear(), v.getMonth() + 1, v.getDate()));
  const d = JD.num(v); return d == null ? String(v) : JD.str(d);
}
function importDlg() {
  const D = dlg('📄 ورود عوامل از اکسل', `<p class="hint">ستون‌ها (ردیف اول عنوان): <b>${XCOLS.join('، ')}</b>. تاریخ‌ها شمسی مثل ۱۴۰۵/۰۸/۱۷. اگر «تاریخ خروج» خالی باشد ${fa(S.d.maxDays)} روز بعد از شروع گذاشته می‌شود. کسی که با همان کد ملی دوره‌ی فعال دارد، به‌روز می‌شود.</p>
    <div class="row"><button class="btn small ghost" data-a="tpl">⬇️ دریافت فایل نمونه</button><label class="btn small"><input type="file" accept=".xlsx,.xls,.csv" hidden data-a="file">📂 انتخاب فایل اکسل</label></div>
    <div class="st-imp"></div>`, true);
  D.$('[data-a=tpl]').onclick = async () => {
    const X = await loadXlsx(), ws = X.utils.aoa_to_sheet([XCOLS, ['علی', 'رضایی', '0012345679', S.d.roles[0], S.d.hotels[0] || 'نام هتل', S.d.today, plus(S.d.today, S.d.maxDays - 1), '']]);
    ws['!cols'] = XCOLS.map(() => ({ wch: 16 })); const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; X.utils.book_append_sheet(wb, ws, 'عوامل'); X.writeFile(wb, 'نمونه-عوامل.xlsx');
  };
  let rows = [];
  D.$('[data-a=file]').onchange = async ev => {
    const file = ev.target.files[0]; if (!file) return;
    try {
      const X = await loadXlsx(), wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true }), a = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
      const n = s => normH(s).replace(/\s/g, ''), hi = a.findIndex(r => r.some(c => n(c) === 'کدملی')); if (hi < 0) throw new Error('ستون «کد ملی» پیدا نشد. ردیف اول باید عنوان ستون‌ها باشد.');
      const H = a[hi].map(n), col = k => H.indexOf(n(k));
      const ci = { first: col('نام'), last: col('نام خانوادگی'), nid: col('کد ملی'), role: col('نقش'), hotel: col('هتل'), d_start: col('تاریخ شروع'), d_end: col('تاریخ خروج'), note: col('توضیح') };
      if (ci.first < 0 || ci.last < 0) throw new Error('ستون‌های «نام» و «نام خانوادگی» لازم است.');
      rows = a.slice(hi + 1).filter(r => r.some(c => String(c).trim())).map(r => { const g = k => ci[k] >= 0 ? r[ci[k]] : '';
        const ds = xDate(g('d_start')), de0 = xDate(g('d_end')), de = de0 || (JD.num(ds) != null ? JD.str(JD.num(ds) + S.d.maxDays - 1) : '');
        return { first: String(g('first')).trim(), last: String(g('last')).trim(), nid: String(g('nid')).trim(), role: String(g('role')).trim() || (S.d.roles.length === 1 ? S.d.roles[0] : ''), hotel: String(g('hotel')).trim(), d_start: ds, d_end: de, note: String(g('note')).trim() }; });
      D.$('.st-imp').innerHTML = `<p><b>${fa(rows.length)}</b> ردیف پیدا شد.</p><div class="tbl-wrap" style="max-height:260px"><table><thead><tr><th>نام</th><th>کد ملی</th><th>نقش</th><th>هتل</th><th>شروع</th><th>خروج</th></tr></thead><tbody>
        ${rows.slice(0, 80).map(r => `<tr><td>${esc(r.first + ' ' + r.last)}</td><td class="num">${faS(r.nid)}</td><td>${esc(r.role)}</td><td>${esc(r.hotel)}</td><td class="num">${faS(r.d_start)}</td><td class="num">${faS(r.d_end)}</td></tr>`).join('')}</tbody></table></div>
        <div class="st-errs"></div><div class="rr-act"><button class="btn" data-a="go">✅ ثبت ${fa(rows.length)} نفر</button></div>`;
      D.$('[data-a=go]').onclick = () => send(false);
    } catch (e) { D.$('.st-imp').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    ev.target.value = '';
  };
  async function send(skipBad) {
    try {
      const r = await api('/api/admin/staff/import', { body: { rows, skipBad } });
      if (!r.ok) {
        D.$('.st-errs').innerHTML = `<div class="err">${fa(r.nErr)} ردیف ایراد دارد:</div><ul class="err" style="font-size:12px">${r.errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          ${r.nOk ? `<button class="btn small ghost" data-a="skip">فقط ${fa(r.nOk)} ردیف درست را ثبت کن</button>` : ''}`;
        const sk = D.$('[data-a=skip]'); if (sk) sk.onclick = () => send(true); return;
      }
      toast(`✅ ${fa(r.added)} نفر اضافه و ${fa(r.updated)} نفر به‌روز شد`); D.close(); reload();
    } catch (e) { toast(e.message, true); }
  }
}

function injectCSS() {
  if (document.getElementById('st-css')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="st-css">
  .st-kpis{grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px} .st-kpis .kpi{padding:8px 12px} .st-kpis .v{font-size:22px} .st-kpis .k{font-size:12px}
  .st-kpis .st-k-near{border-color:var(--bad);background:var(--bad-soft)} .st-kpis .st-k-over{border-color:var(--bad);background:var(--bad);color:#fff} .st-k-over .k{color:#fff}
  .st-views button{min-height:36px}
  .st-chips{margin-bottom:4px} .st-q{flex:1;min-width:160px;border:1px solid var(--line-s);background:var(--card2);border-radius:9px;padding:6px 10px}
  .st-tbl td{vertical-align:middle}
  .st-r.near td{background:var(--bad-soft)} .st-r.near td:first-child{box-shadow:inset -4px 0 0 var(--bad)}
  .st-r.over td{background:var(--bad);color:#fff} .st-r.over .dim,.st-r.over .pill{color:#fff} .st-r.over .pill{background:rgba(0,0,0,.25)}
  .st-r.over .st-hbtn,.st-r.over .btn.ghost{background:rgba(255,255,255,.18);color:#fff;border-color:rgba(255,255,255,.5)}
  .st-hbtn{border:1px dashed var(--line-s);background:var(--card2);border-radius:9px;padding:4px 10px;text-align:start;max-width:220px}
  .st-hbtn:hover{border-color:var(--pri);border-style:solid}
  .st-act{white-space:nowrap} .st-act .btn{margin:1px}
  .st-pop{position:fixed;z-index:1200;background:var(--card);border:1px solid var(--line-s);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:8px;display:flex;flex-direction:column;gap:6px}
  .st-pop input{border:1px solid var(--line-s);border-radius:9px;padding:8px;background:var(--card2)}
  .st-pl{max-height:260px;overflow:auto;display:flex;flex-direction:column}
  .st-pl button{border:0;background:none;text-align:start;padding:8px 10px;border-radius:8px;min-height:40px} .st-pl button:hover,.st-pl button[aria-current]{background:var(--pri-soft)}
  .st-snack{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:1300;background:var(--ink);color:var(--bg);border-radius:12px;padding:10px 14px;display:flex;gap:14px;align-items:center;box-shadow:var(--shadow);max-width:calc(100vw - 24px)}
  .st-snack button{border:0;background:none;color:var(--brass-l);font-weight:800}
  .st-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
  .st-col{border:1px solid var(--line);border-radius:12px;padding:8px;background:var(--card2);display:flex;flex-direction:column;gap:6px;min-height:80px}
  .st-col.over,.st-col.pickable:hover{border-color:var(--pri);background:var(--pri-soft)} .st-col.pickable{cursor:pointer;border-style:dashed}
  .st-col-h{display:flex;justify-content:space-between;gap:6px;font-size:13px}
  .st-chip{background:var(--card);border:1px solid var(--line-s);border-radius:9px;padding:5px 8px;cursor:grab;display:flex;flex-direction:column;font-size:13px;user-select:none}
  .st-chip small{color:var(--dim);font-size:11px} .st-chip.near{border-color:var(--bad);background:var(--bad-soft)} .st-chip.over{background:var(--bad);color:#fff;border-color:var(--bad)} .st-chip.over small{color:#fff}
  .st-chip.sel{outline:3px solid var(--pri)} .st-chip.drag{opacity:.4} .st-none{font-size:12px}
  .st-mapcard{padding:10px} .st-mbar{background:var(--warn-soft);border-radius:10px;padding:8px 12px;font-size:13px}
  .st-mapwrap{display:grid;grid-template-columns:1fr 240px;gap:10px} #st-map{height:min(70vh,620px);border-radius:12px;z-index:0}
  .st-side{max-height:min(70vh,620px);overflow:auto;display:flex;flex-direction:column;gap:5px}
  @media(max-width:760px){.st-mapwrap{grid-template-columns:1fr}#st-map{height:62vh}.st-side{max-height:none}}
  .st-pin{transform:translate(-50%,-100%);display:flex;align-items:center;gap:4px;background:var(--pri);color:#fff;border-radius:14px 14px 14px 2px;padding:3px 8px 3px 4px;white-space:nowrap;font:600 11.5px var(--font);box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer}
  .st-pin b{background:#fff;color:var(--pri);border-radius:50%;min-width:20px;height:20px;display:grid;place-items:center;font-size:11px}
  .st-pin span{max-width:110px;overflow:hidden;text-overflow:ellipsis} .st-pin.hot{background:var(--bad)} .st-pin.hot b{color:var(--bad)} .st-pin.empty{background:#7a7a7a}
  .st-pin.over{outline:3px solid var(--brass-l);transform:translate(-50%,-100%) scale(1.15)}
  .st-popup{font-family:var(--font);direction:rtl;display:flex;flex-direction:column;gap:6px;min-width:200px}
  .st-pr{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px solid #eee;padding-top:5px}
  .st-pr span{display:flex;flex-direction:column} .st-pr small{color:#777} .st-pr.near span,.st-pr.over span{color:#B3261E}
  .st-pr button,.st-relo{border:1px solid #ccc;background:#f6f6f6;border-radius:8px;padding:3px 8px;font:inherit;font-size:12px;cursor:pointer}
  .st-relo{margin-top:4px;color:#666}
  .st-nogeo{border:1px dashed var(--line-s);background:var(--card2);border-radius:9px;padding:6px 8px;text-align:start}
  .st-wide{max-width:760px!important}
  .st-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .st-form label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:var(--dim)}
  .st-form input,.st-form select{border:1px solid var(--line-s);background:var(--card2);border-radius:9px;padding:8px;font-weight:500;color:var(--ink)}
  .st-form .st-hsel{max-width:none;min-height:38px;color:var(--ink);font-weight:500} .st-full{grid-column:1/-1}
  @media(max-width:520px){.st-form{grid-template-columns:1fr}}
  .st-sug summary{cursor:pointer;font-size:13px;font-weight:700} .st-sug .row{margin-top:6px}
  .st-per{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-top:8px}
  .st-mv{margin:6px 0 0;padding-right:18px;font-size:12.5px}
  .st-roles{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0} .st-newrole{flex:1;border:1px solid var(--line-s);border-radius:9px;padding:6px 10px;background:var(--card2)}
  .st-steps{margin:0;padding-right:18px;line-height:2}
  </style>`);
}
})();
