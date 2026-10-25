"""ثبت نرخ بازار عراق که «ثبت‌کننده نرخ» از صفحه nerkh.html می‌فرستد → rate-market.json
ورودی‌ها از متغیرهای محیطی می‌آیند و فقط عدد در محدوده معقول پذیرفته می‌شود."""
import json, os, re, sys, datetime

def num(name, lo, hi):
    raw = re.sub(r'[^\d.]', '', os.environ.get(name, '').translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')))
    if not raw:
        return None
    v = float(raw)
    if not lo <= v <= hi:
        sys.exit(f'{name}={v} خارج از محدوده {lo}–{hi}')
    return v

t1000 = num('T1000', 20000, 5000000)    # تومان برای ۱۰۰۰ دینار
usd_iqd = num('USD_IQD', 500, 10000)     # دینار برای ۱ دلار
usd_t = num('USD_T', 10000, 50000000)    # تومان برای ۱ دلار
if not t1000 and not (usd_iqd and usd_t):
    sys.exit('نرخ دینار به تومان (یا هر دو نرخ دلار) لازم است')
name = re.sub(r'[^\w\s؀-ۿ.-]', '', os.environ.get('BY', ''))[:40].strip()
now = datetime.datetime.now(datetime.timezone.utc)
out = {'toman_per_1000_iqd': t1000, 'iqd_per_usd': usd_iqd, 'toman_per_usd': usd_t, 'by': name,
       'at': now.strftime('%Y-%m-%dT%H:%M:%SZ'), 'ts': int(now.timestamp() * 1000)}
with open('rate-market.json', 'w', encoding='utf-8') as f:
    json.dump({k: v for k, v in out.items() if v not in (None, '')}, f, ensure_ascii=False, indent=1)
print(out)
