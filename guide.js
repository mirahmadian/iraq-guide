/* ══════════════════════════════════════════
   GUIDE — «راهنمای زائر»: توصیه‌ها، وسایل ممنوع، جملات عربی (همه از پنل مدیریت قابل ویرایش)
   CARAVAN_DATA.guide = { title, sections: [{ id, icon, title, hidden, type: ''|'phrases',
     items: [{ t, d }]  یا برای جملات: [{ g: گروه, fa, ar, pr: تلفظ }] }] }
══════════════════════════════════════════ */
(function injectGuideCSS() {
  const css = `
  .gd-sec{margin-top:10px;border-radius:16px;background:var(--card);border:1px solid var(--border-s);overflow:hidden}
  .gd-sec summary{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 14px;cursor:pointer;list-style:none}
  .gd-sec summary::-webkit-details-marker{display:none}
  .gd-sec summary .ic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:22px;background:var(--card2);flex-shrink:0}
  .gd-sec summary b{flex:1;font-size:calc(15.5px * var(--fs,1));font-weight:900}
  .gd-sec summary small{font-size:calc(12px * var(--fs,1));color:var(--muted);font-weight:700}
  .gd-sec summary .chev{transition:transform .2s;color:var(--dim)}
  .gd-sec[open] summary .chev{transform:rotate(-90deg)}
  .gd-items{padding:0 14px 8px}
  .gd-item{padding:12px 0;border-top:1px solid var(--border)}
  .gd-item b{display:block;font-size:calc(14.5px * var(--fs,1));font-weight:900;margin-bottom:2px}
  .gd-item p{margin:0;font-size:calc(14px * var(--fs,1));line-height:2;color:var(--text)}
  .gd-g{font-size:calc(12.5px * var(--fs,1));font-weight:800;color:var(--brass);padding:12px 0 2px;border-top:1px solid var(--border)}
  .gd-ph{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px dashed var(--border)}
  .gd-g + .gd-ph{border-top:none}
  .gd-ph .tx{flex:1;min-width:0}
  .gd-ph .fa{display:block;font-size:calc(13px * var(--fs,1));color:var(--muted);font-weight:700}
  .gd-ph .ar{display:block;font-size:calc(19px * var(--fs,1));font-weight:900;line-height:1.7}
  .gd-ph .pr{display:block;font-size:calc(13px * var(--fs,1));color:var(--pri-ink);font-weight:700}
  .gd-say{width:42px;height:42px;border-radius:50%;border:1px solid var(--border-s);background:var(--card2);font-size:18px;cursor:pointer;flex-shrink:0}
  .gd-say.on{background:var(--gold);border-color:var(--gold)}
  .gd-hid{display:block;font-size:calc(11px * var(--fs,1));color:var(--c-clinic);font-weight:800;line-height:1.6}
  .gd-note{font-size:calc(12px * var(--fs,1));color:var(--dim);line-height:1.9;margin:12px 4px 0}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

function guide() { return CARAVAN_DATA.guide || { sections: [] }; }
function guideSections() { return (guide().sections || []).filter(s => (s.items || []).length && (!s.hidden || SHOW_HIDDEN)); }
function guideVisible() { return guideSections().length > 0; }

function guideSecHTML(s, i) {
  const n = (s.items || []).length, ph = s.type === 'phrases';
  let body = '';
  if (ph) {
    let g = null;
    s.items.forEach((x, k) => {
      if (x.g && x.g !== g) { g = x.g; body += `<div class="gd-g">${escHtml(g)}</div>`; }
      body += `<div class="gd-ph"><span class="tx"><span class="fa">${escHtml(x.fa || '')}</span><span class="ar" lang="ar" dir="rtl">${escHtml(x.ar || '')}</span>${x.pr ? `<span class="pr">${escHtml(x.pr)}</span>` : ''}</span>
        <button class="gd-say" onclick="guideSay(${i},${k},this)" aria-label="پخش تلفظ عربی">🔊</button></div>`;
    });
  } else {
    body = s.items.map(x => `<div class="gd-item">${x.t ? `<b>${escHtml(x.t)}</b>` : ''}<p>${richText(x.d || '')}</p></div>`).join('');
  }
  return `<details class="gd-sec" ${guideSections().length === 1 ? 'open' : ''}>
    <summary><span class="ic" aria-hidden="true">${escHtml(s.icon || '📄')}</span><b>${escHtml(s.title || '')}${s.hidden ? '<span class="gd-hid">پنهان از کاربران</span>' : ''}</b>
      <small>${faDigits(n)} ${ph ? 'جمله' : 'مورد'}</small><span class="chev" aria-hidden="true">${CHEV_BACK}</span></summary>
    <div class="gd-items">${body}</div></details>`;
}
function openGuide() {
  const secs = guideSections();
  openPage('📘 ' + (guide().title || 'راهنمای زائر'), secs.length
    ? secs.map(guideSecHTML).join('') + `<p class="gd-note">برای باز کردن هر بخش، روی آن بزنید. همه مطالب بدون اینترنت هم در دسترس است.</p>`
    : '<div class="sr-empty">مطلبی ثبت نشده است</div>');
}

/* خواندن جمله عربی با صدای خود گوشی (بدون اینترنت، اگر صدای عربی نصب باشد) */
function guideSay(i, k, btn) {
  const x = ((guideSections()[i] || {}).items || [])[k];
  if (!x || !('speechSynthesis' in window)) return showToast('این گوشی امکان خواندن متن را ندارد');
  const voices = speechSynthesis.getVoices(), v = voices.find(v => /^ar/i.test(v.lang));
  if (voices.length && !v) return showToast('صدای عربی روی این گوشی نصب نیست — از روی تلفظ فارسی بخوانید', 3500);
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(x.ar);
  u.lang = v ? v.lang : 'ar-SA'; if (v) u.voice = v; u.rate = 0.85;
  document.querySelectorAll('.gd-say.on').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  u.onend = u.onerror = () => btn.classList.remove('on');
  speechSynthesis.speak(u);
}
if ('speechSynthesis' in window) speechSynthesis.getVoices();
