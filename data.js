/**
 * =====================================================
 *  فایل داده‌های راهنمای کاروان عراق
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
      hotels: [],
      hq: {
        title: "ستاد نجف اشرف",
        address: "شارع امام صادق (ع) – زیرزمین هتل نبع الکوثر",
        mapNeshanUrl: "https://nshn.ir/33_b_rKR_AAW8r",
        mapGoogleUrl: "https://www.google.com/maps?q=31.994793829649662, 44.3121325",
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
        mapGoogleUrl: "https://www.google.com/maps?q=31.997154012304026, 44.322958184605156",
        contacts: []
      },
      consulate: {
        title: "کنسولگری ایران – نجف",
        mapNeshanUrl: "https://nshn.ir/_b_r6eVAAW4d",
        mapGoogleUrl: "https://www.google.com/maps?q=31.994274730808442, 44.31235262698616",
        contacts: []
      }
    },

    {
      id: "karbala",
      name: "کربلای معلا",
      arabic: "كربلاء المقدسة · مرقد سیدالشهداء الحسین (ع) و العباس (ع)",
      icon: "🕌",
      hotels: [],
      hq: {
        title: "ستاد کربلا",
        address: "شارع میثم تمار – هتل کربلاالدولی – طبقه هفتم",
        mapNeshanUrl: "https://nshn.ir/c4_bZlfl0A2eSO",
        mapGoogleUrl: "https://www.google.com/maps?q=32.62012256744457, 44.04220765408347",
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
        mapGoogleUrl: "https://www.google.com/maps?q=32.612229851688035, 44.03564811724431",
        contacts: []
      },
      consulate: {
        title: "کنسولگری ایران – کربلا",
        mapNeshanUrl: "https://nshn.ir/df_bZTEHNASrOv",
        mapGoogleUrl: "https://www.google.com/maps?q=32.59198773036064, 44.02128092748514",
        contacts: []
      }
    },

    {
      id: "kadhimiya",
      name: "کاظمین",
      arabic: "الكاظمية · مرقد الإمام موسى الكاظم (ع) والجواد (ع)",
      icon: "🕌",
      hotels: [],
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
