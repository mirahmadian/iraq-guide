"""نرخ دینار عراق و دلار (بازار آزاد) از tgju.org — خروجی rate.json برای مبدل ارز برنامه.
فقط وقتی نرخ معقول است فایل را می‌نویسد؛ در غیر این صورت فایل قبلی دست نمی‌خورد."""
import json, sys, urllib.request

req = urllib.request.Request('https://call3.tgju.org/ajax.json', headers={'User-Agent': 'Mozilla/5.0'})
cur = json.load(urllib.request.urlopen(req, timeout=30))['current']
num = lambda k: float(str(cur[k]['p']).replace(',', ''))
iqd, usd = num('price_iqd'), num('price_dollar_rl')
if not (300 <= iqd <= 50000 and 100000 <= usd <= 100000000):
    sys.exit(f'نرخ غیرعادی: iqd={iqd} usd={usd}')
out = {'iqd_rial': iqd, 'usd_rial': usd, 'date': cur['price_iqd']['ts'][:10], 'date_fa': cur['price_iqd']['t'], 'source': 'tgju.org'}
with open('rate.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(out)
