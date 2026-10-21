/* ══════════════════════════════════════════
   FOOD PLAN ADMIN — مدیریت برنامه غذایی، دورچین و آنالیز
══════════════════════════════════════════ */
(function injectFoodAdminCSS() {
  const css = `
  .fp-body{padding:12px 16px 16px;display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--border)}
  .fp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media(max-width:600px){.fp-grid{grid-template-columns:1fr}}
  .fsel-a{width:100%;border:1px solid var(--border-s);border-radius:8px;padding:9px 8px;font-family:var(--font);font-size:13px;background:var(--bg);color:var(--text)}
  .fchk{display:flex;align-items:center;gap:6px;font-size:12.5px;padding:9px 0;cursor:pointer}
  .fgrades{display:flex;flex-wrap:wrap;gap:6px}
  .fg{display:inline-flex;align-items:center;padding:7px 14px;border:1.5px solid var(--border-s);border-radius:100px;font-size:12.5px;font-weight:700;cursor:pointer;background:var(--bg);color:var(--muted)}
  .fg input{display:none}
  .fg.on{background:var(--gold);color:#fff;border-color:var(--gold)}
  .fdays-a{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:12px}
  .fdays-a button{padding:9px 2px;border:1.5px solid var(--border-s);border-radius:9px;background:var(--bg);font-family:var(--font);font-size:12px;font-weight:800;cursor:pointer;color:var(--muted)}
  .fdays-a button.on{background:var(--gold);color:#fff;border-color:var(--gold)}
  .fmeals-a{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}
  @media(max-width:900px){.fmeals-a{grid-template-columns:1fr}}
  .fm-a{border:1px solid var(--border-s);border-top:3px solid #D9801A;border-radius:12px;padding:10px 12px;background:var(--card)}
  .fm-lunch{border-top-color:#2E7D5E}.fm-dinner{border-top-color:#4F5BB5}
  .fm-a-title{font-weight:800;font-size:13.5px}
  .fm-a .field-label{margin:9px 0 5px}
  .fside{display:flex;gap:5px;margin-bottom:5px}
  .fside input{padding:8px 10px;font-size:12.5px}
  .fs-n{flex:1;min-width:0}
  .fs-q{width:92px;flex-shrink:0}
  .fs-x{width:30px;flex-shrink:0;border:1px solid rgba(231,76,60,.3);border-radius:7px;background:var(--red-bg);color:var(--red);cursor:pointer}
  .fs-add{margin:4px 0 0 !important;width:100% !important}
  .fta{width:100%;height:auto;min-height:110px;background:var(--bg);color:var(--text);border:1px solid var(--border-s);border-radius:8px;
    font-family:var(--font);font-size:13px;direction:rtl;padding:9px 12px;resize:vertical;line-height:1.9}
  .fp-st{font-size:10.5px;padding:2px 8px;border-radius:6px;background:var(--red-bg);color:var(--red);font-weight:700;flex-shrink:0}
  .fp-st.on{background:var(--gold-dim);color:var(--gold)}
  .fswitch{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;font-size:13px}
  .fswitch input{display:none}
  .fsw-track{width:48px;height:28px;border-radius:100px;background:#c9c9c9;position:relative;flex-shrink:0;transition:background .2s}
  .fsw-dot{position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:right .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
  .fswitch input:checked + .fsw-track{background:var(--gold)}
  .fswitch input:checked + .fsw-track .fsw-dot{right:23px}
  .fdishes{display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px 4px}
  .fdish{display:inline-flex;align-items:center;gap:6px;padding:5px 6px 5px 12px;border:1px solid var(--border-s);border-radius:100px;font-size:12.5px;background:var(--bg)}
  .fdish button{border:none;background:var(--red-bg);color:var(--red);width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:10px}
  .frow-add{display:flex;gap:6px;padding:8px 16px 14px}
  .frow-add input{flex:1}
  .frow-add .add-row-btn{margin:0;width:auto;white-space:nowrap}
  .fing{display:grid;grid-template-columns:1.6fr 80px 90px 1.3fr 30px;gap:5px;margin-bottom:5px}
  .fing input{padding:8px 10px;font-size:12.5px;min-width:0}
  @media(max-width:600px){.fing{grid-template-columns:1fr 70px 80px 30px}.fing .fi-note{grid-column:1/4}}
  .fing-h{font-size:10.5px;color:var(--dim);font-weight:700}
  .fitems{padding:10px 16px 4px}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const FOOD_TYPES_A = { normal: 'عادی', economic: 'اقتصادی' };
const FOOD_MEALS_A = [['breakfast', '🌅 صبحانه'], ['lunch', '☀️ ناهار'], ['dinner', '🌙 شام']];
const FOOD_DAYS_A = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];
const RECIPE_KINDS = { breakfast: 'صبحانه گرم', salad: 'سالاد و ماست', other: 'سایر' };
const FOOD_GRADES_DEFAULT = ['1ب', '1ج', '2الف', '2ب', '2ج', '3الف', '3ب', '3ج'];

/* ══════════ داده اولیه (از فایل‌های ابلاغی شهریور و مهر ۱۴۰۵) ══════════ */
const DEFAULT_FOOD = (() => {
  const S = str => str.split('|').map(x => { const [name, q] = x.split(':'); return { name: name.trim(), q: (q || '').trim() }; });
  const day = (hot, bs, lMain, ls, lf, dMain, ds, df) => ({
    breakfast: { hot, sides: S(bs) },
    lunch: { main: lMain, sides: S(ls), fruit: lf },
    dinner: { main: dMain, sides: S(ds), fruit: df }
  });
  const I = (name, amount, unit, note) => ({ name, amount, unit: unit || '', note: note || '' });

  // عادی — مهر ۱۴۰۵
  const B1 = 'پنیر تک نفره:2 عدد|کره:60%|عسل:80%|مربا:60%|نان:2 عدد|چای|شیر تک نفره:80%|شیره ارده:70%|شیره خرما:70%';
  const B2 = 'گوجه اسلایس شده|' + B1;
  const B6 = 'گوجه اسلایس شده|خیار اسلایس شده|' + B1;
  const L = 'ماست تک نفره|پیاز متوسط|نان:50%|نوشابه:110%|دوغ:10%';
  const L2 = 'ماست و خیار|پیاز متوسط|نان:50%|نوشابه:110%|دوغ:10%';
  const L5 = 'سالاد شیرازی|خرما|پیاز متوسط|نان:50%|نوشابه:110%|دوغ:10%';
  const T = 'لیمو ترش:50%|پیاز متوسط|نان:70%|زیتون سیاه:40 گرم|نوشابه:110%|دوغ:10%';

  // اقتصادی — شهریور ۱۴۰۵
  const EB1 = 'پنیر تک نفره|کره|مربا|نان|چای';
  const EB2 = 'گوجه اسلایس شده|پنیر تک نفره|کره|مربا|نان|چای|شیره ارده';
  const EB3 = 'پنیر تک نفره|کره|مربا|نان|چای|شیره ارده';
  const EB5 = 'گوجه اسلایس شده|پنیر تک نفره|کره|عسل|مربا|نان|چای|شیره ارده|شیره خرما';
  const EB6 = 'گوجه اسلایس شده|خیار اسلایس شده|پنیر تک نفره|کره|مربا|نان|چای|شیره ارده';
  const EL = 'ماست تک نفره|پیاز|نان|نوشابه';

  const normalNotes = [
    'سرانه پنیر تک‌نفره ۳۰ گرمی ۲ عدد است.',
    'سرانه نان در صبحانه ۲ عدد، در ناهار ۵۰٪ و در شام ۷۰٪ است.',
    'سرانه مربای تک‌نفره ۲۰ گرمی (دو نوع مربا) ۶۰٪ است (۳۰٪ + ۳۰٪).',
    'سرانه شیره ارده ۳۰ گرمی و شیره خرما ۲۰ گرمی، هر کدام ۷۰٪ است.',
    'سرانه عسل ۲۰ گرمی ۸۰٪ است.',
    'سرانه کره ۱۰ گرمی ۶۰٪ است.',
    'سرانه تخم‌مرغ در املت ۱ عدد و در حالت آبپز ۱٫۵ عدد است.',
    'سرانه شیر ۱۲۵ میلی‌لیتری در صبحانه ۸۰٪ است.',
    'سرانه نوشابه و دوغ در هر وعده ناهار و شام: ۱۱۰٪ نوشابه + ۱۰٪ دوغ.',
    'سرانه لیمو ترش در وعده شام ۵۰٪ (نصف لیمو) است.',
    'زیتون سیاه به مقدار ۴۰ گرم و فقط در وعده شام است.',
    'سرانه میوه در هر وعده غذایی ۱۰۰٪ است (یک وعده در ناهار و یک وعده در شام).',
    'در صبحانه سفری، در صورت استفاده از کیک با وزن کمتر، باید به تعداد کیک اضافه شود.'
  ].join('\n');

  const per100 = 'برای هر کاروان ۱۰۰٪ باید در نظر گرفته شود.';

  return {
    enabled: false,
    grades: FOOD_GRADES_DEFAULT.slice(),
    plans: [
      {
        id: 'p-normal-1', title: 'کاروان‌های عادی — هتل درجه ۱', caravanType: 'normal', grades: ['1ب', '1ج'],
        period: 'اجرا از مهر ۱۴۰۵', active: true, notes: normalNotes,
        days: [
          day('املت گوجه فرنگی', B1, 'باقلا پلو با گوشت', L, 'پرتقال', 'کوبیده مرغ با برنج (۵۰٪)', 'سالاد کاهو|' + T, 'موز'),
          day('تخم مرغ آبپز', B2, 'زرشک پلو با مرغ', L2, 'میوه فصل', 'کباب کوبیده گوشت با برنج (۵۰٪)', 'سالاد کلم|' + T, 'سیب'),
          day('نیمرو', B1, 'چلو خورشت قورمه سبزی', L, 'پرتقال', 'خوراک شنیسل مرغ', 'سالاد شیرازی|سس کچاپ|' + T, 'موز'),
          day('املت گوجه فرنگی', B1, 'چلو خورشت قیمه بادمجان', L, 'پرتقال', 'جوجه کباب با برنج (۵۰٪)', 'سالاد کاهو|سس مایونز|' + T, 'موز'),
          day('تخم مرغ آبپز', B2, 'سبزی پلو با ماهی', L5, 'میوه فصل', 'کباب کوبیده گوشت با برنج (۵۰٪)', 'سالاد کلم|' + T, 'سیب'),
          day('عدسی', B6, 'چلو خورشت قورمه سبزی', L, 'پرتقال', 'جوجه کباب با برنج (۵۰٪)', 'ماست و خیار|سس کچاپ|' + T, 'موز')
        ]
      },
      {
        id: 'p-economic', title: 'کاروان‌های اقتصادی', caravanType: 'economic', grades: [],
        period: 'ابلاغی شهریور ۱۴۰۵', active: true, notes: '',
        days: [
          day('املت گوجه فرنگی', EB1, 'لوبیا پلو', EL, 'پرتقال', 'کوبیده مرغ با برنج', 'سالاد کاهو|سس مایونز|لیمو ترش|پیاز|نان|دوغ', 'موز'),
          day('تخم مرغ آبپز', EB2, 'زرشک پلو با مرغ', 'ماست و خیار|پیاز|نان|نوشابه', 'سیب', 'آدانا کباب با برنج', 'سالاد کلم|لیمو ترش|پیاز|نان|سس کچاپ|دوغ', 'میوه فصل'),
          day('نیمرو', EB3, 'چلو خورشت قورمه سبزی', EL, 'پرتقال', 'عدس پلو با گوشت', 'سالاد شیرازی|نان|دوغ', 'موز'),
          day('املت گوجه فرنگی', EB1, 'چلو خورشت قیمه بادمجان', EL, 'پرتقال', 'جوجه کباب با برنج', 'سالاد کاهو|سس مایونز|لیمو ترش|پیاز|نان|سس کچاپ|دوغ', 'موز'),
          day('تخم مرغ آبپز', EB5, 'استامبولی', 'سالاد شیرازی|نان|نوشابه', 'میوه فصل', 'شنیسل مرغ با برنج', 'سالاد کلم|لیمو ترش|پیاز|نان|سس کچاپ|دوغ', 'سیب'),
          day('عدسی', EB6, 'چلو خورشت قورمه سبزی', EL, 'پرتقال', 'جوجه کباب با برنج', 'ماست و خیار|لیمو ترش|پیاز|نان|دوغ', 'میوه فصل')
        ]
      }
    ],
    items: [
      ['پنیر تک نفره', '2 عدد'], ['نان', ''], ['کره', '60%'], ['عسل', '80%'], ['مربا', '60%'], ['چای', ''],
      ['شیر تک نفره', '80%'], ['شیره ارده', '70%'], ['شیره خرما', '70%'], ['گوجه اسلایس شده', ''], ['خیار اسلایس شده', ''],
      ['ماست تک نفره', ''], ['ماست و خیار', ''], ['پیاز', ''], ['پیاز متوسط', ''], ['نوشابه', '110%'], ['دوغ', '10%'],
      ['لیمو ترش', '50%'], ['زیتون سیاه', '40 گرم'], ['سالاد کاهو', ''], ['سالاد کلم', ''], ['سالاد شیرازی', ''],
      ['سس مایونز', ''], ['سس کچاپ', ''], ['خرما', '']
    ].map(([name, q]) => ({ name, q })),
    dishes: [
      'باقلا پلو با گوشت', 'لوبیا پلو', 'زرشک پلو با مرغ', 'چلو خورشت قورمه سبزی', 'چلو خورشت قیمه بادمجان',
      'سبزی پلو با ماهی', 'استامبولی', 'عدس پلو با گوشت', 'کوبیده مرغ با برنج', 'کباب کوبیده گوشت با برنج',
      'جوجه کباب با برنج', 'آدانا کباب با برنج', 'شنیسل مرغ با برنج', 'خوراک شنیسل مرغ',
      'املت گوجه فرنگی', 'تخم مرغ آبپز', 'نیمرو', 'عدسی'
    ],
    recipes: [
      {
        id: 'r-adasi', name: 'عدسی', kind: 'breakfast',
        ingredients: [
          I('عدس', 40, 'گرم'), I('رب گوجه فرنگی', 5, 'گرم'), I('پیاز', 20, 'گرم'),
          I('کره', null, '', 'در جدول «۲۵٪» نوشته شده — بررسی شود'), I('دارچین', null, '', 'به مقدار لازم'),
          I('زردچوبه و فلفل سیاه', 5, 'گرم'), I('نمک طعام', 10, 'گرم'), I('جو پرک', 10, 'گرم')
        ],
        method: 'ابتدا عدس را به مدت دو ساعت با آب سرد خیسانده و سپس سنگ‌شویی کنید.\nنصف پیاز را چرخ کرده و به مدت ۴۵ دقیقه بجوشانید، سپس عدس را اضافه کنید.\nپیاز باقی‌مانده را نگینی سرخ کنید و پس از نرم شدن به عدسی اضافه کنید.\nسپس جو پرک را برای لعاب بیشتر اضافه کنید.\nپس از پختن عدسی، کره را با رب تفت دهید و اضافه کنید.\nدر آخر زردچوبه، فلفل و نمک اضافه شود.',
        note: per100
      },
      {
        id: 'r-omlet', name: 'املت گوجه فرنگی', kind: 'breakfast',
        ingredients: [
          I('روغن سرخ‌کردنی', 10, 'گرم'), I('گوجه فرنگی', 100, 'گرم'), I('تخم مرغ', 1, 'عدد'),
          I('رب گوجه فرنگی', 5, 'گرم'), I('نمک، زردچوبه، فلفل', null, '', 'به مقدار لازم'), I('کره حیوانی', 10, 'گرم')
        ],
        method: 'ابتدا گوجه‌فرنگی را شسته و پس از خرد کردن داخل ماهیتابه بریزید.\nپس از اینکه آب گوجه تا حدودی گرفته شد، روغن و کره را اضافه کنید و پس از داغ شدن، رب را اضافه کنید.\nبعد از تفت دادن رب و گوجه‌ها، ادویه‌ها را اضافه کنید و سپس تخم‌مرغ‌هایی را که از قبل هم زده‌اید اضافه کنید.\nکمی هم بزنید تا همه مواد خوب مخلوط شوند. بعد از ۵ دقیقه آماده سرو است.',
        note: per100
      },
      {
        id: 'r-nimroo', name: 'نیمرو', kind: 'breakfast',
        ingredients: [
          I('تخم مرغ', 1.5, 'عدد'), I('کره حیوانی', 10, 'گرم'),
          I('نمک', null, '', 'به مقدار لازم'), I('زردچوبه و فلفل', null, '', 'به مقدار لازم')
        ],
        method: 'نحوه طبخ: سلیقه زائر و آشپز.',
        note: per100
      },
      {
        id: 'r-abpaz', name: 'تخم مرغ آبپز', kind: 'breakfast',
        ingredients: [I('تخم مرغ', 1.5, 'عدد')],
        method: '',
        note: 'سرانه تخم‌مرغ در حالت آبپز ۱٫۵ عدد است (طبق توضیحات تکمیلی).'
      },
      {
        id: 'r-kalam', name: 'سالاد کلم', kind: 'salad',
        ingredients: [
          I('کلم بنفش', 20, 'گرم'), I('کلم سفید', 30, 'گرم', 'پس از آماده‌سازی'), I('ذرت شیرین', 15, 'گرم'),
          I('هویج', 25, 'گرم'), I('سس مایونز تک‌نفره', 1, 'عدد'), I('کشمش', 10, 'گرم')
        ],
        method: '', note: ''
      },
      {
        id: 'r-shirazi', name: 'سالاد شیرازی', kind: 'salad',
        ingredients: [
          I('خیار', 60, 'گرم'), I('گوجه', 50, 'گرم'), I('پیاز', 40, 'گرم'),
          I('فلفل سیاه', null, '', 'به مقدار لازم'), I('آبغوره', null, '', 'به مقدار لازم')
        ],
        method: '', note: ''
      },
      {
        id: 'r-mast-khiar', name: 'ماست و خیار', kind: 'salad',
        ingredients: [I('خیار', 30, 'گرم'), I('ماست', 100, 'گرم'), I('نعناع', null, '', 'به مقدار لازم')],
        method: '', note: ''
      },
      {
        id: 'r-safari', name: 'صبحانه سفری', kind: 'other',
        ingredients: [
          I('پنیر تک نفره', 2, 'عدد', '۳۰ گرمی'), I('کیک', 1, 'عدد', '۱۰۰ گرمی'), I('آب میوه تک نفره', 1, 'عدد', '۲۰۰ میلی‌لیتری'),
          I('نان یا صمون', 2, 'عدد', '۸۰ گرم پخته‌شده'), I('خرما بسته‌بندی شده', 1, 'عدد', '۵۰ تا ۶۰ گرمی'), I('حلوا ارده', 1, 'عدد', '۳۰ گرمی'),
          I('لیوان یک‌بار مصرف کاغذی', 1, 'عدد'), I('قاشق چای‌خوری', 1, 'عدد'), I('چای', 1, 'عدد'),
          I('قند بسته‌بندی شده', 3, 'حبه'), I('دستمال کاغذی بسته‌بندی شده', 1, 'عدد'), I('ظرف پلاستیکی', 1, 'عدد')
        ],
        method: '',
        note: 'تاریخ اجرا ۱۴۰۵/۰۷/۰۱ — در صورت استفاده از کیک با وزن کمتر، باید به تعداد کیک اضافه شود.'
      }
    ]
  };
})();

/* ══════════ STATE ══════════ */
let foodState = null;
let foodOpenPlan = -1, foodOpenRecipe = -1;
const foodCards = new Set(['plans']);
const foodDaySelA = {};

const fid = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const fe = s => escH(s == null ? '' : String(s));
const toEnA = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.');

function normFoodDay(x) {
  x = x || {};
  const sides = a => (a || []).map(s => ({ name: s.name || '', q: s.q || '' }));
  return {
    breakfast: { hot: x.breakfast?.hot || '', sides: sides(x.breakfast?.sides) },
    lunch: { main: x.lunch?.main || '', fruit: x.lunch?.fruit || '', sides: sides(x.lunch?.sides) },
    dinner: { main: x.dinner?.main || '', fruit: x.dinner?.fruit || '', sides: sides(x.dinner?.sides) }
  };
}
function normalizeFood(f) {
  return {
    enabled: !!f.enabled,
    grades: (f.grades && f.grades.length) ? f.grades : FOOD_GRADES_DEFAULT.slice(),
    plans: (f.plans || []).map(p => ({
      id: p.id || fid(), title: p.title || '', caravanType: p.caravanType || 'normal', grades: p.grades || [],
      period: p.period || '', active: p.active !== false, notes: p.notes || '',
      days: Array.from({ length: 6 }, (_, d) => normFoodDay((p.days || [])[d]))
    })),
    items: (f.items || []).map(i => ({ name: i.name || '', q: i.q || '' })),
    dishes: (f.dishes || []).slice(),
    recipes: (f.recipes || []).map(r => ({
      id: r.id || fid(), name: r.name || '', kind: r.kind || 'other',
      ingredients: (r.ingredients || []).map(i => ({ name: i.name || '', amount: i.amount == null ? '' : String(i.amount), unit: i.unit || '', note: i.note || '' })),
      method: r.method || '', note: r.note || ''
    }))
  };
}
function initFood() {
  foodState = normalizeFood(JSON.parse(JSON.stringify(CARAVAN_DATA.food || DEFAULT_FOOD)));
  renderFoodAdmin();
}
function getFoodData() {
  const f = JSON.parse(JSON.stringify(foodState));
  f.plans.forEach(p => p.days.forEach(d => ['breakfast', 'lunch', 'dinner'].forEach(m => {
    d[m].sides = d[m].sides.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), q: s.q.trim() }));
  })));
  f.recipes.forEach(r => {
    r.ingredients = r.ingredients.filter(i => i.name.trim()).map(i => {
      const a = toEnA(i.amount).trim();
      return { name: i.name.trim(), amount: a === '' || isNaN(+a) ? null : +a, unit: i.unit.trim(), note: i.note.trim() };
    });
  });
  f.items = f.items.filter(i => i.name.trim());
  f.dishes = f.dishes.filter(d => d && d.trim());
  return f;
}

/* ══════════ RENDER ══════════ */
function renderFoodAdmin() {
  const el = document.getElementById('food-admin');
  if (!el || !foodState) return;
  const f = foodState;
  const used = new Set();
  f.plans.forEach(p => p.days.forEach(d => { if (d.lunch.fruit) used.add(d.lunch.fruit); if (d.dinner.fruit) used.add(d.dinner.fruit); }));
  ['پرتقال', 'سیب', 'موز', 'میوه فصل'].forEach(x => used.add(x));
  const opts = list => [...new Set(list)].filter(Boolean).map(n => `<option value="${fe(n)}">`).join('');

  el.innerHTML = `
    <datalist id="dl-fitems">${opts(f.items.map(i => i.name))}</datalist>
    <datalist id="dl-fdishes">${opts([...f.dishes, ...f.recipes.filter(r => r.kind === 'breakfast').map(r => r.name)])}</datalist>
    <datalist id="dl-ffruits">${opts([...used])}</datalist>
    <datalist id="dl-funits">${opts(['گرم', 'عدد', 'کیلوگرم', 'میلی‌لیتر', 'لیتر', 'حبه'])}</datalist>
    ${foodVisCard()}
    ${foodCard('plans', '📅', 'برنامه‌های غذایی و دورچین', 'هر برنامه: نوع کاروان + درجه هتل + منوی ۶ روز', foodPlansBody)}
    ${foodCard('recipes', '🧮', 'آنالیز صبحانه گرم، سالادها و صبحانه سفری', 'سرانه هر نفر — آشپز با وارد کردن تعداد زائر، مقدار کل را می‌بیند', foodRecipesBody)}
    ${foodCard('items', '🧂', 'اقلام دورچین', 'فهرست اقلام و سرانه پیش‌فرض هر قلم', foodItemsBody)}
    ${foodCard('dishes', '🍲', 'فهرست غذاها', 'برای انتخاب سریع هنگام چیدن منو', foodDishesBody)}`;
}

function foodVisCard() {
  const on = foodState.enabled;
  return `
  <div class="sec-card open">
    <div class="sec-card-head no-toggle">
      <div class="sec-head-icon ico-gen">👁️</div>
      <div class="sec-head-info"><div class="sec-head-title">وضعیت نمایش برای کاربران</div><div class="sec-head-sub">تا اطلاعات کامل نشده، این بخش را خاموش نگه دارید</div></div>
    </div>
    <div class="sec-body" style="display:block">
      <label class="fswitch">
        <input type="checkbox" ${on ? 'checked' : ''} onchange="foodState.enabled=this.checked;renderFoodAdmin()">
        <span class="fsw-track"><span class="fsw-dot"></span></span>
        <b>${on ? '✅ بخش غذایی برای همه کاربران نمایش داده می‌شود' : '⛔ بخش غذایی فعلاً برای کاربران پنهان است'}</b>
      </label>
      <div class="empty-msg" style="line-height:2">
        وقتی خاموش است، کاربران این بخش را نمی‌بینند؛ ولی شما در «پیش‌نمایش» و روی همین دستگاه (که با رمز وارد پنل شده‌اید) آن را با برچسب «پنهان از کاربران» می‌بینید.
        پس می‌توانید هر چند بار خواستید «انتشار» بزنید تا کارتان ذخیره شود. هر وقت اطلاعات کامل شد، این کلید را روشن کنید و یک‌بار دیگر «انتشار» بزنید.
      </div>
      <div style="padding:0 16px 14px"><button class="add-row-btn" style="margin:0;width:100%" onclick="openPreview()">👁 پیش‌نمایش زنده در تب جدید (بدون انتشار)</button></div>
    </div>
  </div>`;
}

function foodCard(key, icon, title, sub, bodyFn) {
  const open = foodCards.has(key);
  return `
  <div class="sec-card ${open ? 'open' : ''}">
    <div class="sec-card-head" onclick="foodToggleCard('${key}')">
      <div class="sec-head-icon ico-gen">${icon}</div>
      <div class="sec-head-info"><div class="sec-head-title">${title}</div><div class="sec-head-sub">${sub}</div></div>
      <span class="sec-chevron">▼</span>
    </div>
    <div class="sec-body">${open ? bodyFn() : ''}</div>
  </div>`;
}
function foodToggleCard(k) { foodCards.has(k) ? foodCards.delete(k) : foodCards.add(k); renderFoodAdmin(); }

/* ── plans ── */
function foodPlansBody() {
  const ps = foodState.plans;
  return `<div class="hotel-tools"><button class="add-row-btn" onclick="foodAddPlan()">+ برنامه جدید</button></div>` +
    (ps.length ? ps.map(foodPlanHTML).join('') : '<div class="empty-msg">برنامه‌ای ثبت نشده</div>');
}
function foodPlanHTML(p, i) {
  const open = foodOpenPlan === i;
  let h = `
  <div class="hotel-entry ${open ? 'open' : ''}">
    <div class="hotel-entry-head" onclick="foodTogglePlan(${i})">
      <div class="hotel-num">${i + 1}</div>
      <div style="flex:1;min-width:0">
        <div class="hotel-entry-name">${fe(p.title) || 'برنامه جدید'}</div>
        <div class="hotel-meta">کاروان ${FOOD_TYPES_A[p.caravanType]} · درجه هتل: ${p.grades.length ? p.grades.join('، ') : 'همه'}${p.period ? ' · ' + fe(p.period) : ''}</div>
      </div>
      <span class="fp-st ${p.active ? 'on' : ''}">${p.active ? 'فعال' : 'غیرفعال'}</span>
      <div class="hotel-ctl" onclick="event.stopPropagation()">
        <button title="بالاتر" onclick="foodMovePlan(${i},-1)">▲</button>
        <button title="پایین‌تر" onclick="foodMovePlan(${i},1)">▼</button>
        <button title="کپی از این برنامه" onclick="foodDupPlan(${i})">⧉</button>
        <button class="del-btn" title="حذف" onclick="foodDelPlan(${i})">🗑</button>
      </div>
      <span class="hotel-chev">▼</span>
    </div>`;
  if (!open) return h + '</div>';
  const d = foodDaySelA[p.id] || 0;
  h += `
    <div class="fp-body">
      <div class="fp-grid">
        <div><div class="field-label">عنوان برنامه</div>
          <input type="text" class="input-full" value="${fe(p.title)}" oninput="foodPlanSet(${i},'title',this.value)"></div>
        <div><div class="field-label">دوره / تاریخ اجرا</div>
          <input type="text" class="input-full" value="${fe(p.period)}" placeholder="مثلاً اجرا از مهر ۱۴۰۵" oninput="foodPlanSet(${i},'period',this.value)"></div>
        <div><div class="field-label">نوع کاروان</div>
          <select class="fsel-a" onchange="foodPlanSet(${i},'caravanType',this.value,true)">
            ${Object.entries(FOOD_TYPES_A).map(([k, l]) => `<option value="${k}" ${p.caravanType === k ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        <div><div class="field-label">وضعیت</div>
          <label class="fchk"><input type="checkbox" ${p.active ? 'checked' : ''} onchange="foodPlanSet(${i},'active',this.checked,true)"> فعال (برای کاربران قابل انتخاب است)</label></div>
      </div>
      <div class="field-label">درجه هتل‌هایی که این دورچین برای آن‌هاست <span style="font-weight:400">(اگر هیچ‌کدام انتخاب نشود، برای همه درجه‌ها)</span></div>
      <div class="fgrades">${foodState.grades.map(g =>
        `<label class="fg ${p.grades.includes(g) ? 'on' : ''}"><input type="checkbox" ${p.grades.includes(g) ? 'checked' : ''} onchange="foodPlanGrade(${i},'${g}',this.checked)">${g}</label>`).join('')}</div>
      <div class="fdays-a">${FOOD_DAYS_A.map((n, k) =>
        `<button class="${k === d ? 'on' : ''}" onclick="foodPickDayA('${p.id}',${k})">روز ${n}</button>`).join('')}</div>
      <div class="fmeals-a">${FOOD_MEALS_A.map(([m, l]) => foodMealEditor(i, d, m, l, p.days[d][m])).join('')}</div>
      ${d < 5 ? `<button class="add-row-btn" style="margin:8px 0 0;width:100%" onclick="foodCopyDay(${i},${d})">📋 کپی کل منوی روز ${FOOD_DAYS_A[d]} به روز ${FOOD_DAYS_A[d + 1]}</button>` : ''}
      <div class="field-label" style="margin-top:14px">نکات و سرانه این برنامه <span style="font-weight:400">(هر خط یک نکته)</span></div>
      <textarea class="fta" rows="6" oninput="foodPlanSet(${i},'notes',this.value)">${fe(p.notes)}</textarea>
    </div>
  </div>`;
  return h;
}
function foodMealEditor(i, d, m, label, meal) {
  const mk = m === 'breakfast' ? 'hot' : 'main';
  return `
  <div class="fm-a fm-${m}">
    <div class="fm-a-title">${label}</div>
    <div class="field-label">${m === 'breakfast' ? 'صبحانه گرم' : 'غذای اصلی'}</div>
    <input type="text" class="input-full" list="dl-fdishes" value="${fe(meal[mk])}" oninput="foodMealSet(${i},${d},'${m}','${mk}',this.value)">
    ${m !== 'breakfast' ? `<div class="field-label">میوه</div>
    <input type="text" class="input-full" list="dl-ffruits" value="${fe(meal.fruit)}" oninput="foodMealSet(${i},${d},'${m}','fruit',this.value)">` : ''}
    <div class="field-label">دورچین <span style="font-weight:400">(نام قلم و سرانه؛ مثلاً ۱۱۰٪، ۲ عدد یا ۴۰ گرم)</span></div>
    ${meal.sides.map((s, k) => `
      <div class="fside">
        <input type="text" class="fs-n" list="dl-fitems" value="${fe(s.name)}" placeholder="نام قلم"
               oninput="foodSideSet(${i},${d},'${m}',${k},'name',this.value)" onchange="foodSideDefault(${i},${d},'${m}',${k})">
        <input type="text" class="fs-q" value="${fe(s.q)}" placeholder="سرانه" oninput="foodSideSet(${i},${d},'${m}',${k},'q',this.value)">
        <button class="fs-x" title="حذف" onclick="foodSideDel(${i},${d},'${m}',${k})">✕</button>
      </div>`).join('')}
    <button class="add-row-btn fs-add" onclick="foodSideAdd(${i},${d},'${m}')">+ قلم دورچین</button>
  </div>`;
}

function foodTogglePlan(i) { foodOpenPlan = foodOpenPlan === i ? -1 : i; renderFoodAdmin(); }
function foodAddPlan() {
  foodState.plans.push(normalizeFood({ plans: [{ title: '', caravanType: 'normal' }] }).plans[0]);
  foodOpenPlan = foodState.plans.length - 1; renderFoodAdmin();
}
function foodDupPlan(i) {
  const c = JSON.parse(JSON.stringify(foodState.plans[i]));
  c.id = fid(); c.title = c.title + ' (کپی)'; c.active = false;
  foodState.plans.splice(i + 1, 0, c);
  foodOpenPlan = i + 1; renderFoodAdmin();
  showToast('یک کپی غیرفعال ساخته شد؛ درجه هتل و دورچین آن را ویرایش کنید');
}
function foodDelPlan(i) {
  if (!confirm('این برنامه حذف شود؟')) return;
  foodState.plans.splice(i, 1);
  if (foodOpenPlan === i) foodOpenPlan = -1; else if (foodOpenPlan > i) foodOpenPlan--;
  renderFoodAdmin();
}
function foodMovePlan(i, d) {
  const a = foodState.plans, j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  if (foodOpenPlan === i) foodOpenPlan = j; else if (foodOpenPlan === j) foodOpenPlan = i;
  renderFoodAdmin();
}
function foodPlanSet(i, k, v, rerender) { foodState.plans[i][k] = v; if (rerender) renderFoodAdmin(); }
function foodPlanGrade(i, g, on) {
  const p = foodState.plans[i];
  p.grades = on ? [...new Set([...p.grades, g])] : p.grades.filter(x => x !== g);
  p.grades.sort((a, b) => foodState.grades.indexOf(a) - foodState.grades.indexOf(b));
  renderFoodAdmin();
}
function foodPickDayA(id, d) { foodDaySelA[id] = d; renderFoodAdmin(); }
function foodCopyDay(i, d) {
  if (!confirm(`منوی روز ${FOOD_DAYS_A[d + 1]} با منوی روز ${FOOD_DAYS_A[d]} جایگزین شود؟`)) return;
  const p = foodState.plans[i];
  p.days[d + 1] = JSON.parse(JSON.stringify(p.days[d]));
  foodDaySelA[p.id] = d + 1; renderFoodAdmin();
}
function foodMealSet(i, d, m, k, v) { foodState.plans[i].days[d][m][k] = v; }
function foodSideSet(i, d, m, k, f, v) { foodState.plans[i].days[d][m].sides[k][f] = v; }
function foodSideAdd(i, d, m) { foodState.plans[i].days[d][m].sides.push({ name: '', q: '' }); renderFoodAdmin(); }
function foodSideDel(i, d, m, k) { foodState.plans[i].days[d][m].sides.splice(k, 1); renderFoodAdmin(); }
function foodSideDefault(i, d, m, k) {
  const s = foodState.plans[i].days[d][m].sides[k];
  const it = foodState.items.find(x => x.name.trim() === s.name.trim());
  if (it && it.q && !s.q.trim()) { s.q = it.q; renderFoodAdmin(); }
}

/* ── recipes ── */
function foodRecipesBody() {
  const rs = foodState.recipes;
  return `<div class="hotel-tools"><button class="add-row-btn" onclick="foodAddRecipe()">+ آنالیز جدید</button></div>` +
    (rs.length ? rs.map(foodRecipeHTMLA).join('') : '<div class="empty-msg">آنالیزی ثبت نشده</div>');
}
function foodRecipeHTMLA(r, i) {
  const open = foodOpenRecipe === i;
  let h = `
  <div class="hotel-entry ${open ? 'open' : ''}">
    <div class="hotel-entry-head" onclick="foodToggleRecipe(${i})">
      <div class="hotel-num">${i + 1}</div>
      <div style="flex:1;min-width:0">
        <div class="hotel-entry-name">${fe(r.name) || 'آنالیز جدید'}</div>
        <div class="hotel-meta">${RECIPE_KINDS[r.kind] || ''} · ${r.ingredients.length} ماده</div>
      </div>
      <div class="hotel-ctl" onclick="event.stopPropagation()">
        <button title="بالاتر" onclick="foodMoveRecipe(${i},-1)">▲</button>
        <button title="پایین‌تر" onclick="foodMoveRecipe(${i},1)">▼</button>
        <button class="del-btn" title="حذف" onclick="foodDelRecipe(${i})">🗑</button>
      </div>
      <span class="hotel-chev">▼</span>
    </div>`;
  if (!open) return h + '</div>';
  h += `
    <div class="fp-body">
      <div class="fp-grid">
        <div><div class="field-label">نام (باید با نام صبحانه گرم یا قلم دورچین یکی باشد تا لینک شود)</div>
          <input type="text" class="input-full" value="${fe(r.name)}" oninput="foodRecipeSet(${i},'name',this.value)"></div>
        <div><div class="field-label">دسته</div>
          <select class="fsel-a" onchange="foodRecipeSet(${i},'kind',this.value,true)">
            ${Object.entries(RECIPE_KINDS).map(([k, l]) => `<option value="${k}" ${r.kind === k ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
      </div>
      <div class="field-label" style="margin-top:12px">مواد (سرانه هر نفر) <span style="font-weight:400">— اگر مقدار عددی ندارد، مقدار را خالی بگذارید و در توضیح بنویسید «به مقدار لازم»</span></div>
      <div class="fing fing-h"><span>ماده</span><span>مقدار</span><span>واحد</span><span class="fi-note">توضیح</span><span></span></div>
      ${r.ingredients.map((g, k) => `
        <div class="fing">
          <input type="text" value="${fe(g.name)}" placeholder="نام ماده" oninput="foodIngSet(${i},${k},'name',this.value)">
          <input type="text" inputmode="decimal" value="${fe(g.amount)}" placeholder="مثلاً ۴۰" oninput="foodIngSet(${i},${k},'amount',this.value)" style="direction:ltr;text-align:center">
          <input type="text" list="dl-funits" value="${fe(g.unit)}" placeholder="گرم" oninput="foodIngSet(${i},${k},'unit',this.value)">
          <input type="text" class="fi-note" value="${fe(g.note)}" placeholder="توضیح" oninput="foodIngSet(${i},${k},'note',this.value)">
          <button class="fs-x" title="حذف" onclick="foodIngDel(${i},${k})">✕</button>
        </div>`).join('')}
      <button class="add-row-btn fs-add" onclick="foodIngAdd(${i})">+ افزودن ماده</button>
      <div class="field-label" style="margin-top:12px">طرز تهیه</div>
      <textarea class="fta" rows="5" oninput="foodRecipeSet(${i},'method',this.value)">${fe(r.method)}</textarea>
      <div class="field-label">نکته</div>
      <input type="text" class="input-full" value="${fe(r.note)}" oninput="foodRecipeSet(${i},'note',this.value)">
    </div>
  </div>`;
  return h;
}
function foodToggleRecipe(i) { foodOpenRecipe = foodOpenRecipe === i ? -1 : i; renderFoodAdmin(); }
function foodAddRecipe() {
  foodState.recipes.push({ id: fid(), name: '', kind: 'breakfast', ingredients: [{ name: '', amount: '', unit: 'گرم', note: '' }], method: '', note: '' });
  foodOpenRecipe = foodState.recipes.length - 1; renderFoodAdmin();
}
function foodDelRecipe(i) {
  if (!confirm('این آنالیز حذف شود؟')) return;
  foodState.recipes.splice(i, 1);
  if (foodOpenRecipe === i) foodOpenRecipe = -1; else if (foodOpenRecipe > i) foodOpenRecipe--;
  renderFoodAdmin();
}
function foodMoveRecipe(i, d) {
  const a = foodState.recipes, j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  if (foodOpenRecipe === i) foodOpenRecipe = j; else if (foodOpenRecipe === j) foodOpenRecipe = i;
  renderFoodAdmin();
}
function foodRecipeSet(i, k, v, rerender) { foodState.recipes[i][k] = v; if (rerender) renderFoodAdmin(); }
function foodIngSet(i, k, f, v) { foodState.recipes[i].ingredients[k][f] = v; }
function foodIngAdd(i) { foodState.recipes[i].ingredients.push({ name: '', amount: '', unit: 'گرم', note: '' }); renderFoodAdmin(); }
function foodIngDel(i, k) { foodState.recipes[i].ingredients.splice(k, 1); renderFoodAdmin(); }

/* ── items (دورچین) ── */
function foodItemsBody() {
  return `<div class="empty-msg" style="line-height:2">سرانه پیش‌فرض، هنگام افزودن این قلم به منو خودکار پر می‌شود (مثلاً نوشابه ۱۱۰٪ یعنی برای ۱۰ زائر ۱۱ عدد).</div>
    <div class="fitems">${foodState.items.map((it, k) => `
      <div class="fside">
        <input type="text" class="fs-n" value="${fe(it.name)}" placeholder="نام قلم" oninput="foodState.items[${k}].name=this.value">
        <input type="text" class="fs-q" value="${fe(it.q)}" placeholder="سرانه" oninput="foodState.items[${k}].q=this.value">
        <button class="fs-x" title="حذف" onclick="foodState.items.splice(${k},1);renderFoodAdmin()">✕</button>
      </div>`).join('')}
    </div>
    <div style="padding:0 16px 14px"><button class="add-row-btn fs-add" onclick="foodState.items.push({name:'',q:''});renderFoodAdmin()">+ افزودن قلم</button></div>`;
}

/* ── dishes ── */
function foodDishesBody() {
  return `<div class="fdishes">${foodState.dishes.map((d, k) =>
      `<span class="fdish">${fe(d)}<button title="حذف" onclick="foodState.dishes.splice(${k},1);renderFoodAdmin()">✕</button></span>`).join('') || '<div class="empty-msg">غذایی ثبت نشده</div>'}</div>
    <div class="frow-add">
      <input type="text" id="fNewDish" placeholder="نام غذای جدید" onkeydown="if(event.key==='Enter')foodAddDish()">
      <button class="add-row-btn" onclick="foodAddDish()">+ افزودن</button>
    </div>`;
}
function foodAddDish() {
  const inp = document.getElementById('fNewDish');
  const v = (inp.value || '').trim();
  if (!v) return;
  if (!foodState.dishes.includes(v)) foodState.dishes.push(v);
  renderFoodAdmin();
  document.getElementById('fNewDish')?.focus();
}
