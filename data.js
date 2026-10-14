/**
 * =====================================================
 *  فایل داده‌های راهنمای کاروان عراق
 *  آخرین بروزرسانی: 1405/07/22
 * =====================================================
 */

const CARAVAN_DATA = {
  "lastUpdate": "1405/07/22",
  "site": {
    "appTitle": "راهنمای کاروان عراق",
    "appSubtitle": "ستادها، درمانگاه‌ها و شماره‌های تماس",
    "footer": [
      {
        "type": "heading",
        "text": "✦ بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيم ✦"
      },
      {
        "type": "bold",
        "text": "هزینه استفاده از این برنامه"
      },
      {
        "type": "text",
        "text": "صلواتی نثار روح پاک شهدا و درگذشتگان 🌹"
      },
      {
        "type": "divider",
        "text": ""
      },
      {
        "type": "text",
        "text": "طراحی و برنامه‌نویسی: **محمد میراحمدیان**\nاگر این برنامه برایتان مفید بود، شادی روح پدر بنده فاتحه ای قرائت بفرمایید."
      }
    ]
  },
  "insurance": {
    "title": "نماینده بیمه معلم در عراق",
    "contacts": [
      {
        "role": "نماینده بیمه معلم",
        "phone": "07755488001",
        "name": "آقای مجتبی ناصری",
        "countryCode": "964",
        "photo": "people/p-1792004328489-dyhmd.jpg"
      }
    ]
  },
  "transport": {
    "title": "ناظر نقل شرکت‌های عراقی",
    "contacts": [
      {
        "role": "ناظر نقل شرکت‌های عراقی",
        "phone": "07722310002",
        "name": "آقای علی گریطی",
        "countryCode": "964",
        "photo": "people/p-1792007308924-kqnoa.jpg"
      }
    ]
  },
  "cities": [
    {
      "id": "najaf",
      "name": "نجف اشرف",
      "arabic": "النجف الأشرف · مرقد امیرالمومنین علی بن ابی‌طالب (ع)",
      "icon": "🕌",
      "heroImage": "cities/najaf-1792014332006.jpg",
      "heroFocus": {
        "x": 64,
        "y": 40
      },
      "hotels": [],
      "hq": {
        "title": "ستاد نجف اشرف",
        "address": "شارع امام صادق (ع) – زیرزمین هتل نبع الکوثر",
        "mapNeshanUrl": "https://nshn.ir/33_b_rKR_AAW8r",
        "mapGoogleUrl": "https://www.google.com/maps?q=31.994793829649662, 44.3121325",
        "contacts": [
          {
            "role": "رئیس ستاد نجف",
            "phone": "07855435901",
            "name": null,
            "countryCode": "964"
          },
          {
            "role": "مسئول حراست ستاد نجف",
            "phone": "07848327903",
            "name": null,
            "countryCode": "964"
          },
          {
            "role": "مسئول بازرسی ستاد نجف",
            "phone": "07842799305",
            "name": null,
            "countryCode": "964"
          }
        ]
      },
      "clinic": {
        "title": "درمانگاه نجف",
        "address": "شارع السور – هتل نباء – درمانگاه نباء",
        "mapNeshanUrl": "https://nshn.ir/65_b_s1ROAAlS4",
        "mapGoogleUrl": "https://www.google.com/maps?q=31.997154012304026, 44.322958184605156",
        "contacts": []
      },
      "consulate": {
        "title": "کنسولگری ایران – نجف",
        "mapNeshanUrl": "https://nshn.ir/_b_r6eVAAW4d",
        "mapGoogleUrl": "https://www.google.com/maps?q=31.994274730808442, 44.31235262698616",
        "contacts": []
      }
    },
    {
      "id": "karbala",
      "name": "کربلای معلی",
      "arabic": "كربلاء المقدسة · مرقد سیدالشهداء الحسین (ع) و العباس (ع)",
      "icon": "🕌",
      "hotels": [],
      "hq": {
        "title": "ستاد کربلا",
        "address": "شارع میثم تمار – هتل کربلاالدولی – طبقه هفتم",
        "mapNeshanUrl": "https://nshn.ir/c4_bZlfl0A2eSO",
        "mapGoogleUrl": "https://www.google.com/maps?q=32.62012256744457, 44.04220765408347",
        "contacts": [
          {
            "role": "رئیس ستاد کربلا",
            "phone": "07842510402",
            "name": null,
            "countryCode": "964"
          },
          {
            "role": "مسئول حراست ستاد کربلا",
            "phone": "07733104123",
            "name": null,
            "countryCode": "964"
          },
          {
            "role": "مسئول بازرسی ستاد کربلا",
            "phone": "07873332030",
            "name": null,
            "countryCode": "964"
          }
        ]
      },
      "clinic": {
        "title": "درمانگاه کربلا",
        "address": "شارع العباس (باب قبله حضرت عباس) – بعد از خیابان جمهوری – کوچه روبروی وزارت مخابرات – جنب هتل برج الکرمل – ساختمان حضرت فاطمه الزهرا (س)",
        "mapNeshanUrl": "https://nshn.ir/4f_bZyZDYASwLL",
        "mapGoogleUrl": "https://www.google.com/maps?q=32.612229851688035, 44.03564811724431",
        "contacts": []
      },
      "consulate": {
        "title": "کنسولگری ایران – کربلا",
        "mapNeshanUrl": "https://nshn.ir/df_bZTEHNASrOv",
        "mapGoogleUrl": "https://www.google.com/maps?q=32.59198773036064, 44.02128092748514",
        "contacts": []
      }
    },
    {
      "id": "kadhimiya",
      "name": "کاظمین",
      "arabic": "الكاظمية · مرقد الإمام موسى الكاظم (ع) والجواد (ع)",
      "icon": "🕌",
      "hotels": [
        {
          "id": "hotel-kadhimiya-1792009081227",
          "name": "ضیوف قصرالکاظمیه",
          "nameEn": "",
          "address": "",
          "cardImage": "hotels/h-1792009129579-x6q90.jpg",
          "images": [
            "hotels/h-1792009129579-x6q90.jpg",
            "hotels/h-1792009131876-2chfa.jpg"
          ],
          "mapNeshanUrl": "",
          "mapGoogleUrl": "",
          "contacts": []
        }
      ],
      "hq": {
        "title": "ستاد کاظمین",
        "address": "شارع باب المراد – هتل جمیره",
        "mapNeshanUrl": "https://nshn.ir/c3_bS-LAYACueZ",
        "mapGoogleUrl": "https://maps.app.goo.gl/BMoX9nV6TtcJxikD9",
        "contacts": [
          {
            "role": "نماینده سازمان در کاظمین",
            "phone": "07736395692",
            "name": "آقای صمد عبداللهی",
            "countryCode": "964"
          }
        ]
      },
      "clinic": {
        "title": "درمانگاه کاظمین",
        "address": "خیابان باب المراد، جنب هتل جمیره، ابتدای فرعی",
        "mapNeshanUrl": "https://nshn.ir/_bS-scpACiha",
        "mapGoogleUrl": "https://maps.app.goo.gl/41GSUKV1jtzKCjLHA",
        "contacts": []
      },
      "consulate": null
    }
  ]
};
