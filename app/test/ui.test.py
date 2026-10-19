# Ujian UI hujung ke hujung: daftar, login, tukar PIN, setup admin, reset PIN.
# Jalankan dengan `wrangler dev` di port 8787: python3 test/ui.test.py <folder-screenshot>
import sys, os, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:8787')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
KEY = os.environ.get('SETUP_KEY', 'local-setup-key-1234567890')
phone = '01' + str(int(time.time()))[-8:]
fails = []

def check(name, cond):
    print(('  ok   ' if cond else '  FAIL ') + name)
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/'); pg.wait_for_selector('#fLogin')
    pg.screenshot(path=f'{OUT}/u1-login.png')
    pg.click('text=Daftar akaun baharu'); pg.wait_for_selector('#fDaftar')
    pg.fill('#dName', 'Rohana Ismail'); pg.fill('#dPhone', phone); pg.fill('#dEmail', 'rohana@contoh.my'); pg.fill('#dPin', '482913'); pg.fill('#dPin2', '482914')
    pg.click('#fDaftar button[type=submit]'); pg.wait_for_selector('.err')
    check('PIN tak sama ditunjuk ralat', 'tidak sama' in pg.inner_text('.err'))
    check('Nama kekal selepas ralat', pg.input_value('#dName') == 'Rohana Ismail')
    pg.fill('#dPin', '482913'); pg.fill('#dPin2', '482913')
    pg.click('#fDaftar button[type=submit]'); pg.wait_for_selector('.hero')
    check('Masuk skrin Utama selepas daftar', 'Rohana Ismail' in pg.inner_text('.hero'))
    check('Status belum aktif', 'belum aktif' in pg.inner_text('.status'))
    pg.screenshot(path=f'{OUT}/u2-utama.png')
    pg.click('nav >> text=Akaun'); pg.wait_for_selector('text=Tukar PIN')
    pg.screenshot(path=f'{OUT}/u3-akaun.png', full_page=True)
    pg.click('text=Tukar PIN'); pg.fill('#pOld', '482913'); pg.fill('#pNew', '561937'); pg.fill('#pNew2', '561937')
    pg.click('#fPin button[type=submit]'); pg.wait_for_selector('#fPin', state='detached')
    check('Tukar PIN berjaya', True)
    pg.click('text=Log keluar'); pg.wait_for_selector('#fLogin')
    pg.fill('#lPhone', phone); pg.fill('#lPin', '482913'); pg.click('#fLogin button[type=submit]'); pg.wait_for_selector('.err')
    check('PIN lama ditolak', 'salah' in pg.inner_text('.err'))
    pg.fill('#lPin', '561937'); pg.click('#fLogin button[type=submit]'); pg.wait_for_selector('.hero')
    check('Login dengan PIN baharu', True)
    pg.reload(); pg.wait_for_selector('.hero')
    check('Kekal login selepas muat semula', True)
    pg.click('nav >> text=Video'); pg.wait_for_selector('text=Video dikunci')
    pg.screenshot(path=f'{OUT}/u4-video.png')

    # admin
    ad = ctx.new_page(); ad.on('pageerror', lambda e: errs.append(str(e)))
    ad.goto(BASE + '/admin'); ad.wait_for_selector('#fSetup, #fLogin')
    if ad.query_selector('#fSetup'):
        ad.screenshot(path=f'{OUT}/a1-setup.png')
        ad.fill('#sKey', 'salah-kunci'); ad.fill('#sName', 'Ustaz Imran'); ad.fill('#sEmail', 'admin@contoh.my'); ad.fill('#sPass', 'katalaluan-panjang-1')
        ad.click('#fSetup button[type=submit]'); ad.wait_for_selector('.err')
        check('Setup ditolak dengan kunci salah', 'tidak sama' in ad.inner_text('.err'))
        ad.fill('#sKey', KEY); ad.fill('#sPass', 'katalaluan-panjang-1')
        ad.click('#fSetup button[type=submit]'); ad.wait_for_selector('#fLogin')
        check('Admin pertama dicipta', True)
    ad.fill('#aEmail', 'admin@contoh.my'); ad.fill('#aPass', 'katalaluan-panjang-1'); ad.click('#fLogin button[type=submit]')
    ad.wait_for_selector('.stats')
    check('Ringkasan admin dipapar', 'Jumlah berdaftar' in ad.inner_text('.stats'))
    ad.screenshot(path=f'{OUT}/a2-ringkasan.png')
    ad.click('.tabs >> text=Pelajar'); ad.wait_for_selector('[data-a=user]')
    ad.screenshot(path=f'{OUT}/a3-pelajar.png')
    ad.click('[data-a=user] >> text=Rohana Ismail'); ad.click('text=Set semula PIN')
    ad.wait_for_selector('.ok-box')
    tmp = ad.inner_text('.ok-box').split(':')[-1].strip().replace(' ', '')
    check('PIN sementara dijana', len(tmp) == 6 and tmp.isdigit())
    ad.screenshot(path=f'{OUT}/a4-reset.png')
    pg.reload(); pg.wait_for_selector('#fLogin')
    check('Pelajar dilog keluar selepas reset PIN', True)
    pg.fill('#lPhone', phone); pg.fill('#lPin', tmp); pg.click('#fLogin button[type=submit]'); pg.wait_for_selector('.hero')
    check('Login dengan PIN sementara', True)

    # lupa PIN melalui emel
    import re
    pg.click('nav >> text=Akaun'); pg.click('text=Log keluar'); pg.wait_for_selector('#fLogin')
    pg.click('text=Lupa PIN?'); pg.wait_for_selector('#fForgot')
    pg.screenshot(path=f'{OUT}/u5-lupa.png')
    pg.fill('#fPhone', phone); pg.click('#fForgot button[type=submit]'); pg.wait_for_selector('#fReset')
    time.sleep(0.5)
    codes = re.findall(r'\[MAIL_DEV\] rohana@contoh\.my \| Kod set semula PIN: (\d{6})', open(os.environ['DEV_LOG']).read())
    check('Kod emel dijana', bool(codes))
    pg.fill('#rCode', codes[-1]); pg.fill('#rPin', '847261'); pg.fill('#rPin2', '847261')
    pg.screenshot(path=f'{OUT}/u6-reset.png')
    pg.click('#fReset button[type=submit]'); pg.wait_for_selector('#fLogin')
    pg.fill('#lPhone', phone); pg.fill('#lPin', '847261'); pg.click('#fLogin button[type=submit]'); pg.wait_for_selector('.hero')
    check('Login selepas reset PIN melalui emel', True)
    check('Tiada ralat JavaScript', not errs)
    if errs: print(errs)
    b.close()

print(f"\n{'SEMUA LULUS' if not fails else str(len(fails)) + ' GAGAL'}")
sys.exit(1 if fails else 0)
