"""
نسخه و تاریخ بروزرسانی برنامه را از تاریخچه git می‌سازد و در version.js می‌نویسد.
- نسخه: ۲.N — N = تعداد commitهایی که کد برنامه را عوض کرده‌اند (از ۱ آبان ۱۴۰۵).
  محتوایی که از پنل ادمین عوض می‌شود (data.js و عکس‌ها) نسخه را بالا نمی‌برد.
- تاریخ بروزرسانی: آخرین تغییر کد یا محتوا (به وقت تهران).
- نرخ خودکار دینار و خود همین فایل‌ها حساب نمی‌شوند.
- نام cache در sw.js همراه نسخه عوض می‌شود تا گوشی‌ها فایل‌های تازه را بگیرند.
"""
import json, re, subprocess
from datetime import datetime, timezone, timedelta

BASE = '2026-10-31T20:30:00Z'          # ۱ آبان ۱۴۰۵، ساعت ۰۰:۰۰ تهران
MAJOR = 2
AUTO = ['version.js', 'sw.js', 'rate.json', 'rate-market.json']
CONTENT = ['data.js', 'hotels', 'people', 'banners', 'cities', 'maps', 'besat', 'icons', 'slides', 'temporary']
TEHRAN = timezone(timedelta(hours=3, minutes=30))

def git(*a):
    return subprocess.check_output(['git', *a], text=True).strip()

def excl(paths):
    return [f':(exclude){p}' for p in paths]

def jalali(gy, gm, gd):
    g_y, g_m, g_d = gy - 1600, gm - 1, gd - 1
    n = 365 * g_y + (g_y + 3) // 4 - (g_y + 99) // 100 + (g_y + 399) // 400
    for i in range(g_m):
        n += [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i]
    if g_m > 1 and ((gy % 4 == 0 and gy % 100 != 0) or gy % 400 == 0):
        n += 1
    n += g_d
    j = n - 79
    np_, j = divmod(j, 12053)
    jy = 979 + 33 * np_ + 4 * (j // 1461)
    j %= 1461
    if j >= 366:
        jy += (j - 1) // 365
        j = (j - 1) % 365
    jm = 0
    for ml in [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30]:
        if j < ml:
            break
        j -= ml
        jm += 1
    return jy, jm + 1, j + 1

code_commits = int(git('rev-list', '--count', f'--since={BASE}', 'HEAD', '--', '.', *excl(AUTO + CONTENT)) or 0)
version = f'{MAJOR}.{code_commits}'
ts = git('log', '-1', '--format=%ct', 'HEAD', '--', '.', *excl(AUTO))
t = datetime.fromtimestamp(int(ts), TEHRAN) if ts else datetime.now(TEHRAN)
y, m, d = jalali(t.year, t.month, t.day)
info = {'version': version, 'date': f'{y}/{m:02d}/{d:02d}', 'time': t.strftime('%H:%M')}

js = ('/* این فایل خودکار ساخته می‌شود (.github/workflows/version.yml) — دستی تغییر ندهید */\n'
      f'window.APP_VERSION = {json.dumps(info, ensure_ascii=False)};\n')
with open('version.js', 'w', encoding='utf-8') as f:
    f.write(js)

sw = open('sw.js', encoding='utf-8').read()
sw2 = re.sub(r"const CACHE = '[^']*';", f"const CACHE = 'caravan-{version}';", sw, count=1)
if sw2 != sw:
    open('sw.js', 'w', encoding='utf-8').write(sw2)
print(info)
