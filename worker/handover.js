/* پرونده‌ی فنی سامانه‌های همیار کاروان — برای برنامه‌نویس یا هوش مصنوعی دیگری که روزی بدون Claude باید کمک کند.
   در پنل مدیریت ← آمار ← «🆘 بسته‌ی نجات» همراه وضعیت زنده‌ی سامانه‌ها نشان داده و دانلود می‌شود (guard.js → /admin/guard/report).
   مخزن عمومی است: هیچ رمز، توکن یا کلیدی اینجا ننویسید؛ فقط «کجاست». هر تغییر مهمی در ساختار سامانه، اینجا هم به‌روز شود. */
export const HANDOVER = `
# پرونده‌ی فنی سامانه‌های «همیار کاروان»

> **به هوش مصنوعی یا برنامه‌نویسی که این را می‌خواند:** صاحب این سامانه‌ها برنامه‌نویس نیست. همه‌چیز را تا امروز Claude (Anthropic) ساخته و نگه داشته است.
> لطفاً ساده و قدم‌به‌قدم توضیح بده، هر فرمان را دقیق بنویس و بگو کجا اجرا شود. پیش از هر کار برگشت‌ناپذیر (پاک کردن، بازنویسی داده) از او تأیید بگیر.
> هیچ‌وقت از او نخواه رمز یا توکن را در گفتگو بنویسد؛ اگر دسترسی لازم است، او باید تو را در همان سرویس «دعوت» کند.
> (English: the owner is non-technical. Explain step by step, never ask for secrets in chat, confirm before destructive actions.)

## ۱. نقشه‌ی سامانه‌ها

| بخش | کجاست | کد |
|---|---|---|
| برنامه‌ی زائران (PWA) و پنل مدیریت | GitHub Pages: https://mirahmadian.github.io/iraq-guide/ و admin.html | مخزن GitHub عمومی mirahmadian/iraq-guide (شاخه‌ی main) |
| داده‌ی برنامه (هتل‌ها، غذا، اطلاعیه‌ها، …) | فایل data.js در همان مخزن؛ پنل مدیریت با کلید GitHub مدیر اصلی مستقیم commit می‌کند | admin*.js |
| نظرات زائران، حساب همکاران پنل، بازوی بله، نگهبان سرور، پشتیبان‌ها | Cloudflare Worker به نام hamyar-reviews (https://hamyar-reviews.hamyar-karevan.workers.dev) | worker/reviews.js, staff.js, bale.js, guard.js — تنظیمات: worker/wrangler.toml |
| سامانه‌ی «نواقص هتل‌ها» (مدیران ثابت و منطقه، team.html) | Cloudflare Worker به نام hamyar-team (https://hamyar-team.hamyar-karevan.workers.dev) — از ۱۵ آبان ۱۴۰۵ | worker/team-api/index.js — تنظیمات: worker/team-api/wrangler.toml |
| سامانه‌ی چاپ و بسته‌بندی، سامانه‌ی بیمه | سرور شخصی 188.121.118.223 (آروان‌کلود، تهران، Ubuntu 24.04) | فقط روی خود سرور: /opt/packaging و /opt/bime |

پایگاه‌های داده‌ی Cloudflare (D1):
- hamyar-reviews (binding: DB) — نظرات، حساب همکاران، تنظیمات (جدول config)، گزارش خطاها (errlog)
- hamyar-backups (BKDB) — نسخه‌های پشتیبان سرور و سامانه‌ی نواقص هتل‌ها (جدول‌های files و chunks)
- hamyar-hotels (DB در hamyar-team، HDB در hamyar-reviews) — داده‌ی سامانه‌ی نواقص هتل‌ها؛ طرح جدول‌ها: worker/team-api/schema.sql
- hamyar-hotels-media (MDB) — تکه‌های عکس و فیلم نواقص (۷ روز نگه داشته می‌شوند)

رازها (Secrets) — مقدارشان فقط در داشبورد Cloudflare (Workers → نام worker → Settings → Variables) است، نه در کد:
- hamyar-reviews: BALE_TOKEN (توکن بازوی بله)، BALE_HOOK، BACKUP_KEY (کلید گرفتن پشتیبان از سرور)، SALT
- hamyar-team: MEDIA_KEY (امضای پیوند عکس‌ها)

کارهای خودکار:
- هر ۵ دقیقه: نگهبان (guard.js) سلامت سامانه‌ها را می‌سنجد، پشتیبان سرور را می‌کشد، هشدار بله می‌فرستد؛ ساعت ۹ صبح تهران گزارش روزانه
- هر روز: پشتیبان کامل داده‌ی سامانه‌ی نواقص هتل‌ها در hamyar-backups (۳۵ روز)
- هر ساعت (hamyar-team): پاک کردن عکس و فیلم‌های قدیمی‌تر از ۷ روز
- GitHub Actions: version.yml (بالا بردن نسخه‌ی sw.js و version.js بعد از هر push)، rate.yml (نرخ ارز هر ۳ ساعت)

## ۲. حساب‌ها (مالک همه: صاحب برنامه)
- **GitHub** (کاربر mirahmadian): کد و داده‌ی برنامه. برای کمک گرفتن: Settings مخزن → Collaborators → دعوت برنامه‌نویس.
- **Cloudflare** (زیردامنه‌ی workers: hamyar-karevan): workerها و پایگاه‌های D1. برای کمک: Manage Account → Members → دعوت.
- **آروان‌کلود (ArvanCloud)**: سرور 188.121.118.223. از پنل آروان «کنسول» سرور باز می‌شود (حتی وقتی SSH کار نمی‌کند).
- **بله**: بازوی @HamyarKaravan_Bot (توکنش از BotFather بله). هشدارهای نگهبان به گفتگوی مدیر اصلی با همین بازو می‌آید.

## ۳. فرمان‌های رایج (روی رایانه‌ای با Node.js، داخل پوشه‌ی مخزن)
\`\`\`
git clone https://github.com/mirahmadian/iraq-guide && cd iraq-guide
export CLOUDFLARE_API_TOKEN=...   # توکن API از داشبورد Cloudflare (My Profile → API Tokens)، با دسترسی Workers و D1
cd worker && npx wrangler@3 deploy                 # انتشار hamyar-reviews
cd worker/team-api && npx wrangler@3 deploy        # انتشار hamyar-team
npx wrangler@3 tail hamyar-team                    # دیدن خطاهای زنده
npx wrangler@3 d1 execute hamyar-hotels --remote --command "select count(*) from users"
\`\`\`
- برنامه و پنل مدیریت فایل‌های ساده‌اند: تغییر در مخزن → push به main → چند دقیقه بعد روی GitHub Pages است.
- سرور: \`ssh ubuntu@188.121.118.223\` (کلید یا رمز را صاحب سرور دارد) — یا کنسول آروان.

## ۴. مشکل‌های محتمل و راه حل

| نشانه | علت محتمل | چه کنیم |
|---|---|---|
| هشدار بله «سامانه‌ی نواقص هتل‌ها جواب نمی‌دهد» | Cloudflare مشکل دارد یا سقف رایگان روزانه پر شده (۱۰۰ هزار درخواست، خطای 1027/429) | https://www.cloudflarestatus.com را ببینید؛ سقف رایگان نیمه‌شب UTC (۳:۳۰ بامداد تهران) صفر می‌شود؛ در صورت تکرار: طرح Workers Paid (۵ دلار در ماه) |
| team.html برای همه خطا می‌دهد ولی Cloudflare سالم است | آخرین تغییر کد | در داشبورد Cloudflare → Workers → hamyar-team → Deployments → نسخه‌ی قبلی را Rollback کنید |
| هشدار «چاپ و بسته‌بندی» یا «بیمه» قطع است | سرور خاموش، پر شدن دیسک، یا فیلترینگ ایران (از بیرون ایران قطع ولی داخل ایران سالم) | اول از اینترنت داخل ایران http://188.121.118.223/chap را باز کنید. اگر داخل هم باز نشد: کنسول آروان → \`sudo systemctl status packaging bime nginx postgresql\`، \`df -h\`، \`sudo reboot\` |
| «پشتیبان تازه گرفته نشده» | ارتباط Cloudflare با سرور ایران قطع است | خطرناک نیست؛ سرور خودش هر ساعت روی دیسک خودش پشتیبان می‌گیرد (/var/backups/hamyar) |
| پنل مدیریت «انتشار» نمی‌کند | کلید GitHub منقضی شده | در GitHub → Settings → Developer settings → Fine-grained tokens یک کلید تازه با دسترسی Contents (read/write) روی همین مخزن بسازید و در پنل وارد کنید |
| برنامه‌ی زائران به‌روز نمی‌شود | حافظه‌ی پنهان (service worker) | Actions مخزن را ببینید که version.yml موفق بوده؛ کاربر برنامه را یک بار کامل ببندد و باز کند |
| هشدارها در بله نمی‌آید | توکن بازو عوض شده یا گفتگوی مدیر ثبت نشده | راز BALE_TOKEN در hamyar-reviews؛ مقدار owner_chat در جدول config |
| گواهی https سرور منقضی | certbot تمدید نکرده | روی سرور: \`sudo certbot renew && sudo systemctl reload nginx\` |

## ۵. پشتیبان‌ها و برگرداندن
- **سامانه‌ی نواقص هتل‌ها:** روزانه، در hamyar-backups با نام team/<زمان> (فایل json.gz). دانلود از پنل مدیریت → آمار. برگرداندن:
  \`node worker/team-api/restore.mjs فایل.json.gz > restore.sql\` و بعد \`npx wrangler@3 d1 execute hamyar-hotels --remote --file restore.sql\`.
  همچنین Cloudflare D1 «Time Travel» دارد: \`npx wrangler@3 d1 time-travel restore hamyar-hotels --timestamp=...\`
- **سرور 188:** اسکریپت /usr/local/bin/hamyar-backup (ساعتی: پایگاه‌های داده؛ شبانه: کامل با کد برنامه‌ها و تنظیمات nginx/systemd) در /var/backups/hamyar؛ نسخه‌ای هم در hamyar-backups. **قدم‌های برگرداندن روی سرور تازه در انتهای همان اسکریپت نوشته شده.**
- **برنامه و داده‌ی زائران:** همه در تاریخچه‌ی Git است؛ هر نسخه‌ی قبلی data.js قابل برگشت است.

## ۶. قواعد ایمنی
- هیچ توکن، رمز یا کلیدی را در مخزن (عمومی است) یا در گفتگو ننویسید.
- پیش از تغییر روی سرور، از فایل تنظیمات نسخه بگیرید (\`sudo cp فایل /root/فایل.before-…\`).
- داده‌ی واقعی را گروهی پاک نکنید؛ برای آزمایش، داده‌ی آزمایشی جدا بسازید و بعد همان را پاک کنید.
- شماره تلفن یا IP خام کاربران را ذخیره نکنید.
`;

