/**
 * =====================================================
 *  فایل داده‌های راهنمای کاروان عراق
 *  ویرایش: فقط همین فایل را تغییر دهید
 *  آخرین بروزرسانی: 1405/03/13
 * =====================================================
 */

const CARAVAN_DATA = {

  lastUpdate: "1405/03/13",

  insurance: {
    title: "نماینده بیمه معلم – تمام شهرها",
    subtitle: "نجف · کربلا · کاظمین",
    contacts: [
    { role: "نماینده بیمه معلم", phone: "07755488001", name: "آقای مجتبی ناصری", countryCode: "964" }
  ]
  },

  cities: [

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
          { role: "رئیس ستاد نجف", phone: "07855435901", name: null, countryCode: "964" },
          { role: "مسئول حراست ستاد نجف", phone: "07848327903", name: null, countryCode: "964" },
          { role: "مسئول بازرسی ستاد نجف", phone: "07842799305", name: null, countryCode: "964" }
        ]
      },
      clinic: {
        title: "درمانگاه نجف",
        address: "شارع السور – هتل نباء – درمانگاه نباء",
        mapNeshanUrl: "https://nshn.ir/65_b_s1ROAAlS4",
        mapGoogleUrl: "https://maps.app.goo.gl/SCwr7nx79vDDu9TXA",
        contacts: []
      },
      consulate: {
        title: "کنسولگری ایران – نجف",
        mapNeshanUrl: "https://nshn.ir/_b_r6eVAAW4d",
        mapGoogleUrl: "https://maps.app.goo.gl/xu5bijuJ6LD82fB37",
        contacts: []
      }
    },

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
          { role: "رئیس ستاد کربلا", phone: "07842510402", name: null, countryCode: "964" },
          { role: "مسئول حراست ستاد کربلا", phone: "07733104123", name: null, countryCode: "964" },
          { role: "مسئول بازرسی ستاد کربلا", phone: "07873332030", name: null, countryCode: "964" }
        ]
      },
      clinic: {
        title: "درمانگاه کربلا",
        address: "شارع العباس (باب قبله حضرت عباس) – بعد از خیابان جمهوری – کوچه روبروی وزارت مخابرات – جنب هتل برج الکرمل – ساختمان حضرت فاطمه الزهرا (س)",
        mapNeshanUrl: "https://nshn.ir/4f_bZyZDYASwLL",
        mapGoogleUrl: "https://maps.app.goo.gl/RiPVKsojhM6Y7NfL7",
        contacts: []
      },
      consulate: {
        title: "کنسولگری ایران – کربلا",
        mapNeshanUrl: "https://nshn.ir/df_bZTEHNASrOv",
        mapGoogleUrl: "https://maps.app.goo.gl/zbi79t88G28wRK3G7",
        contacts: []
      }
    },

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
        contacts: []
      },
      clinic: null,
      consulate: null
    }

  ]
};
