/**
 * =====================================================
 *  فایل داده‌های راهنمای کاروان عراق
 *  ویرایش: فقط همین فایل را تغییر دهید
 *  آخرین بروزرسانی: تاریخ را اینجا وارد کنید
 * =====================================================
 *
 *  راهنمای ویرایش:
 *  - برای تغییر شماره، عدد داخل "" را عوض کنید
 *  - برای حذف شماره، کل خط از { تا } را پاک کنید
 *  - برای اضافه کردن شماره، یک آیتم جدید مثل نمونه اضافه کنید
 *  - اگر شماره‌ای موجود نیست، مقدار null بگذارید
 *
 */

const CARAVAN_DATA = {

  // ─── آخرین بروزرسانی (نمایش داده می‌شود) ───
  lastUpdate: "۱۴۰۳/۰۳/۱۵",

  // ─── نماینده بیمه مشترک همه شهرها ───
  insurance: {
    title: "نماینده بیمه معلم – تمام شهرها",
    subtitle: "نجف · کربلا · کاظمین",
    contacts: [
      {
        role: "نماینده بیمه معلم",
        name: "آقای مجتبی ناصری",
        phone: "07755488001",
        countryCode: "964"
      }
    ]
  },

  // ─── شهرها ───
  cities: [

    // ══════════════════════════════════════════
    //  نجف اشرف
    // ══════════════════════════════════════════
    {
      id: "najaf",
      name: "نجف اشرف",
      arabic: "النجف الأشرف · مرقد امیرالمومنین علی بن ابی‌طالب (ع)",
      icon: "🕌",

      hq: {
        title: "ستاد نجف اشرف",
        address: "شارع امام صادق (ع) – زیرزمین هتل نبع الکوثر",
        mapNeshanUrl: "https://nshn.ir/33_b_rKR_AAW8r",
        mapGoogleUrl: "https://maps.app.goo.gl/cVP62jZRwFm2q5hB6",
        contacts: [
          {
            role: "رئیس ستاد نجف",
            name: null,
            phone: "07855435901",
            countryCode: "964"
          },
          {
            role: "مسئول حراست ستاد نجف",
            name: null,
            phone: "07848327903",
            countryCode: "964"
          },
          {
            role: "مسئول بازرسی ستاد نجف",
            name: null,
            phone: "07842799305",
            countryCode: "964"
          }
        ]
      },

      clinic: {
        title: "درمانگاه نجف",
        address: "شارع السور – هتل نباء – درمانگاه نباء",
        mapNeshanUrl: "https://nshn.ir/65_b_s1ROAAlS4",
        mapGoogleUrl: "https://maps.app.goo.gl/SCwr7nx79vDDu9TXA",
        contacts: [
          // شماره درمانگاه در اینجا اضافه کنید
          // مثال:
          // { role: "پذیرش درمانگاه", name: null, phone: "07700000000", countryCode: "964" }
        ]
      },

      consulate: {
        title: "کنسولگری ایران – نجف",
        mapNeshanUrl: "https://nshn.ir/_b_r6eVAAW4d",
        mapGoogleUrl: "https://maps.app.goo.gl/xu5bijuJ6LD82fB37",
        contacts: [
          // شماره کنسولگری در اینجا اضافه کنید
        ]
      }
    },

    // ══════════════════════════════════════════
    //  کربلای معلا
    // ══════════════════════════════════════════
    {
      id: "karbala",
      name: "کربلای معلا",
      arabic: "كربلاء المقدسة · مرقد سیدالشهداء الحسین (ع) و العباس (ع)",
      icon: "🕌",

      hq: {
        title: "ستاد کربلا",
        address: "شارع میثم تمار – هتل کربلاالدولی – طبقه هفتم",
        mapNeshanUrl: "https://nshn.ir/c4_bZlfl0A2eSO",
        mapGoogleUrl: "https://maps.app.goo.gl/pkLJ3suCqp82P8PaA",
        contacts: [
          {
            role: "رئیس ستاد کربلا",
            name: null,
            phone: "07842510402",
            countryCode: "964"
          },
          {
            role: "مسئول حراست ستاد کربلا",
            name: null,
            phone: "07733104123",
            countryCode: "964"
          },
          {
            role: "مسئول بازرسی ستاد کربلا",
            name: null,
            phone: "07873332030",
            countryCode: "964"
          }
        ]
      },

      clinic: {
        title: "درمانگاه کربلا",
        address: "شارع العباس (باب قبله حضرت عباس) – بعد از خیابان جمهوری – کوچه روبروی وزارت مخابرات – جنب هتل برج الکرمل – ساختمان حضرت فاطمه الزهرا (س)",
        mapNeshanUrl: "https://nshn.ir/4f_bZyZDYASwLL",
        mapGoogleUrl: "https://maps.app.goo.gl/RiPVKsojhM6Y7NfL7",
        contacts: [
          // شماره درمانگاه در اینجا اضافه کنید
        ]
      },

      consulate: {
        title: "کنسولگری ایران – کربلا",
        mapNeshanUrl: "https://nshn.ir/df_bZTEHNASrOv",
        mapGoogleUrl: "https://maps.app.goo.gl/zbi79t88G28wRK3G7",
        contacts: [
          // شماره کنسولگری در اینجا اضافه کنید
        ]
      }
    },

    // ══════════════════════════════════════════
    //  کاظمین
    // ══════════════════════════════════════════
    {
      id: "kadhimiya",
      name: "کاظمین",
      arabic: "الكاظمية · مرقد الإمام موسى الكاظم (ع) والجواد (ع)",
      icon: "🕌",

      hq: {
        title: "ستاد کاظمین",
        address: "شارع باب المراد – هتل جمیره",
        mapNeshanUrl: "https://nshn.ir/c3_bS-LAYACueZ",
        mapGoogleUrl: "https://maps.app.goo.gl/BMoX9nV6TtcJxikD9",
        contacts: [
          // شماره ستاد در اینجا اضافه کنید
        ]
      },

      clinic: null,    // درمانگاه کاظمین: null یعنی نمایش داده نمی‌شود
      consulate: null  // کنسولگری کاظمین: null یعنی نمایش داده نمی‌شود
    }

  ]
};
