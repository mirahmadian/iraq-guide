'use strict';
/* ══════════════════════════════════════════
   کارهای روزانه‌ی مناطق (درخواست سرپرست مناطق):
   • ارزشیابی پایان مأموریت (عوامل و مدیران منطقه): هر سؤال ۱ تا ۵ ← نمره از ۱۰۰
   • گزارش روزانه‌ی حوزه‌ها (اسکان، تغذیه، نقل، …) با شرح؛ هر مدیر منطقه فقط «محدوده‌ی فعالیت» خودش
   • آمار لحظه‌ای هر ورودی (زائر/اتاق/تخت) در برابر برنامه‌ی اکسل
   • اجرای برنامه‌ی غذایی وعده‌به‌وعده (بله/خیر برای هر قلم، از برنامه‌ی غذایی همین اپ: data.js)
══════════════════════════════════════════ */
let OPS_CFG = null;
async function opsCfgGet(fresh) { if (!OPS_CFG || fresh) OPS_CFG = await api('/api/opscfg'); return OPS_CFG; }

/* ── ارزشیابی ── */
const scoreTag = s => s == null ? '<span class="dim">—</span>' : `<span class="pill ${s >= 80 ? 'ok' : s >= 60 ? 'warn' : 'bad'}" title="نمره‌ی ارزشیابی از ۱۰۰">⭐ ${fa(s)}</span>`;
function evalFormHTML(qs) {
  return `<div class="ev">${qs.map((q, i) => `<div class="ev-q"><span>${fa(i + 1)}. ${esc(q)}</span><div class="ev-s" role="group" aria-label="${esc(q)}">${[1, 2, 3, 4, 5].map(v => `<button type="button" data-ev="${i}" data-v="${v}" aria-pressed="false">${fa(v)}</button>`).join('')}</div></div>`).join('')}
    <div class="dim" style="font-size:12px">۱ = خیلی ضعیف · ۲ = ضعیف · ۳ = متوسط · ۴ = خوب · ۵ = عالی</div>
    <textarea class="inp ev-note" rows="2" maxlength="1000" placeholder="توضیح و نظر شما (اختیاری)"></textarea><div class="ev-sc"></div></div>`;
}
function wireEval(root, qs) {
  const upd = () => { const e = readEval(root, qs); root.querySelector('.ev-sc').innerHTML = e.done ? `نمره: <b>${fa(e.score)}</b> از ۱۰۰` : `<span class="dim">${fa(e.left)} سؤال بی‌پاسخ</span>`; };
  root.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { root.querySelectorAll(`[data-ev="${b.dataset.ev}"]`).forEach(x => x.setAttribute('aria-pressed', x === b)); upd(); });
  upd();
}
function readEval(root, qs) {
  const answers = qs.map((q, i) => ({ v: +((root.querySelector(`[data-ev="${i}"][aria-pressed="true"]`) || {}).dataset || {}).v || 0 }));
  const left = answers.filter(a => !a.v).length;
  return { answers, note: (root.querySelector('.ev-note') || {}).value || '', done: !left, left, score: left ? null : Math.round(answers.reduce((a, x) => a + x.v, 0) / answers.length * 20) };
}

/* ── برنامه‌ی غذایی همین اپ ── */
let FOOD_P = null;
function loadFood() {
  if (!FOOD_P) FOOD_P = fetch('data.js', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('برنامه‌ی غذایی بار نشد.'); return r.text(); })
    .then(t => new Function(t + ';return CARAVAN_DATA.food;')()).catch(e => { FOOD_P = null; throw e; });
  return FOOD_P;
}
const MEAL_L = { breakfast: '🌅 صبحانه', lunch: '☀️ ناهار', dinner: '🌙 شام' };
function mealItems(F, planId, dayNo, meal) {
  const p = (F.plans || []).find(x => x.id === planId); if (!p || !p.days || !p.days.length || dayNo < 1) return [];
  const d = p.days[(dayNo - 1) % p.days.length] || {}, m = d[meal] || {}, out = [], seen = new Set();
  const add = (name, q) => { const n = String(name || '').trim(); if (n && !seen.has(n)) { seen.add(n); out.push({ name: n, q: q || '' }); } };
  add(m.hot); add(m.main); add(m.fruit); (m.sides || []).forEach(s => add(s.name, s.q));
  return out;
}
const dayChips = (cur, today, min, max, attr) => [0, 1, 2, 3].map(k => today - k).filter(d => (min == null || d >= min) && (max == null || d <= max))
  .map(d => `<button class="chip" ${attr}="${d}" aria-pressed="${d === cur}">${d === today ? 'امروز' : d === today - 1 ? 'دیروز' : JDP.long(d).split(' ').slice(0, 3).join(' ')}</button>`).join('');

