/* 👁️ دکمه‌ی چشم برای همه‌ی خانه‌های رمز (پنل مدیریت، سامانه پایش خدمات، نرخ): کاربر با زدن آن می‌بیند چه تایپ کرده است.
   هر input[type=password] که در صفحه هست یا بعداً ساخته می‌شود خودکار دکمه می‌گیرد. */
(() => {
  const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function add(inp) {
    if (inp.dataset.pwEye) return; inp.dataset.pwEye = '1';
    const w = document.createElement('span'); w.className = 'pw-wrap';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pw-eye';
    const set = show => { inp.type = show ? 'text' : 'password'; b.innerHTML = show ? EYE_OFF : EYE; b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'پنهان کردن رمز' : 'نمایش رمز'); b.title = show ? 'پنهان کردن رمز' : 'نمایش رمز'; };
    b.onmousedown = e => e.preventDefault();   /* فوکوس در خانه‌ی رمز بماند */
    b.onclick = () => { const p = inp.selectionStart, q = inp.selectionEnd; set(inp.type === 'password'); inp.focus(); try { inp.setSelectionRange(p, q); } catch (e) {} };
    set(false); w.appendChild(b);
  }
  const scan = root => { if (root.matches && root.matches('input[type=password]')) add(root); if (root.querySelectorAll) root.querySelectorAll('input[type=password]').forEach(add); };
  const init = () => {
    scan(document);
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && scan(n)))).observe(document.body, { childList: true, subtree: true });
  };
  document.head.insertAdjacentHTML('beforeend', `<style>
    .pw-wrap{position:relative;display:block;width:100%}
    .pw-wrap>input{width:100%;box-sizing:border-box;padding-left:44px !important}
    .pw-eye{position:absolute;left:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:inherit;opacity:.65;cursor:pointer;padding:0}
    .pw-eye:hover,.pw-eye[aria-pressed="true"]{opacity:1}
    .pw-eye:focus-visible{outline:2px solid currentColor;outline-offset:1px}
  </style>`);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
