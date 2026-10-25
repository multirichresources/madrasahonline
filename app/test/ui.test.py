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
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
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
    ad.wait_for_selector('.kpis')
    check('Ringkasan admin dipapar', 'Pelajar aktif' in ad.inner_text('.kpis'))
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
    # player.js Bunny tiruan (rekod arahan dari butang kawalan)
    FAKE_PJ = """window.__pj = [];
      window.playerjs = { Player: function () { const h = {}; this.on = (ev, fn) => { (h[ev] = h[ev] || []).push(fn); if (ev === 'ready') setTimeout(fn, 30); };
        this.supports = () => true; this.setCurrentTime = s => __pj.push(['seek', s]); this.getCurrentTime = cb => cb(100); this.play = () => __pj.push(['play']);
        this.setPlaybackRate = r => __pj.push(['rate', r]); this.getPlaybackRate = cb => cb(1); window.__pjFire = (ev, d) => (h[ev] || []).forEach(f => f(d)); } };"""
    pg.route('https://assets.mediadelivery.net/playerjs/**', lambda route: route.fulfill(status=200, content_type='application/javascript', body=FAKE_PJ))
    pg.route('https://player.mediadelivery.net/**', lambda route: route.fulfill(status=200, content_type='text/html', body='<html><body style="margin:0;background:#111"></body></html>'))
    pg.click('.vitem >> nth=0'); pg.wait_for_selector('#vframe')
    src = pg.get_attribute('#vframe', 'src')
    check('Pemain video guna pautan Bunny', 'player.mediadelivery.net/embed/784074/' in src)
    check('Watermark nama pelajar', 'Rohana Ismail' in pg.inner_text('.wm-name'))
    for _ in range(50):  # wait_for_function disekat CSP (unsafe-eval), jadi semak sendiri
        if pg.evaluate('!!(S.playing && S.playing.ready)'): break
        pg.wait_for_timeout(100)
    check('Bab dalam video dipaparkan', pg.locator('.chap').count() == 3 and 'Hukum nun mati' in pg.inner_text('.chaps'))
    pg.click('[data-a=vBack10]'); pg.wait_for_timeout(100)
    check('Butang 10 saat: undur 10 saat & main', ['seek', 90] in pg.evaluate('__pj') and ['play'] in pg.evaluate('__pj'))
    pg.click('[data-a=vSpeed][data-v="0.75"]')
    check('Butang Perlahan: kelajuan 0.75x', ['rate', 0.75] in pg.evaluate('__pj') and 'on' in pg.get_attribute('[data-a=vSpeed][data-v="0.75"]', 'class'))
    pg.click('.chap >> nth=1'); pg.wait_for_timeout(100)
    check('Tekan bab: lompat ke masa bab', ['seek', 42] in pg.evaluate('__pj'))
    pg.evaluate("__pjFire('timeupdate', { seconds: 95, duration: 300 })")
    check('Bab semasa ditanda ikut masa video', 'now' in pg.get_attribute('.chap >> nth=2', 'class') and 'now' not in pg.get_attribute('.chap >> nth=1', 'class'))
    pg.evaluate('window.scrollTo(0, 0)')
    pg.screenshot(path=f'{OUT}/u8-player.png', full_page=True)
    pg.click('text=Kembali'); pg.wait_for_selector('.vitem')

    # rekod solat: pilih hari & tanda solat
    pg.evaluate("""S.solat = { zone: { area: 'Kuala Lumpur' }, today: { date: myToday(), fajr: Date.now() - 3 * 3600e3, syuruk: Date.now() - 2 * 3600e3,
      dhuhr: Date.now() - 600e3, asr: Date.now() + 3600e3, maghrib: Date.now() + 4 * 3600e3, isha: Date.now() + 5 * 3600e3 } }; S.slogDay = null; S.modal = 'waktu'; render()""")
    pg.wait_for_selector('.slog-chip')
    check('Rekod solat: solat belum masuk waktu dikunci', pg.locator('.slog-chip[data-v=asr]').is_disabled() and not pg.locator('.slog-chip[data-v=fajr]').is_disabled())
    pg.click('.slog-chip[data-v=fajr]')
    check('Rekod solat: tanda Subuh hari ini', 'on' in pg.get_attribute('.slog-chip[data-v=fajr]', 'class') and '1/5' in pg.inner_text('.slog-day.today'))
    pg.click('.slog-day >> nth=5')
    check('Rekod solat: hari semalam semua boleh ditanda', pg.locator('.slog-chip[disabled]').count() == 0)
    for k in ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']: pg.click(f'.slog-chip[data-v={k}]')
    check('Rekod solat: semalam 5/5', '5/5' in pg.inner_text('.slog-day >> nth=5') and 'full' in pg.get_attribute('.slog-day >> nth=5', 'class'))
    pg.locator('.slog').screenshot(path=f'{OUT}/u11-rekod-solat.png')
    pg.evaluate("S.modal = null; render()")

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

    # panel admin versi desktop (command center)
    ad.set_viewport_size({'width': 1440, 'height': 900})
    ad.evaluate('A.modal = null; render()')
    ad.click('.adm-nav >> text=Ringkasan'); ad.wait_for_selector('.kpis'); ad.wait_for_selector('.hbars, .dash-e .muted')
    check('Desktop: menu admin di tepi', ad.evaluate("getComputedStyle(document.querySelector('.adm-nav')).flexDirection") == 'column')
    check('Desktop: KPI satu baris (5 lajur)', ad.evaluate("getComputedStyle(document.querySelector('.kpis')).gridTemplateColumns.split(' ').length") == 5)
    ad.hover('.dash-a .vz-bar.s1 >> nth=-1'); ad.wait_for_timeout(150)
    check('Carta: tooltip nilai bila hover', not ad.evaluate("document.querySelector('.viz-tip').hidden") and 'RM' in ad.inner_text('.viz-tip'))
    ad.screenshot(path=f'{OUT}/a9-desktop.png', full_page=True)
    # paparan 3D
    ad.click('[data-a=view3d][data-v="1"]'); ad.wait_for_selector('.m3d-root canvas', timeout=20000); ad.wait_for_timeout(800)
    check('3D: dunia madrasah dipapar dengan 6 kad', ad.locator('.m3d-card').count() == 6 and ad.inner_text('.m3d-card[data-zone=ringkasan] .m3d-cv').strip().isdigit())
    check('3D: kad terletak dalam kotak paparan', ad.evaluate("[...document.querySelectorAll('.m3d-card')].every(c => { const r = c.getBoundingClientRect(), w = document.getElementById('m3dWrap').getBoundingClientRect(); return r.left >= w.left - 1 && r.right <= w.right + 1 && r.top >= w.top - 1; })"))
    ad.screenshot(path=f'{OUT}/a10-3d.png')
    ad.click('.m3d-card[data-zone=soalan]'); ad.wait_for_timeout(300)
    check('3D: tekan Peti soalan buka tab Soalan', ad.evaluate('A.tab') == 'soalan')
    ad.click('.adm-nav >> text=Ringkasan'); ad.wait_for_selector('.m3d-root canvas')
    check('3D: pilihan paparan diingat', ad.evaluate('A.view3d') is True)
    ad.click('[data-a=view3d][data-v="0"]'); ad.wait_for_selector('.kpis')
    check('3D: kembali ke papan pemuka', ad.locator('.m3d-root').count() == 0)
    ad.set_viewport_size({'width': 390, 'height': 844})
    # laman web: Jelajah Madrasah Online (3D)
    sp = ctx.new_page(); serrs = []; sp.on('pageerror', lambda e: serrs.append(str(e)))
    sp.route('https://fonts.googleapis.com/**', lambda r: r.abort()); sp.route('https://fonts.gstatic.com/**', lambda r: r.abort())
    sp.goto(BASE + '/site/'); sp.locator('#jelajah').scroll_into_view_if_needed()
    sp.wait_for_selector('.m3d-root canvas', timeout=20000)
    check('Laman web: madrasah 3D dimuat bila sampai ke bahagian Jelajah', sp.locator('.m3d-card').count() == 6)
    sp.click('.tour-list button[data-zone=soalan]')
    check('Laman web: pilih bahagian tunjuk penerangan', 'Tanya ustaz' in sp.inner_text('#tourInfo') and sp.get_attribute('.tour-list button[data-zone=soalan]', 'aria-pressed') == 'true')
    sp.evaluate("document.querySelector('.m3d-card[data-zone=video]').click()")  # di telefon kad lain disorok
    check('Laman web: tekan kad 3D tukar penerangan', 'Video kelas ustaz' in sp.inner_text('#tourInfo'))
    check('Laman web: tiada ralat JavaScript', not serrs)
    sp.close()
    check('Tiada ralat JavaScript', not errs)
    if errs: print(errs)
    b.close()

print(f"\n{'SEMUA LULUS' if not fails else str(len(fails)) + ' GAGAL'}")
sys.exit(1 if fails else 0)