/* ═════ مدیر ثابت: آمار لحظه‌ای و اجرای غذا برای یک ورودی ═════ */
window.openOps = async (entryId, back, dayIn) => {
  const app = document.getElementById('app');
  let r, F; try { [r, F] = await Promise.all([api(`/api/fm/ops/${entryId}` + (dayIn ? '?day=' + JDP.str(dayIn, false) : '')), loadFood()]); } catch (e) { return toast(e.message, true); }
  const e = r.entry, day = JDP.num(r.day), today = JDP.num(r.today), din = JDP.num(e.d_in), dout = JDP.num(e.d_out), dayNo = din != null ? day - din + 1 : 0;
  const here = din != null && dout != null && day >= din && day <= dout;
  const plans = (F.plans || []).filter(p => p.active !== false), o = r.occ || {}, plan = r.plan;
  const T = F.times || {};
  app.innerHTML = `<header class="app-head"><div class="in"><button class="hbtn" id="ob">→</button><div class="t"><div class="hi">${esc(e.hotel)}</div><h1>🛏️ آمار و 🍽️ غذا</h1>
    <div class="meta"><span>${esc(shortCo(e.company))}</span><span>ورود ${md(e.d_in)} ← خروج ${md(e.d_out)}</span></div></div></div></header>
  <main class="page">
    <section class="card"><h2 style="font-size:16px;margin:0">🛏️ آمار لحظه‌ای</h2>
      <p class="hint">آنچه همین حالا در عمل هست را بنویسید. عدد «برنامه» از اکسل مدیر منطقه است.</p>
      <div class="occ-g"><span></span><b>برنامه</b><b>واقعی</b>
        <span>👥 زائر</span><span class="num">${e.pilgrims ? fa(e.pilgrims) : '—'}</span><input class="inp" data-o="pilgrims" inputmode="numeric" value="${o.pilgrims ?? ''}">
        <span>🚪 اتاق</span><span class="num">${e.rooms ? fa(e.rooms) : '—'}</span><input class="inp" data-o="rooms" inputmode="numeric" value="${o.rooms ?? ''}">
        <span>🛏️ تخت</span><span class="num">${e.beds ? fa(e.beds) : '—'}</span><input class="inp" data-o="beds" inputmode="numeric" value="${o.beds ?? ''}"></div>
      <input class="inp" data-o="note" maxlength="500" placeholder="توضیح (مثلاً ۲ اتاق تعمیری، ۵ زائر هنوز نرسیده)" value="${esc(o.note || '')}" style="margin-top:8px">
      <div class="row" style="margin-top:8px"><button class="btn" id="occ-s">💾 ثبت آمار</button>${o.updated ? `<span class="dim" style="font-size:12px">آخرین ثبت: ${fmtTs(o.updated)}</span>` : ''}</div>
      ${r.log.length > 1 ? `<details style="margin-top:8px"><summary class="dim" style="cursor:pointer;font-size:12.5px">🕘 ثبت‌های قبلی (${fa(r.log.length)})</summary><ul class="occ-log">${r.log.map(l => `<li><span class="num">${fmtTs(l.t)}</span> · زائر ${l.pilgrims ?? '—'} · اتاق ${l.rooms ?? '—'} · تخت ${l.beds ?? '—'}${l.note ? ' · ' + esc(l.note) : ''}</li>`).join('')}</ul></details>` : ''}
    </section>
    <section class="card"><h2 style="font-size:16px;margin:0">🍽️ اجرای برنامه‌ی غذایی</h2>
      <div class="field"><label class="label" for="pl">برنامه‌ی غذایی این کاروان</label><select id="pl" class="inp"><option value="">— انتخاب کنید —</option>${plans.map(p => `<option value="${esc(p.id)}" ${p.id === plan ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select>
        ${plan && !r.planSet ? '<span class="hint">از ورودی قبلی همین هتل پیشنهاد شد؛ اگر درست است همین را نگه دارید.</span>' : ''}</div>
      <div class="cos">${dayChips(day, today, din, dout, 'data-d')}</div>
      ${!here ? '<div class="empty">این کاروان در این روز در هتل نیست.</div>' : !plan ? '<div class="empty">اول برنامه‌ی غذایی را انتخاب کنید.</div>' : `
      <p class="hint">روز ${fa(dayNo)} سفر · ${esc(JDP.long(day))}. برای هر قلم بزنید: سرو شد ✅ یا نشد ❌، بعد «ثبت» همان وعده.</p>
      ${['breakfast', 'lunch', 'dinner'].map(ml => { const it = mealItems(F, plan, dayNo, ml), c = r.checks.find(x => x.meal === ml) || { items: {} };
        return `<div class="meal" data-meal="${ml}"><div class="row" style="justify-content:space-between"><h3>${MEAL_L[ml]}</h3>${T[ml] && T[ml].from ? `<span class="dim num" style="font-size:12px">${faS(T[ml].from)} تا ${faS(T[ml].to)}</span>` : ''}${c.updated ? `<span class="pill ok">ثبت شد ${fmtTs(c.updated).split(' ').pop()}</span>` : ''}</div>
        ${it.length ? it.map(x => `<div class="mi"><span>${esc(x.name)}${x.q ? ` <span class="dim">(${esc(faS(x.q))})</span>` : ''}</span><span class="yn"><button type="button" data-yn="1" aria-pressed="${c.items[x.name] === 1}" data-n="${esc(x.name)}">✅ بله</button><button type="button" data-yn="0" aria-pressed="${c.items[x.name] === 0}" data-n="${esc(x.name)}">❌ خیر</button></span></div>`).join('')
          + `<input class="inp" data-mn maxlength="500" placeholder="توضیح (اختیاری)" value="${esc(c.note || '')}"><div class="row"><button class="btn small ghost" data-allyes>همه بله</button><button class="btn small" data-msave>ثبت ${MEAL_L[ml].split(' ')[1]}</button></div>`
          : '<div class="dim">برای این وعده در برنامه چیزی نیست.</div>'}</div>`; }).join('')}`}
    </section>
  </main>`;
  app.querySelector('#ob').onclick = back;
  app.querySelector('#occ-s').onclick = async () => {
    const g = k => app.querySelector(`[data-o="${k}"]`).value.replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).trim();
    try { await api('/api/fm/occ', { body: { entry_id: e.id, pilgrims: g('pilgrims'), rooms: g('rooms'), beds: g('beds'), note: app.querySelector('[data-o="note"]').value } }); toast('آمار ثبت شد ✅'); openOps(entryId, back, day); } catch (x) { toast(x.message, true); }
  };
  app.querySelector('#pl').onchange = async ev => { try { await api('/api/fm/food-plan', { body: { entry_id: e.id, plan_id: ev.target.value } }); openOps(entryId, back, day); } catch (x) { toast(x.message, true); } };
  app.querySelectorAll('[data-d]').forEach(b => b.onclick = () => openOps(entryId, back, +b.dataset.d));
  app.querySelectorAll('.meal').forEach(M => {
    M.querySelectorAll('[data-yn]').forEach(b => b.onclick = () => { M.querySelectorAll(`[data-yn][data-n="${CSS.escape(b.dataset.n)}"]`).forEach(x => x.setAttribute('aria-pressed', x === b)); });
    const ay = M.querySelector('[data-allyes]'); if (ay) ay.onclick = () => M.querySelectorAll('[data-yn]').forEach(x => x.setAttribute('aria-pressed', x.dataset.yn === '1'));
    const sv = M.querySelector('[data-msave]'); if (sv) sv.onclick = async () => {
      const items = {}; M.querySelectorAll('[data-yn][aria-pressed="true"]').forEach(x => items[x.dataset.n] = +x.dataset.yn);
      const all = new Set([...M.querySelectorAll('[data-yn]')].map(x => x.dataset.n)).size;
      if (Object.keys(items).length < all && !confirm(`برای ${fa(all - Object.keys(items).length)} قلم بله/خیر نزده‌اید. همین‌طور ثبت شود؟`)) return;
      try { await api('/api/fm/meal', { body: { entry_id: e.id, day: JDP.str(day, false), meal: M.dataset.meal, items, note: M.querySelector('[data-mn]').value } }); toast('ثبت شد ✅'); openOps(entryId, back, day); } catch (x) { toast(x.message, true); }
    };
  });
  window.scrollTo(0, 0);
};

/* ═════ مدیر منطقه: گزارش روزانه‌ی حوزه‌ها ═════ */
const DST_L = { ok: ['✅', 'مطلوب', 'ok'], minor: ['⚠️', 'مشکل جزئی', 'warn'], major: ['❌', 'مشکل جدی', 'bad'], na: ['➖', 'موردی نبود', 'mute'] };
window.renderDailyForm = async (m, dayIn) => {
  let r; try { r = await api('/api/admin/daily' + (dayIn ? '?day=' + JDP.str(dayIn, false) : '')); } catch (e) { return toast(e.message, true); }
  const day = JDP.num(r.day), today = JDP.num(r.today), got = d => r.rows.find(x => x.domain === d) || {};
  m.innerHTML = `<div class="card"><div class="card-h"><h2>📝 گزارش روزانه‌ی حوزه‌ها</h2></div>
    <p class="hint">هر روز برای هر حوزه‌ی محدوده‌ی فعالیت خودتان وضعیت را بزنید و شرح بنویسید (برای «مشکل» نوشتن شرح لازم است). تا سه روز بعد می‌شود ویرایش کرد.</p>
    <div class="cos">${dayChips(day, today, null, null, 'data-dd')}</div>
    <div class="dim" style="margin:6px 0">${esc(JDP.long(day))}</div>
    ${r.domains.map((d, i) => { const g = got(d); return `<div class="dr" data-dom="${esc(d)}"><div class="row" style="justify-content:space-between"><b>${esc(d)}</b>${g.updated ? `<span class="dim" style="font-size:11.5px">${esc(g.by || '')} · ${fmtTs(g.updated)}</span>` : ''}</div>
      <div class="yn">${Object.entries(DST_L).map(([k, v]) => `<button type="button" data-st="${k}" aria-pressed="${g.status === k}">${v[0]} ${v[1]}</button>`).join('')}</div>
      <textarea class="inp" rows="2" maxlength="3000" placeholder="شرح ${esc(d)}…">${esc(g.text || '')}</textarea></div>`; }).join('')}
    <div class="row"><button class="btn" id="dr-s">💾 ثبت گزارش روز</button><span class="err" id="dr-e"></span></div></div>
    ${r.recent.length ? `<div class="card"><h3 style="margin:0 0 6px;font-size:14px">روزهای اخیر</h3><ul class="occ-log">${r.recent.map(x => `<li><button class="linkish" data-dd="${JDP.num(x.day)}">${esc(JDP.long(JDP.num(x.day)))}</button> · ${fa(x.n)} حوزه${x.major ? ` · <span class="pill bad">${fa(x.major)} جدی</span>` : ''}${x.minor ? ` · <span class="pill warn">${fa(x.minor)} جزئی</span>` : ''}</li>`).join('')}</ul></div>` : ''}`;
  m.querySelectorAll('[data-dd]').forEach(b => b.onclick = () => renderDailyForm(m, +b.dataset.dd));
  m.querySelectorAll('.dr').forEach(D => D.querySelectorAll('[data-st]').forEach(b => b.onclick = () => D.querySelectorAll('[data-st]').forEach(x => x.setAttribute('aria-pressed', x === b))));
  m.querySelector('#dr-s').onclick = async () => {
    const items = [...m.querySelectorAll('.dr')].map(D => ({ domain: D.dataset.dom, status: (D.querySelector('[data-st][aria-pressed="true"]') || {}).dataset?.st, text: D.querySelector('textarea').value })).filter(x => x.status);
    const er = m.querySelector('#dr-e'); er.textContent = '';
    try { const x = await api('/api/admin/daily', { body: { day: JDP.str(day, false), items } }); toast(`گزارش ${fa(x.n)} حوزه ثبت شد ✅`); renderDailyForm(m, day); } catch (e) { er.textContent = e.message; }
  };
};

/* ═════ مدیر منطقه: اسکان و غذا (همه‌ی ورودی‌های حاضر در یک روز) ═════ */
window.renderOpsRegion = async (m, dayIn) => {
  let r; try { r = await api('/api/admin/ops' + (dayIn ? '?day=' + JDP.str(dayIn, false) : '')); } catch (e) { return toast(e.message, true); }
  const day = JDP.num(r.day), E = r.entries;
  const sum = k => E.reduce((a, e) => a + (+e[k] || 0), 0);
  const cmp = (p, a) => a == null ? '<span class="dim">—</span>' : `<b class="num ${p && a !== p ? 'occ-diff' : ''}">${fa(a)}</b>`;
  const mealPill = (e, ml) => { const c = e.meals.find(x => x.meal === ml); if (!c) return '<span class="pill mute" title="ثبت نشده">—</span>';
    const v = Object.values(c.items), no = Object.entries(c.items).filter(([, x]) => x === 0).map(([k]) => k);
    return no.length ? `<span class="pill bad" title="سرو نشد: ${esc(no.join('، '))}">❌ ${fa(no.length)} قلم</span>` : `<span class="pill ok">✅ ${fa(v.length)}</span>`; };
  const allC = E.flatMap(e => e.meals), yes = allC.reduce((a, c) => a + Object.values(c.items).filter(x => x === 1).length, 0), tot = allC.reduce((a, c) => a + Object.values(c.items).length, 0);
  m.innerHTML = `<div class="card"><div class="card-h"><h2>🛏️ اسکان و 🍽️ غذا</h2><div class="row"><button class="btn small ghost" data-od="${day - 1}">→ روز قبل</button><button class="btn small ghost" id="od-pick">📅 ${esc(JDP.long(day))}</button><button class="btn small ghost" data-od="${day + 1}">روز بعد ←</button></div></div>
    <p class="hint">کاروان‌هایی که در این روز در هتل‌های منطقه هستند (از سه اکسل هفتگی آخر). «واقعی» و وعده‌ها را مدیران ثابت از صفحه‌ی هر ورودی ← «🛏️ آمار و 🍽️ غذا» ثبت می‌کنند. برای به‌روز کردن اعداد برنامه (زائر، اتاق، تخت) کافی است اکسل همان هفته را دوباره وارد کنید؛ ستون‌های «تعداد اتاق» و «تعداد تخت» هم خوانده می‌شوند.</p>
    <div class="kpis k6"><div class="kpi"><span class="v num">${fa(E.length)}</span><span class="k">ورودی حاضر</span></div>
      <div class="kpi"><span class="v num">${fa(sum('pilgrims'))}</span><span class="k">زائر طبق برنامه</span></div>
      <div class="kpi"><span class="v num">${fa(sum('a_pil'))}</span><span class="k">زائر واقعی (${fa(E.filter(e => e.a_pil != null).length)} ورودی)</span></div>
      <div class="kpi"><span class="v num">${fa(sum('a_rooms'))}</span><span class="k">اتاق واقعی</span></div>
      <div class="kpi"><span class="v num">${fa(sum('a_beds'))}</span><span class="k">تخت واقعی</span></div>
      <div class="kpi"><span class="v num">${tot ? fa(Math.round(yes / tot * 100)) + '٪' : '—'}</span><span class="k">اقلام غذای سرو‌شده</span></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>هتل / شرکت</th><th>مدیر ثابت</th><th>روز</th><th>زائر<br><span class="dim">برنامه/واقعی</span></th><th>اتاق</th><th>تخت</th><th>صبحانه</th><th>ناهار</th><th>شام</th><th>آخرین آمار</th></tr></thead><tbody>
    ${E.map(e => `<tr data-oe="${e.id}" style="cursor:pointer"><td><b>${esc(e.hotel)}</b><div class="dim" style="font-size:11.5px">${esc(shortCo(e.company || ''))}</div></td><td class="dim">${esc(e.fm || '—')}</td><td class="num">${fa(e.day_no)}</td>
      <td>${e.pilgrims ? fa(e.pilgrims) : '—'} / ${cmp(e.pilgrims, e.a_pil)}</td><td>${e.rooms ? fa(e.rooms) : '—'} / ${cmp(e.rooms, e.a_rooms)}</td><td>${e.beds ? fa(e.beds) : '—'} / ${cmp(e.beds, e.a_beds)}</td>
      <td>${mealPill(e, 'breakfast')}</td><td>${mealPill(e, 'lunch')}</td><td>${mealPill(e, 'dinner')}</td><td class="dim" style="font-size:11.5px">${e.a_t ? fmtTs(e.a_t) : '—'}</td></tr>
      <tr class="oe-d" data-oed="${e.id}" hidden><td colspan="10">${e.a_note ? `<div>🛏️ ${esc(e.a_note)}</div>` : ''}${e.meals.map(c => { const no = Object.entries(c.items).filter(([, x]) => x === 0).map(([k]) => k); return `<div>${MEAL_L[c.meal]}: ${no.length ? `<b style="color:var(--bad)">سرو نشد: ${esc(no.join('، '))}</b>` : 'همه‌ی اقلام سرو شد'}${c.note ? ' · ' + esc(c.note) : ''}</div>`; }).join('') || '<span class="dim">برای این روز وعده‌ای ثبت نشده.</span>'}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">در این روز کاروانی در هتل‌های این منطقه نیست (یا اکسل هفتگی وارد نشده).</td></tr>'}
    </tbody></table></div></div>`;
  m.querySelectorAll('[data-od]').forEach(b => b.onclick = () => renderOpsRegion(m, +b.dataset.od));
  m.querySelector('#od-pick').onclick = () => JDP.open({ value: day, title: 'روز', onPick: d => d != null && renderOpsRegion(m, d) });
  m.querySelectorAll('[data-oe]').forEach(tr => tr.onclick = () => { const d = m.querySelector(`[data-oed="${tr.dataset.oe}"]`); d.hidden = !d.hidden; });
};

/* ═════ سرپرست مناطق: گزارش روزانه‌ی همه‌ی مناطق ═════ */
window.renderDailyAll = async (m, regions, dayIn) => {
  let r; try { r = await api('/api/super/daily' + (dayIn ? '?day=' + JDP.str(dayIn, false) : '')); } catch (e) { return toast(e.message, true); }
  const day = JDP.num(r.day), D = r.domains, cell = (rg, d) => r.rows.find(x => x.region_id === rg.id && x.domain === d);
  const mgs = rg => r.mgrs.filter(x => x.region_id === rg.id), inScope = (rg, d) => { const L = mgs(rg); return !L.length || L.some(x => !x.scope || x.scope.includes(d)); };
  const done = regions.filter(rg => r.rows.some(x => x.region_id === rg.id)).length;
  const probs = r.rows.filter(x => x.status === 'major' || x.status === 'minor').sort((a, b) => (a.status === 'major' ? 0 : 1) - (b.status === 'major' ? 0 : 1));
  const rn = id => { const x = regions.find(g => g.id === id); return x ? (x.city && !x.name.includes(x.city) ? x.city + ' · ' : '') + x.name : ''; };
  m.innerHTML = `<div class="card"><div class="card-h"><h2>📝 گزارش روزانه‌ی مناطق</h2><div class="row"><button class="btn small ghost" data-dd="${day - 1}">→ روز قبل</button><button class="btn small ghost" id="dd-pick">📅 ${esc(JDP.long(day))}</button><button class="btn small ghost" data-dd="${day + 1}">روز بعد ←</button></div></div>
    <p class="hint">${fa(done)} منطقه از ${fa(regions.length)} برای این روز گزارش داده‌اند. ✅ مطلوب · ⚠️ مشکل جزئی · ❌ مشکل جدی · ➖ موردی نبود · — = گزارش نشده · · = بیرون از محدوده‌ی فعالیت. روی هر خانه بزنید تا شرح بیاید.</p>
    <div class="tbl-wrap"><table class="dmx"><thead><tr><th>منطقه</th><th>مدیر منطقه</th>${D.map(d => `<th>${esc(d)}</th>`).join('')}</tr></thead><tbody>
    ${regions.map(rg => `<tr><td><b>${esc(rn(rg.id))}</b></td><td class="dim">${esc(mgs(rg).map(x => x.name).join('، ') || '—')}</td>${D.map(d => { const c = cell(rg, d); return !inScope(rg, d) ? '<td class="dim">·</td>' : c ? `<td><button class="dmc ${DST_L[c.status][2]}" data-c="${rg.id}|${esc(d)}" title="${esc(c.text || '')}">${DST_L[c.status][0]}</button></td>` : '<td class="dim">—</td>'; }).join('')}</tr>`).join('')}
    </tbody></table></div><div id="dd-x"></div></div>
    <div class="card"><h3 style="margin:0 0 6px;font-size:14px">⚠️ مشکلات گزارش‌شده در این روز (${fa(probs.length)})</h3>
      ${probs.map(x => `<div class="dr"><div><span class="pill ${DST_L[x.status][2]}">${DST_L[x.status][0]} ${DST_L[x.status][1]}</span> <b>${esc(rn(x.region_id))}</b> · ${esc(x.domain)}</div><div style="margin-top:4px;white-space:pre-wrap">${esc(x.text || '')}</div><div class="dim" style="font-size:11.5px">${esc(x.by || '')} · ${fmtTs(x.updated)}</div></div>`).join('') || '<div class="dim">مشکلی گزارش نشده.</div>'}</div>`;
  m.querySelectorAll('[data-dd]').forEach(b => b.onclick = () => renderDailyAll(m, regions, +b.dataset.dd));
  m.querySelector('#dd-pick').onclick = () => JDP.open({ value: day, title: 'روز', onPick: d => d != null && renderDailyAll(m, regions, d) });
  m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const [id, d] = b.dataset.c.split('|'), c = cell({ id: +id }, d);
    m.querySelector('#dd-x').innerHTML = `<div class="dr"><div><b>${esc(rn(+id))} · ${esc(d)}</b> <span class="pill ${DST_L[c.status][2]}">${DST_L[c.status][1]}</span></div><div style="white-space:pre-wrap;margin-top:4px">${esc(c.text || 'بدون شرح')}</div><div class="dim" style="font-size:11.5px">${esc(c.by || '')} · ${fmtTs(c.updated)}</div></div>`; });
};

/* ═════ سرپرست مناطق: فهرست ارزشیابی‌ها ═════ */
window.renderEvals = async m => {
  let L; try { L = await api('/api/super/evals'); } catch (e) { return toast(e.message, true); }
  const K = { region: '👔 مدیر منطقه', staff: '👷 عوامل' };
  m.innerHTML = `<div class="card"><div class="card-h"><h2>⭐ ارزشیابی‌های پایان مأموریت (${fa(L.length)})</h2><div class="filters"><select id="ek" aria-label="نوع"><option value="">همه</option><option value="region">مدیران منطقه</option><option value="staff">عوامل (مدیر ثابت، آشپز، …)</option></select></div></div>
    <p class="hint">ارزشیابی عوامل را مدیر منطقه هنگام «🚪 خارج شد» ثبت می‌کند؛ ارزشیابی مدیر منطقه را ${esc((U_LEAD && U_LEAD()) || 'سرپرست مناطق')} هنگام تعویض او. روی هر ردیف بزنید تا پاسخ‌ها بیاید.</p>
    <div class="tbl-wrap"><table><thead><tr><th>نام</th><th>نوع</th><th>منطقه</th><th>نمره</th><th>تاریخ</th><th>ارزیاب</th></tr></thead><tbody id="ev-b"></tbody></table></div></div>`;
  const paint = () => { const k = m.querySelector('#ek').value;
    m.querySelector('#ev-b').innerHTML = L.filter(x => !k || x.kind === k).map(x => `<tr data-e="${x.id}" style="cursor:pointer"><td><b>${esc(x.name || '')}</b></td><td>${K[x.kind] || x.kind}</td><td>${esc((x.city && !(x.region || '').includes(x.city) ? x.city + ' · ' : '') + (x.region || ''))}</td><td>${scoreTag(x.score)}</td><td class="dim">${fmtTs(x.t)}</td><td class="dim">${esc(x.by || '')}</td></tr>
      <tr data-ed="${x.id}" hidden><td colspan="6"><ol style="margin:0;padding-inline-start:20px">${(JSON.parse(x.answers || '[]')).map(a => `<li>${esc(a.q)}: <b>${fa(a.v)}</b> از ۵</li>`).join('')}</ol>${x.note ? `<div style="margin-top:4px">💬 ${esc(x.note)}</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">هنوز ارزشیابی‌ای ثبت نشده.</td></tr>';
    m.querySelectorAll('[data-e]').forEach(tr => tr.onclick = () => { const d = m.querySelector(`[data-ed="${tr.dataset.e}"]`); d.hidden = !d.hidden; }); };
  m.querySelector('#ek').onchange = paint; paint();
};
let U_LEAD = null;
window.setLeadLabelFn = f => { U_LEAD = f; };

/* ═════ تنظیم حوزه‌ها و سؤال‌های ارزشیابی ═════ */
window.opsCfgCardHTML = C => `<form class="card" id="oc" novalidate><div class="card-h"><h2>📝 حوزه‌های گزارش روزانه و سؤال‌های ارزشیابی</h2></div>
  <p class="hint">هر خط یک مورد. تغییرها برای همه‌ی مناطق است. نمره‌ی ارزشیابی = میانگین پاسخ‌ها (۱ تا ۵) از ۱۰۰.</p>
  <div class="row" style="align-items:flex-start">
    <div class="field" style="flex:1 1 200px"><label class="label" for="oc-d">حوزه‌های گزارش روزانه</label><textarea id="oc-d" class="inp" rows="8">${esc(C.domains.join('\n'))}</textarea></div>
    <div class="field" style="flex:1 1 220px"><label class="label" for="oc-s">ارزشیابی عوامل (مدیر ثابت، آشپز، …)</label><textarea id="oc-s" class="inp" rows="8">${esc(C.evalStaff.join('\n'))}</textarea></div>
    <div class="field" style="flex:1 1 220px"><label class="label" for="oc-r">ارزشیابی مدیر منطقه</label><textarea id="oc-r" class="inp" rows="8">${esc(C.evalRegion.join('\n'))}</textarea></div></div>
  <button class="btn ghost" type="submit">ذخیره</button></form>`;
window.wireOpsCfg = (m, done) => { const f = m.querySelector('#oc'); if (!f) return; f.onsubmit = async e => { e.preventDefault(); const L = id => f.querySelector(id).value.split('\n').map(s => s.trim()).filter(Boolean);
  try { await api('/api/super/opscfg', { body: { domains: L('#oc-d'), evalStaff: L('#oc-s'), evalRegion: L('#oc-r') } }); OPS_CFG = null; toast('ذخیره شد.'); done && done(); } catch (x) { toast(x.message, true); } }; };

document.head.insertAdjacentHTML('beforeend', `<style>
.ev{display:flex;flex-direction:column;gap:8px}
.ev-q{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:13.5px}
.ev-s,.yn{display:inline-flex;gap:4px;flex-wrap:wrap}
.ev-s button,.yn button{border:1px solid var(--line-s);background:var(--card2);color:var(--ink);border-radius:10px;padding:6px 10px;min-width:36px;font:inherit;font-size:13px;cursor:pointer}
.ev-s button[aria-pressed="true"]{background:var(--pri,#1f6b4f);color:#fff;border-color:transparent}
.yn button[data-yn="1"][aria-pressed="true"],.yn button[data-st="ok"][aria-pressed="true"]{background:var(--ok);color:#fff;border-color:transparent}
.yn button[data-yn="0"][aria-pressed="true"],.yn button[data-st="major"][aria-pressed="true"]{background:var(--bad);color:#fff;border-color:transparent}
.yn button[data-st="minor"][aria-pressed="true"]{background:var(--warn);color:#fff;border-color:transparent}
.yn button[data-st="na"][aria-pressed="true"]{background:var(--dim);color:#fff;border-color:transparent}
.ev-sc{font-size:13px}
.occ-g{display:grid;grid-template-columns:auto 1fr 1.3fr;gap:6px 10px;align-items:center;margin-top:8px}
.occ-g b{font-size:12px;color:var(--dim)} .occ-g input{max-width:140px}
.occ-log{margin:6px 0 0;padding-inline-start:18px;font-size:12.5px;line-height:1.9}
.occ-diff{color:var(--bad)}
.meal{border:1px solid var(--line);border-radius:12px;padding:10px;margin-top:10px;display:flex;flex-direction:column;gap:6px}
.meal h3{margin:0;font-size:14.5px}
.mi{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:13.5px;padding:4px 0;border-bottom:1px dashed var(--line)}
.dr{border:1px solid var(--line);border-radius:12px;padding:10px;margin-top:8px;display:flex;flex-direction:column;gap:6px}
.dmx td,.dmx th{text-align:center} .dmx td:first-child,.dmx th:first-child{text-align:start}
.dmc{border:0;background:none;font-size:17px;cursor:pointer}
.linkish{border:0;background:none;color:var(--ink);text-decoration:underline;cursor:pointer;font:inherit;padding:0}
</style>`);
