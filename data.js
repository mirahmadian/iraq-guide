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
      "heroImage": "cities/najaf-1792014425895.jpg",
      "heroFocus": {
        "x": 64,
        "y": 32
      },
      "hotels": [],
      "hq": {
        "title": "ستاد نجف اشرف",
        "address": "شارع امام صادق (ع) – طبقه زیر همکف هتل نبع الکوثر",
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
      "heroImage": "cities/karbala-1792066586443.jpg",
      "heroFocus": {
        "x": 59,
        "y": 46
      },
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
      "heroImage": "cities/kadhimiya-1792610186678.jpg",
      "heroFocus": {
        "x": 50,
        "y": 40
      },
      "hotels": [
        {
          "id": "hotel-kadhimiya-1792045499598",
          "name": "هتل قرطاج ( جنه الباقر)",
          "nameEn": "GARTHAGE",
          "address": "باب المراد، خیابان تربیه 🛣️، بعد از هتل خفاجی ",
          "cardImage": "hotels/h-1792046854715-p8j2u.jpg",
          "images": [
            "hotels/h-1792046854715-p8j2u.jpg",
            "hotels/h-1792046857872-dmr8j.jpg",
            "hotels/h-1792046860219-kjnuc.jpg",
            "hotels/h-1792046862468-70roy.jpg",
            "hotels/h-1792046864732-s6tlo.jpg",
            "hotels/h-1792047942900-uyu2d.jpg"
          ],
          "mapNeshanUrl": "https://nshn.ir/rbS-3KpACO0c",
          "mapGoogleUrl": "https://maps.app.goo.gl/dfartnpr3BC6F2Yi6",
          "contacts": [
            {
              "role": "",
              "phone": "07843260008",
              "name": null,
              "countryCode": "964"
            },
            {
              "role": "",
              "phone": "07755517449",
              "name": null,
              "countryCode": "964"
            }
          ]
        },
        {
          "id": "hotel-kadhimiya-1792046283430",
          "name": "هتل کمیل",
          "nameEn": "KUMAIL",
          "address": "کاظمین باب دروازه ساحه قریش خلف الاطفا پشت مول کاظمیه",
          "cardImage": "hotels/h-1792046867183-7wvn2.jpg",
          "images": [
            "hotels/h-1792046867183-7wvn2.jpg",
            "hotels/h-1792046870059-tbyvk.jpg",
            "hotels/h-1792046872493-u2yfu.jpg",
            "hotels/h-1792046874668-u5oti.jpg",
            "hotels/h-1792047801527-omsqk.jpg",
            "hotels/h-1792047950461-7umh5.jpg"
          ],
          "mapNeshanUrl": "https://nshn.ir/efrbSVyBYACVV2",
          "mapGoogleUrl": "https://maps.app.goo.gl/As5pkRXWqkFa96as5",
          "contacts": [
            {
              "role": "",
              "phone": "07808899082",
              "name": null,
              "countryCode": "964"
            },
            {
              "role": "",
              "phone": "07711119632",
              "name": null,
              "countryCode": "964"
            },
            {
              "role": "",
              "phone": "07901335660",
              "name": null,
              "countryCode": "964"
            }
          ]
        },
        {
          "id": "hotel-kadhimiya-1792046871490",
          "name": "هتل برج الضامن",
          "nameEn": "BURJ ALDAAMIN",
          "address": "ساحه الزهرا نهایه شارع القبله مجاور النرکز الصحی الاسنان",
          "cardImage": "hotels/h-1792047803962-ks5yt.jpg",
          "images": [
            "hotels/h-1792047803962-ks5yt.jpg",
            "hotels/h-1792047806459-eu930.jpg",
            "hotels/h-1792047808704-wtsew.jpg",
            "hotels/h-1792047953095-fs4ks.jpg"
          ],
          "mapNeshanUrl": "https://nshn.ir/rbSVMKIAC56X",
          "mapGoogleUrl": "https://maps.app.goo.gl/bN5d4Pak2KzpSJo3A",
          "contacts": [
            {
              "role": "",
              "phone": "07735300615",
              "name": null,
              "countryCode": "964"
            },
            {
              "role": "",
              "phone": "07709649098",
              "name": null,
              "countryCode": "964"
            }
          ]
        },
        {
          "id": "hotel-kadhimiya-1792079952746",
          "name": "هتل میقات",
          "nameEn": "AL-MIGGAT",
          "address": "آخر شارع تربیه داخل کوچه روبروی هتل جنه الجواد",
          "cardImage": "hotels/h-1792080477403-19oei.jpg",
          "images": [
            "hotels/h-1792080477403-19oei.jpg",
            "hotels/h-1792080484635-qw730.jpg",
            "hotels/h-1792080495686-g2i90.jpg",
            "hotels/h-1792080521295-o2oaz.jpg",
            "hotels/h-1792080538686-9z6ft.jpg",
            "hotels/h-1792080552517-f9ryg.jpg"
          ],
          "mapNeshanUrl": "https://nshn.ir/sbS-zqQACAU9",
          "mapGoogleUrl": "https://maps.app.goo.gl/jPnXbbhkDr4jXZMi9",
          "contacts": [
            {
              "role": "",
              "phone": "07866595599",
              "name": null,
              "countryCode": "964"
            }
          ]
        },
        {
          "id": "hotel-kadhimiya-1792091645911",
          "name": "سراج المنیر",
          "nameEn": "",
          "address": "باب المراد شارع التربیه روبروی هتل خفاجی داخل کوچه",
          "cardImage": "hotels/h-1792091968557-nktuc.jpg",
          "images": [
            "hotels/h-1792091968557-nktuc.jpg",
            "hotels/h-1792091971213-mviw1.jpg",
            "hotels/h-1792091973730-sq3h3.jpg",
            "hotels/h-1792091976511-qhp4i.jpg",
            "hotels/h-1792091978778-u5ux4.jpg",
            "hotels/h-1792091981449-fw47b.jpg",
            "hotels/h-1792091983920-3l1qg.jpg",
            "hotels/h-1792091986890-sw7c9.jpg",
            "hotels/h-1792091989429-hqc8c.jpg",
            "hotels/h-1792091992092-txeyr.jpg",
            "hotels/h-1792091994722-8uj89.jpg"
          ],
          "mapNeshanUrl": "https://nshn.ir/sbS-xVIAC-5G",
          "mapGoogleUrl": "https://maps.app.goo.gl/PMjEJxWCJe8aJw9w7",
          "contacts": [
            {
              "role": "مدیر داخلی",
              "phone": "07825405948",
              "name": null,
              "countryCode": "964"
            }
          ]
        },
        {
          "id": "hotel-kadhimiya-1792609013578",
          "name": "زمزم",
          "nameEn": "ZAMZAM",
          "address": "باب المراد مقابل شریف الرضی",
          "cardImage": "hotels/h-1792610189705-katoz.jpg",
          "images": [
            "hotels/h-1792610189705-katoz.jpg",
            "hotels/h-1792610193599-7eqic.jpg",
            "hotels/h-1792610204801-jtc2g.jpg",
            "hotels/h-1792610207660-zod1g.jpg",
            "hotels/h-1792610210115-m05vy.jpg"
          ],
          "mapNeshanUrl": "https://nshn.ir/QbS-oDOACAQj",
          "mapGoogleUrl": "https://maps.app.goo.gl/Ps93wevLdb5sxyqGA",
          "contacts": [
            {
              "role": "",
              "phone": "0778 231 1903",
              "name": null,
              "countryCode": "964"
            },
            {
              "role": "",
              "phone": "07711651111",
              "name": null,
              "countryCode": "964"
            }
          ]
        },
        {
          "id": "hotel-kadhimiya-1792618267189",
          "name": "جنه الجواد",
          "nameEn": "",
          "address": "کاظمین شارع المحیط القدیم قرب التربیه",
          "cardImage": "hotels/h-1792618492401-88pu5.jpg",
          "images": [
            "hotels/h-1792618492401-88pu5.jpg",
            "hotels/h-1792618495239-cbxkz.jpg",
            "hotels/h-1792618497637-ducru.jpg",
            "hotels/h-1792618501488-evuoi.jpg",
            "hotels/h-1792618504266-xt5mo.jpg",
            "hotels/h-1792618506930-quib1.jpg",
            "hotels/h-1792618509884-pfs4o.jpg"
          ],
          "mapNeshanUrl": "https://nshn.ir/51rbSM802ACABS",
          "mapGoogleUrl": "https://maps.app.goo.gl/cjHDeAoMxz8mHhBb8",
          "contacts": [
            {
              "role": "مدیر روزانه",
              "phone": "07751700500",
              "name": null,
              "countryCode": "964"
            },
            {
              "role": "مدیریت داخلی",
              "phone": "07804905136",
              "name": null,
              "countryCode": "964"
            },
            {
              "role": "مدیر شبانه",
              "phone": "07807313652",
              "name": null,
              "countryCode": "964"
            }
          ]
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
