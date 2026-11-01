'use strict';
(() => {
/* مدیر ثابت: ورودی‌های هفته ← برای هر ورودی یک گزارش */
let app;
const S = { me: null, weeks: [], week: 0, entries: [], hotel: '', bulkSure: false, E: null };

window.startFM = me => { app = document.getElementById('app'); S.me = me; S.hotel = ''; loadHome(); };

/* ═════════ home: weeks → hotels → entries ═════════ */
async function loadHome(week) {
  try { const r = await api('/api/fm/home' + (week ? '?week=' + week : '')); Object.assign(S, { weeks: r.weeks, week: r.week, entries: r.entries }); }
  catch (e) { return toast(e.message, true); }
  renderHome();
}
function statusOf(e) {
  if (!e.rid) return { l: 'گزارش نشده', c: 'mute' };
  if (!e.defects) return { l: 'بدون نقص', c: 'ok' };
  return e.open ? { l: `${fa(e.defects)} نقص · ${fa(e.open)} باز`, c: 'bad' } : { l: `${fa(e.defects)} نقص · رفع شد`, c: 'warn' };
}
async function renderHome() {
  S.E = null;
  const list = S.entries, hotels = [...new Set(list.map(e => e.hotel))], shown = list.filter(e => !S.hotel || e.hotel === S.hotel);
  const pending = list.filter(e => !e.rid), week = S.weeks.find(w => w.id === S.week);
  let bioHint = false; try { bioHint = !S.me.passkeys.length && localStorage.getItem('hr-bio-hint') !== 'no' && await bioAvailable(); } catch (e) {}
  app.innerHTML = `<header class="app-head"><div class="in"><a class="hbtn" href="./" style="text-decoration:none">→ برنامه</a><div class="t"><div class="hi">${esc(S.me.region)} · مدیر ثابت</div><h1>${esc(S.me.name)}</h1></div><button class="hbtn" id="acc">⚙️ حساب</button></div></header>
  <main class="page">
    ${bioHint ? `<div class="bulk" style="background:var(--pri-soft)"><span>☝️ دفعه‌ی بعد با اثر انگشت وارد شوید؟</span><span class="row"><button class="btn small" id="bio-on">روشن کن</button><button class="btn small ghost" id="bio-no">نه</button></span></div>` : ''}
    ${S.weeks.length > 1 ? `<div class="field"><label class="label" for="wk">هفته</label><select id="wk" class="inp">${S.weeks.map(w => `<option value="${w.id}" ${w.id === S.week ? 'selected' : ''}>${esc(w.title)}</option>`).join('')}</select></div>` : week ? `<div class="label">📅 ${esc(week.title)}</div>` : ''}
    ${!list.length ? `<div class="card"><b>هنوز ورودی‌ای به شما سپرده نشده است.</b><span class="muted">وقتی مدیر منطقه اکسل هفتگی را وارد کند، هتل‌ها و کاروان‌های شما این‌جا نشان داده می‌شوند.</span></div>` : `
    <div class="stats3"><div><b class="num">${fa(hotels.length)}</b><span>هتل</span></div><div><b class="num">${fa(list.length)}</b><span>ورودی</span></div><div><b class="num">${fa(list.length - pending.length)}</b><span>گزارش‌شده</span></div></div>
    ${hotels.length > 1 ? `<div class="cos"><button class="chip" aria-pressed="${!S.hotel}" data-hf="">همه‌ی هتل‌ها</button>${hotels.map(h => `<button class="chip" aria-pressed="${S.hotel === h}" data-hf="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}
    ${pending.length ? `<div class="bulk"><span>${fa(pending.length)} ورودی هنوز گزارش نشده. اگر هیچ مشکلی نداشتند:</span><button class="btn small okb" id="bulk">${S.bulkSure ? 'مطمئنید؟ دوباره بزنید' : '✔ همه بدون نقص'}</button></div>` : ''}
    ${[...new Set(shown.map(e => e.hotel))].map(h => { const es = shown.filter(e => e.hotel === h); return `<section class="block"><div class="hotel-h"><h3>🏨 ${esc(h)}</h3><span class="dim" style="font-size:12px">${fa(es.reduce((a, e) => a + e.pilgrims, 0))} زائر</span></div>
      ${es.map(e => { const st = statusOf(e); return `<button class="entry" data-entry="${e.id}"><span class="co">${esc(shortCo(e.company))}</span>
        <span class="d">ورود ${md(e.d_in)} ← خروج ${md(e.d_out)} · ${fa(e.caravans)} کاروان · ${fa(e.pilgrims)} زائر</span>
        <span class="st"><span class="pill ${st.c}">${st.l}</span>${e.feedback ? '<span class="pill info">💬 بازخورد</span>' : `<span class="dim" style="font-size:11px">${e.rid ? 'ویرایش ←' : 'ثبت گزارش ←'}</span>`}</span></button>`; }).join('')}</section>`; }).join('')}`}
  </main>`;
  app.querySelector('#acc').onclick = () => { app.innerHTML = `<header class="app-head"><div class="in"><div class="t"><div class="hi">${esc(S.me.nid)}</div><h1>حساب کاربری</h1></div></div></header><main class="page" id="accp"></main>`; renderAccount(app.querySelector('#accp'), S.me, () => loadHome(S.week)); };
  const wk = app.querySelector('#wk'); if (wk) wk.onchange = () => { S.hotel = ''; loadHome(+wk.value); };
  app.querySelectorAll('[data-hf]').forEach(b => b.onclick = () => { S.hotel = b.dataset.hf; renderHome(); });
  app.querySelectorAll('[data-entry]').forEach(b => b.onclick = () => openEntry(+b.dataset.entry));
  const bo = app.querySelector('#bio-on'); if (bo) bo.onclick = async () => { try { await bioRegister(); S.me = await api('/api/me', { fresh: true }); toast('ورود با اثر انگشت روشن شد.'); renderHome(); } catch (e) { toast(bioErr(e), true); } };
  const bn = app.querySelector('#bio-no'); if (bn) bn.onclick = () => { try { localStorage.setItem('hr-bio-hint', 'no'); } catch (e) {} renderHome(); };
  const bk = app.querySelector('#bulk');
  if (bk) bk.onclick = async () => {
    if (!S.bulkSure) { S.bulkSure = true; return renderHome(); }
    S.bulkSure = false;
    try { const r = await api('/api/fm/bulk-clean', { body: { entry_ids: pending.map(e => e.id) } }); toast(`${fa(r.count)} ورودی «بدون نقص» ثبت شد.`); } catch (e) { toast(e.message, true); }
    loadHome(S.week);
  };
}

/* ═════════ one entry: the report form ═════════ */
const draftKey = id => `hr-draft:${S.me.id}:${id}`;
async function openEntry(id) {
  let r; try { r = await api('/api/fm/entry/' + id); } catch (e) { return toast(e.message, true); }
  const items = {}; r.items.forEach(i => items[i.qid] = i);
  let restored = false;
  try { const d = JSON.parse(localStorage.getItem(draftKey(id)) || 'null'); if (d && (!r.report || d.at > r.report.updated)) { Object.assign(items, d.items); r.report = { ...(r.report || {}), descr: d.descr }; restored = true; } } catch (e) {}
  S.E = { id, entry: r.entry, form: r.form, items, descr: r.report?.descr || '', reportId: r.report?.id || null, media: r.media, notes: r.notes, uploads: [], restored, error: '' };
  renderEntry(); window.scrollTo(0, 0);
}
let saveT;
function keepDraft() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(draftKey(S.E.id), JSON.stringify({ at: Date.now(), items: S.E.items, descr: S.E.descr })); } catch (e) {} }, 400);
}
const verdict = (q, a) => {
  if (!a || a.v == null || a.v === '') return null; if (a.v === 'na') return 'na';
  if (q.type === 'rating') return a.v === 'mid' || a.v === 'poor' ? 'bad' : 'good';
  if (q.type === 'yesno') return a.v === q.good ? 'good' : 'bad';
  const o = (q.options || []).find(o => o.l === a.v); return o && o.bad ? 'bad' : 'good';
};
const goodValue = q => q.type === 'rating' ? 'good' : q.type === 'yesno' ? q.good : (q.options || []).find(o => !o.bad)?.l;

