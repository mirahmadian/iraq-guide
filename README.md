# 🕌 راهنمای کاروان عراق

وب‌اپلیکیشن راهنمای دیجیتال برای مدیران کاروان‌های ایرانی در عراق.

---

## 📁 فایل‌های پروژه

```
iraq-guide/
├── index.html      ← صفحه اصلی برنامه
├── manifest.json   ← تنظیمات PWA (نصب روی گوشی)
├── sw.js           ← Service Worker (کار آفلاین)
├── icon.svg        ← آیکون برنامه
└── README.md       ← این فایل
```

---

## 🚀 راه‌اندازی روی GitHub Pages (گام به گام)

### مرحله ۱ – ساخت مخزن جدید
1. به [github.com](https://github.com) بروید و وارد حساب کاربری خود شوید
2. روی دکمه **New repository** کلیک کنید
3. نام مخزن را مثلاً `iraq-guide` بگذارید
4. گزینه **Public** را انتخاب کنید
5. روی **Create repository** کلیک کنید

### مرحله ۲ – آپلود فایل‌ها
1. در صفحه مخزن جدید روی **Add file → Upload files** کلیک کنید
2. تمام ۴ فایل را (index.html, manifest.json, sw.js, icon.svg) آپلود کنید
3. روی **Commit changes** کلیک کنید

### مرحله ۳ – فعال‌سازی GitHub Pages
1. به **Settings** مخزن بروید
2. از منوی سمت چپ **Pages** را انتخاب کنید
3. زیر **Branch** گزینه **main** را انتخاب و **Save** کنید
4. چند دقیقه صبر کنید

### مرحله ۴ – دریافت لینک
لینک برنامه به این شکل خواهد بود:
```
https://USERNAME.github.io/iraq-guide/
```
(به‌جای USERNAME نام کاربری گیتهاب خود را بگذارید)

---

## 📱 نصب روی گوشی

### اندروید (Chrome)
- صفحه را باز کنید → منوی سه‌نقطه → **Add to Home screen**

### آیفون (Safari)
- صفحه را در Safari باز کنید → آیکون Share → **Add to Home Screen**

---

## ➕ اضافه کردن اطلاعات جدید

برای افزودن شماره تماس یا ستاد جدید، فایل `index.html` را ویرایش کنید.
هر کارت تماس از این الگو پیروی می‌کند:

```html
<div class="c-item">
  <div class="c-avatar">👤</div>
  <div class="c-info">
    <div class="c-role">عنوان سمت</div>
    <div class="c-phone">07XXXXXXXXX</div>
  </div>
  <div class="c-acts">
    <a href="tel:+964XXXXXXXXX" class="act act-call">📞</a>
    <a href="https://wa.me/964XXXXXXXXX" target="_blank" class="act act-wa">💬</a>
    <button class="act act-cp" onclick="copyNum('07XXXXXXXXX',this)">📋</button>
  </div>
</div>
```

---

## ✨ ویژگی‌ها

- 🌙 تم تاریک / روشن
- 📞 تماس مستقیم با یک لمس
- 💬 واتساپ مستقیم
- 📋 کپی شماره
- 🗺️ نقشه گوگل و نشان
- 🚨 شماره‌های اورژانسی
- 📲 قابل نصب به عنوان اپ
- 📡 کار بدون اینترنت (آفلاین)
- 📱 QR کد داخل برنامه
