/* ══════════════════════════════════════════
   WHATSAPP — دکمه‌ی واتس‌اپ با آیکون خود واتس‌اپ
   در اندروید، گوشی ممکن است لینک را بی‌پرسش با یکی از دو برنامه (واتس‌اپ یا واتس‌اپ بیزینس) باز کند؛
   پس خودمان می‌پرسیم کدام، و همان برنامه را مستقیم باز می‌کنیم (اگر نصب نبود، لینک معمولی wa.me).
   استفاده: <a href="${waHref(num, text)}" data-wa="num" data-wa-text="..." onclick="return waClick(this)">
══════════════════════════════════════════ */
const WA_SVG = '<svg class="wa-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
const waAndroid = /Android/i.test(navigator.userAgent);
const waHref = (num, text) => 'https://wa.me/' + (num || '') + (text ? '?text=' + encodeURIComponent(text) : '');
function waIntent(pkg, num, text) {
  const q = [num ? 'phone=' + num : '', text ? 'text=' + encodeURIComponent(text) : ''].filter(Boolean).join('&');
  return 'intent://send?' + q + '#Intent;scheme=whatsapp;package=' + pkg + ';S.browser_fallback_url=' + encodeURIComponent(waHref(num, text)) + ';end';
}
function waClick(a) {
  if (!waAndroid) return true;   /* آیفون و کامپیوتر: همان لینک معمولی */
  const num = a.dataset.wa || '', text = a.dataset.waText || '';
  let v = document.getElementById('waOverlay');
  if (!v) {
    document.body.insertAdjacentHTML('beforeend', `<div class="overlay" id="waOverlay" role="dialog" aria-modal="true" aria-label="انتخاب واتس‌اپ" onclick="if(event.target===this)waClose()"><div class="modal" id="waBox"></div></div>
    <style>
      .wa-ch{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:0 16px;margin-bottom:10px;border-radius:14px;border:none;color:#fff;
        font-family:var(--font);font-size:calc(15px * var(--fs,1));font-weight:800;text-decoration:none;cursor:pointer}
      .wa-ch .wa-ic{width:26px;height:26px}
      .wa-ch.n{background:#25D366}.wa-ch.b{background:#128C7E}
      .wa-ch small{display:block;font-size:calc(11.5px * var(--fs,1));font-weight:600;opacity:.9}
    </style>`);
    v = document.getElementById('waOverlay');
  }
  document.getElementById('waBox').innerHTML = `<div class="modal-handle" aria-hidden="true"></div>
    <div class="modal-title">با کدام واتس‌اپ باز شود؟</div>
    <a class="wa-ch n" href="${waIntent('com.whatsapp', num, text)}" onclick="waClose()">${WA_SVG}<span>واتس‌اپ<small>برنامه‌ی معمولی</small></span></a>
    <a class="wa-ch b" href="${waIntent('com.whatsapp.w4b', num, text)}" onclick="waClose()">${WA_SVG}<span>واتس‌اپ بیزینس<small>WhatsApp Business</small></span></a>
    <button class="modal-close" onclick="waClose()">بستن</button>`;
  v.classList.add('open');
  return false;
}
function waClose() { const v = document.getElementById('waOverlay'); if (v) v.classList.remove('open'); }
document.head.insertAdjacentHTML('beforeend', '<style>.wa-ic{width:1.35em;height:1.35em;flex-shrink:0}</style>');