function mediaHTML(qid) {
  const E = S.E, list = E.media.filter(m => m.qid === qid), ups = E.uploads.filter(u => u.qid === qid);
  return `<div class="media-row">${list.map(m => `<div class="thumb">${m.status === 'ready' ? (m.kind === 'image' ? `<img src="${m.url}" alt="" loading="lazy">` : `<video src="${m.url}" muted preload="metadata"></video>`)
      : `<div class="ph">${m.status === 'processing' ? '⏳ در حال فشرده‌سازی' : m.status === 'expired' ? 'پاک شده (۷ روز)' : '⚠️ پردازش نشد'}</div>`}
      <div class="sz">${m.kind === 'image' ? '📷' : '🎬'} ${m.size ? kb(m.size) : ''}${m.orig && m.orig > m.size ? ` <span class="dim">از ${kb(m.orig)}</span>` : ''}</div>
      <button type="button" class="x" data-mrm="${m.id}" aria-label="حذف">✕</button></div>`).join('')}
    ${ups.map(u => `<div class="thumb">${u.preview ? `<img src="${u.preview}" alt="">` : '<div class="ph">🎬</div>'}<div class="prog"><i id="up-${u.k}" style="width:${Math.round(u.p * 100)}%"></i></div><div class="sz">${u.err ? `<span class="err">${esc(u.err)}</span>` : 'در حال ارسال…'}</div></div>`).join('')}
    <label class="add-media">📷 عکس<input type="file" accept="image/*" multiple data-img="${qid}"></label>
    <label class="add-media">🎬 فیلم<input type="file" accept="video/*" data-vid="${qid}"></label></div>`;
}
function qHTML(q, days) {
  const a = S.E.items[q.id] || {}, vd = verdict(q, a), bad = vd === 'bad';
  let ans;
  const na = q.na ? `<button type="button" class="n" aria-pressed="${a.v === 'na'}" data-q="${q.id}" data-v="na">${q.type === 'rating' ? '<span class="em">➖</span>' : ''}${esc(q.na)}</button>` : '';
  if (q.type === 'rating') ans = `<div class="ans">${RATING.map(r => `<button type="button" class="${r.c}" aria-pressed="${a.v === r.v}" data-q="${q.id}" data-v="${r.v}"><span class="em">${r.em}</span>${r.l}</button>`).join('')}${na}</div>`;
  else if (q.type === 'yesno') ans = `<div class="ans yn">${['yes', 'no'].map(v => `<button type="button" class="${v === q.good ? 'g' : 'b'}" aria-pressed="${a.v === v}" data-q="${q.id}" data-v="${v}">${v === 'yes' ? '✔ بله' : '✖ خیر'}</button>`).join('')}${na}</div>`;
  else ans = `<div class="ans ch">${(q.options || []).map(o => `<button type="button" class="${o.bad ? 'b' : 'g'}" aria-pressed="${a.v === o.l}" data-q="${q.id}" data-v="${esc(o.l)}">${esc(o.l)}</button>`).join('')}${na}</div>`;
  const def = !bad ? '' : `<div class="defect">
    ${(q.reasons || []).length ? `<div class="block" style="gap:5px"><span class="label">چه اشکالی بود؟</span><div class="cos">${q.reasons.map(r => `<button type="button" class="chip bad" aria-pressed="${(a.reasons || []).includes(r)}" data-q="${q.id}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>` : ''}
    ${days.length ? `<div class="block" style="gap:5px"><span class="label">چه روزی؟</span><div class="cos">${days.map(d => `<button type="button" class="chip" aria-pressed="${a.day === d}" data-q="${q.id}" data-day="${d}">${dayName(d)}</button>`).join('')}</div></div>` : ''}
    <div class="block" style="gap:5px"><span class="label">چه اقدامی انجام دادید؟</span>
      ${(q.actions || []).length ? `<div class="cos">${q.actions.map(x => `<button type="button" class="chip" aria-pressed="${(a.actions || []).includes(x)}" data-q="${q.id}" data-act="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      <div class="voice"><input type="text" id="at-${q.id}" data-q="${q.id}" data-txt="actionText" value="${esc(a.actionText)}" placeholder="اقدام دیگر یا توضیح…" maxlength="1000"><button type="button" class="mic" data-mic="at-${q.id}" aria-label="تایپ صوتی">🎤</button></div></div>
    <div class="block" style="gap:5px"><span class="label">نتیجه ${S.E.error === q.id ? '<span class="err">· نتیجه را انتخاب کنید</span>' : ''}</span>
      <div class="res">${Object.entries(RESULT).map(([k, [l, ic, c]]) => `<button type="button" class="${c}" aria-pressed="${a.result === k}" data-q="${q.id}" data-res="${k}">${ic} ${l}</button>`).join('')}</div>
      ${a.result ? `<div class="voice"><input type="text" id="rn-${q.id}" data-q="${q.id}" data-txt="resultNote" value="${esc(a.resultNote)}" maxlength="1000" placeholder="${a.result === 'fixed' ? 'چطور و کی رفع شد؟ (اختیاری)' : 'چرا هنوز رفع نشده؟ (اختیاری)'}"><button type="button" class="mic" data-mic="rn-${q.id}" aria-label="تایپ صوتی">🎤</button></div>` : ''}</div>
    ${mediaHTML(q.id)}</div>`;
  return `<div class="q ${bad ? 'isbad' : vd === 'good' ? 'isgood' : ''}" id="q-${q.id}"><div class="q-t"><span class="e">${esc(q.emoji || '•')}</span><span>${esc(q.text)}</span></div>${ans}${def}</div>`;
}
function renderEntry() {
  const E = S.E, e = E.entry, days = daysOf(e.d_in, e.d_out);
  const qs = E.form.sections.flatMap(s => s.questions);
  const defs = qs.filter(q => verdict(q, E.items[q.id]) === 'bad'), noRes = defs.filter(q => !E.items[q.id].result).length;
  const keep = window.scrollY;
  app.innerHTML = `<header class="app-head"><div class="in"><button class="hbtn" id="back">→</button><div class="t"><div class="hi">${esc(e.hotel)}</div><h1>${esc(shortCo(e.company))}</h1>
      <div class="meta"><span>ورود ${md(e.d_in)} ← خروج ${md(e.d_out)}</span><span>${fa(e.caravans)} کاروان · ${fa(e.pilgrims)} زائر</span>${e.siyahe ? `<span>سیاحه: ${esc(e.siyahe)}</span>` : ''}</div></div></div></header>
  <main class="page">
    ${E.restored ? '<div class="pill info" style="align-self:flex-start">پیش‌نویس ذخیره‌شده در گوشی بازیابی شد</div>' : ''}
    ${E.notes.length ? `<div class="card"><div class="card-h"><h2>💬 گفتگو با مدیر منطقه</h2></div><div class="thread">${E.notes.map(n => `<div class="msg ${n.role === 'fm' ? 'me' : 'them'}"><div class="who">${n.role === 'fm' ? 'شما' : 'مدیر منطقه'} · ${fmtTs(n.ts)}${n.qid ? ' · ' + esc(qs.find(q => q.id === n.qid)?.text || '') : ''}</div>${esc(n.text)}</div>`).join('')}</div>
      <div class="reply"><input id="nt" placeholder="پاسخ به مدیر منطقه…" maxlength="1000"><button class="btn small" id="nt-send">ارسال</button></div></div>` : ''}
    ${E.form.sections.map(s => `<section class="sec"><div class="sec-h"><h3>${esc(s.emoji)} ${esc(s.title)}</h3><button class="btn small okb" data-secok="${esc(s.id)}">✔ بدون نقص</button></div>
      <div class="sec-b">${s.questions.map(q => qHTML(q, days)).join('')}</div></section>`).join('')}
    <div class="block"><label class="label" for="desc">توضیح کلی (اختیاری)</label><div class="voice"><textarea id="desc" maxlength="3000" placeholder="بنویسید یا 🎤 را بزنید و بگویید…">${esc(E.descr)}</textarea><button type="button" class="mic" data-mic="desc" aria-label="تایپ صوتی">🎤</button></div></div>
    <p class="hint">عکس‌ها در خود گوشی کوچک می‌شوند. فیلم حداکثر ۶۰ ثانیه است و در سرور فشرده می‌شود. عکس و فیلم‌ها ۷ روز بعد از سرور پاک می‌شوند، ولی متن گزارش می‌ماند.</p>
  </main>
  <div class="send-bar"><div class="in"><span class="tally">${fa(defs.length)} نقص${noRes ? ` · <span style="color:var(--bad)">${fa(noRes)} بدون نتیجه</span>` : ''}</span><button class="btn" id="save">${E.reportId ? 'ذخیره‌ی تغییرات' : 'ثبت گزارش'}</button></div></div>`;
  window.scrollTo(0, keep);
  wireEntry();
}
function wireEntry() {
  const E = S.E, it = id => E.items[id] || (E.items[id] = {}), redo = () => { keepDraft(); renderEntry(); };
  app.querySelector('#back').onclick = () => loadHome(S.week);
  app.querySelectorAll('[data-q][data-v]').forEach(b => b.onclick = () => { const cur = it(b.dataset.q);
    E.items[b.dataset.q] = cur.v === b.dataset.v ? {} : { ...cur, v: b.dataset.v, reasons: cur.reasons || [], actions: cur.actions || [] }; if (E.error === b.dataset.q) E.error = ''; redo(); });
  const toggle = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); return i < 0; };
  app.querySelectorAll('[data-q][data-r]').forEach(b => b.onclick = () => { const a = it(b.dataset.q); a.reasons = a.reasons || []; b.setAttribute('aria-pressed', toggle(a.reasons, b.dataset.r)); keepDraft(); });
  app.querySelectorAll('[data-q][data-act]').forEach(b => b.onclick = () => { const a = it(b.dataset.q); a.actions = a.actions || []; b.setAttribute('aria-pressed', toggle(a.actions, b.dataset.act)); keepDraft(); });
  app.querySelectorAll('[data-q][data-day]').forEach(b => b.onclick = () => { const a = it(b.dataset.q); a.day = a.day === b.dataset.day ? '' : b.dataset.day; b.parentNode.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x.dataset.day === a.day)); keepDraft(); });
  app.querySelectorAll('[data-q][data-res]').forEach(b => b.onclick = () => { const a = it(b.dataset.q); a.result = a.result === b.dataset.res ? '' : b.dataset.res; if (E.error === b.dataset.q) E.error = ''; redo(); });
  app.querySelectorAll('[data-q][data-txt]').forEach(i => i.oninput = () => { it(i.dataset.q)[i.dataset.txt] = i.value; keepDraft(); });
  app.querySelector('#desc').oninput = e => { E.descr = e.target.value; keepDraft(); };
  app.querySelectorAll('[data-mic]').forEach(b => b.onclick = () => voiceInto(document.getElementById(b.dataset.mic), b));
  app.querySelectorAll('[data-secok]').forEach(b => b.onclick = () => { E.form.sections.find(s => s.id === b.dataset.secok).questions.forEach(q => { const a = E.items[q.id]; if (!a || !a.v) E.items[q.id] = { v: goodValue(q) }; }); redo(); });
  app.querySelectorAll('[data-mrm]').forEach(b => b.onclick = async () => { try { await api('/api/fm/media/' + b.dataset.mrm, { method: 'DELETE' }); E.media = E.media.filter(m => m.id !== +b.dataset.mrm); renderEntry(); } catch (e) { toast(e.message, true); } });
  app.querySelectorAll('input[data-img]').forEach(fi => fi.onchange = () => { [...fi.files].forEach(f => sendMedia(fi.dataset.img, f, 'image')); });
  app.querySelectorAll('input[data-vid]').forEach(fi => fi.onchange = () => { if (fi.files[0]) sendMedia(fi.dataset.vid, fi.files[0], 'video'); });
  const ns = app.querySelector('#nt-send');
  if (ns) ns.onclick = async () => { const t = app.querySelector('#nt').value.trim(); if (!t) return; try { const r = await api('/api/notes', { body: { report_id: E.reportId, text: t } }); E.notes = r.notes; renderEntry(); } catch (e) { toast(e.message, true); } };
  app.querySelector('#save').onclick = save;
}
async function sendMedia(qid, file, kind) {
  const E = S.E, up = { qid, p: 0, preview: null, err: '', k: Math.random().toString(36).slice(2) };
  E.uploads.push(up);
  try {
    let blob = file;
    if (kind === 'image') { blob = await compressImage(file); up.preview = URL.createObjectURL(blob); }
    else {
      if (file.size > 200 * 1048576) throw new Error('فیلم بیشتر از ۲۰۰ مگ است. کوتاه‌ترش کنید.');
      const dur = await new Promise(res => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => { res(v.duration); URL.revokeObjectURL(v.src); }; v.onerror = () => res(0); v.src = URL.createObjectURL(file); });
      if (dur > 61) throw new Error(`فیلم ${fa(Math.round(dur))} ثانیه است. حداکثر ۶۰ ثانیه.`);
    }
    if (S.E === E) renderEntry();
    const m = await upload(`/api/fm/media?entry=${E.id}&qid=${encodeURIComponent(qid)}&kind=${kind}`, blob, { 'Content-Type': blob.type || 'application/octet-stream', 'x-orig-size': String(file.size) },
      p => { up.p = p; const bar = document.getElementById('up-' + up.k); if (bar) bar.style.width = Math.round(p * 100) + '%'; });
    E.media.push(m); E.uploads.splice(E.uploads.indexOf(up), 1);
    if (up.preview) URL.revokeObjectURL(up.preview);
    if (m.status === 'processing') pollMedia(E, m.id);
    toast(kind === 'image' ? `عکس فرستاده شد (${kb(m.size)} به‌جای ${kb(file.size)}).` : 'فیلم رسید و در حال فشرده‌سازی است.');
  } catch (e) { up.err = e.message; setTimeout(() => { const i = E.uploads.indexOf(up); if (i >= 0) E.uploads.splice(i, 1); if (S.E === E) renderEntry(); }, 6000); }
  if (S.E === E) renderEntry();
}
async function pollMedia(E, id) {
  for (let i = 0; i < 120 && S.E === E; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try { const m = await api('/api/fm/media/' + id, { fresh: true }); if (m.status !== 'processing') { const k = E.media.findIndex(x => x.id === id); if (k >= 0) E.media[k] = m; if (S.E === E) renderEntry(); return; } } catch (e) { return; }
  }
}
async function save() {
  const E = S.E, qs = E.form.sections.flatMap(s => s.questions);
  const missing = qs.find(q => verdict(q, E.items[q.id]) === 'bad' && !E.items[q.id].result);
  if (missing) { E.error = missing.id; renderEntry(); document.getElementById('q-' + missing.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return toast('برای هر نقص بگویید رفع شد یا نه.', true); }
  if (!qs.some(q => E.items[q.id] && E.items[q.id].v)) return toast('دست‌کم به یک سؤال جواب بدهید، یا «بدون نقص» بزنید.', true);
  if (E.uploads.some(u => !u.err)) return toast('صبر کنید ارسال عکس یا فیلم تمام شود.', true);
  const b = app.querySelector('#save'); b.disabled = true; b.textContent = 'در حال ثبت…';
  try {
    await api('/api/fm/entry/' + E.id, { method: 'PUT', body: { descr: E.descr, items: E.items } });
    try { localStorage.removeItem(draftKey(E.id)); } catch (e) {}
    toast('گزارش ثبت شد و برای مدیر منطقه فرستاده شد.');
    loadHome(S.week); window.scrollTo(0, 0);
  } catch (e) {
    keepDraft(); b.disabled = false; b.textContent = 'ثبت گزارش';
    toast(e.offline ? 'اینترنت وصل نیست. گزارش در گوشی ذخیره شد؛ وقتی وصل شدید دوباره «ثبت» را بزنید.' : e.message, true);
  }
}

})();
