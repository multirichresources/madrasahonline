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
    pg.click('#fDaftar button[type=submit]'); pg.wait_for_selector('.homehead')
    check('Masuk skrin Utama selepas daftar', 'Rohana Ismail' in pg.inner_text('.homehead'))
    check('Quick Access 9 ikon', pg.locator('.quick .qa-tile').count() == 9)
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
    pg.fill('#lPin', '561937'); pg.click('#fLogin button[type=submit]'); pg.wait_for_selector('.homehead')
    check('Login dengan PIN baharu', True)
    pg.reload(); pg.wait_for_selector('.homehead')
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
    pg.fill('#lPhone', phone); pg.fill('#lPin', tmp); pg.click('#fLogin button[type=submit]'); pg.wait_for_selector('.homehead')
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
    pg.fill('#lPhone', phone); pg.fill('#lPin', '847261'); pg.click('#fLogin button[type=submit]'); pg.wait_for_selector('.homehead')
    check('Login selepas reset PIN melalui emel', True)

    # video: admin aktifkan langganan manual, pelajar tonton
    ad.click('text=Tutup'); ad.click('.tabs >> text=Video'); ad.wait_for_selector('#fUpload')
    ad.screenshot(path=f'{OUT}/a5-video.png', full_page=True)
    check('Tab Video admin tunjuk senarai', 'semua video' in ad.inner_text('.shell').lower())
    ad.click('.tabs >> text=Pelajar'); ad.wait_for_selector('[data-a=user]')
    ad.click(f'[data-a=user] >> text=Rohana Ismail >> nth=0'); ad.click('[data-a=sub][data-v="1"]')
    ad.wait_for_selector('text=Aktif hingga')
    check('Admin aktifkan langganan dari modal', True)
    ad.screenshot(path=f'{OUT}/a6-langganan.png')
    pg.reload(); pg.wait_for_selector('.homehead')
    check('Banner langgan hilang bila aktif', pg.locator('.status.bad').count() == 0)
    pg.click('nav >> text=Akaun'); pg.wait_for_selector('text=Akaun Saya')
    check('Status pelajar jadi Aktif', 'Aktif hingga' in pg.inner_text('.shell'))
    pg.click('nav >> text=Video'); pg.wait_for_selector('.vitem')
    pg.screenshot(path=f'{OUT}/u7-videolist.png')
    pg.click('.vitem >> nth=0'); pg.wait_for_selector('#vframe')
    src = pg.get_attribute('#vframe', 'src')
    check('Pemain video guna pautan Bunny', 'player.mediadelivery.net/embed/784074/' in src)
    check('Watermark nama pelajar', 'Rohana Ismail' in pg.inner_text('.wm-name'))
    pg.screenshot(path=f'{OUT}/u8-player.png')
    pg.click('text=Kembali'); pg.wait_for_selector('.vitem')

    # versi store (Google Play): tiada sumbangan, tiada bayaran CHIP
    pg.goto(BASE + '/?store=play'); pg.wait_for_selector('.homehead')
    tiles = pg.inner_text('.quick')
    check('Versi store: tiada ikon Sumbang, ada Kiblat', 'Sumbang' not in tiles and 'Kiblat' in tiles)
    pg.click('nav >> text=Akaun'); pg.wait_for_selector('text=Akaun Saya')
    check('Versi store: tiada pautan sumbang di Akaun', pg.locator('a[href="/sumbang"]').count() == 0)
    pg.reload(); pg.wait_for_selector('.nav')
    check('Versi store kekal selepas muat semula', pg.evaluate('STORE') == 'play')
    pg.evaluate("S.modal='subscribe'; loadPlans(); render()"); pg.wait_for_timeout(800)
    check('Versi store: langganan guna Google Play, bukan CHIP', 'Google Play' in pg.inner_text('.modal') and pg.locator('[data-a=payGo]').count() == 0)

    # versi store: beli langganan melalui Google Play (Digital Goods API & API Google tiruan)
    import threading, json as _json
    from http.server import BaseHTTPRequestHandler, HTTPServer
    from datetime import datetime, timezone, timedelta
    class GMock(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def _send(self, obj):
            body = _json.dumps(obj).encode(); self.send_response(200); self.send_header('content-type', 'application/json'); self.end_headers(); self.wfile.write(body)
        def do_POST(self):
            self.rfile.read(int(self.headers.get('content-length') or 0))
            self._send({'access_token': 'g-access-ui', 'expires_in': 3600} if self.path == '/token' else {})
        def do_GET(self):
            if 'subscriptionsv2/tokens/ui-tok-1' not in self.path: self.send_response(404); self.end_headers(); return
            exp = (datetime.now(timezone.utc) + timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
            self._send({'subscriptionState': 'SUBSCRIPTION_STATE_ACTIVE', 'acknowledgementState': 'ACKNOWLEDGEMENT_STATE_PENDING',
                        'lineItems': [{'productId': 'madrasah.bulanan', 'expiryTime': exp, 'autoRenewingPlan': {'autoRenewEnabled': True}}]})
    gsrv = HTTPServer(('127.0.0.1', 8799), GMock); threading.Thread(target=gsrv.serve_forever, daemon=True).start()
    ctx.add_init_script("""
      window.getDigitalGoodsService = async () => ({
        getDetails: async ids => ids.map(id => ({ itemId: id, title: 'Langganan', price: { currency: 'MYR', value: '12.90' } })),
        listPurchases: async () => window.__buy ? [{ itemId: 'madrasah.bulanan', purchaseToken: 'ui-tok-1' }] : [],
      });
      window.PaymentRequest = class { constructor(m) { this.m = m; } async show() { window.__buy = this.m[0].data.sku; return { details: { purchaseToken: 'ui-tok-1' }, complete: async () => {} }; } };
    """)
    pg.reload(); pg.wait_for_selector('.nav')
    pg.evaluate("S.plans=null; S.modal='subscribe'; loadPlans(); render()"); pg.wait_for_selector('[data-a=playBuy]')
    check('Google Play: harga dari Google Play ditunjuk', '12.90' in pg.inner_text('.modal') and pg.locator('[data-a=payGo]').count() == 0)
    pg.screenshot(path=f'{OUT}/u9-play-langgan.png')
    pg.click('[data-a=playBuy]'); pg.wait_for_selector('.modal', state='detached')
    check('Google Play: beli → disahkan server', pg.evaluate('window.__buy') == 'madrasah.bulanan' and '"google"' in str(pg.evaluate('JSON.stringify(S.user.store)')))
    pg.click('nav >> text=Akaun'); pg.wait_for_selector('text=Urus di Google Play')
    check('Google Play: Akaun tunjuk langganan Google Play', 'Langganan melalui Google Play' in pg.inner_text('.shell'))
    pg.screenshot(path=f'{OUT}/u10-play-akaun.png', full_page=True)
    gsrv.shutdown()
    pg.evaluate("sessionStorage.removeItem('mo-store')")

    check('Tiada ralat JavaScript', not errs)
    if errs: print(errs)
    b.close()

print(f"\n{'SEMUA LULUS' if not fails else str(len(fails)) + ' GAGAL'}")
sys.exit(1 if fails else 0)