/* راهنمای ساده برای خود مدیر (در همان کارت پنل هم نشان داده می‌شود) */
export const OWNER_STEPS = `
## اگر Claude در دسترس نبود، چه کنم؟
1. **آرام باشید.** از همه‌ی داده‌ها پشتیبان گرفته می‌شود و چیزی از دست نمی‌رود.
2. اگر در بله هشدار «قطع است» آمد، **نیم ساعت صبر کنید**؛ بیشتر قطعی‌ها خودشان درست می‌شوند (پیام «دوباره وصل شد» می‌آید).
3. اگر درست نشد: پنل مدیریت → تب «آمار» → «🆘 بسته‌ی نجات» → دکمه‌ی **«کپی گزارش برای کمک»**.
4. متن کپی‌شده را **عیناً** برای یکی از این‌ها بفرستید:
   - یک هوش مصنوعی دیگر (ChatGPT، Gemini، DeepSeek یا Claude در سایت claude.ai) و بنویسید: «سامانه‌ام مشکل دارد، این گزارش آن است. قدم‌به‌قدم و ساده کمکم کن.»
   - یا یک برنامه‌نویس مورد اعتماد.
5. **هرگز رمزها را در گفتگو ننویسید.** اگر برنامه‌نویس دسترسی خواست، او را در خود GitHub یا Cloudflare «دعوت» کنید (در پرونده‌ی فنی نوشته شده کجا) و بعد از پایان کار دعوت را بردارید.
6. اگر پنل مدیریت هم باز نشد: نسخه‌ی دانلودشده‌ی «پرونده‌ی کامل» را که از قبل نگه داشته‌اید بفرستید.

**همین حالا یک بار «دانلود پرونده‌ی کامل» را بزنید** و فایل را در گوشی، رایانه و ایمیل خودتان نگه دارید؛ و رمز این چهار حساب را روی کاغذ جای امن بگذارید: GitHub، Cloudflare، آروان‌کلود، بله.
`;
