// "Madrasah Online" sebagai dunia 3D kecil yang boleh dipusing & ditekan.
// Dipakai oleh panel admin (data langsung) dan laman web baitalsalihin.com (lawatan ciri apps).
// Dibina jadi public/m3d.js:  npm run build:3d
// Admin: Madrasah3D.mount(bekas, data, { onNavigate(tab), dark })
// Laman web: Madrasah3D.mount(bekas, null, { theme: 'site', cards: {id: {label, value, sub}}, onSelect(id), live: false, people: 24, hint })
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  CapsuleGeometry, TorusGeometry, MeshStandardMaterial, MeshBasicMaterial, AmbientLight, DirectionalLight,
  HemisphereLight, Raycaster, Vector2, Vector3, Color, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial,
  PlaneGeometry, SRGBColorSpace,
} from 'three';

const THEMES = {
  site: {
    disc: 0x14504a, discTop: 0x185a53, rim: 0xc9a96a, tick: 0x4e8a80, wall: 0xf3eee2, roof: 0xd9d0bb, dome: 0xd4a94c,
    trim: 0x0d4b44, door: 0x0b3029, glass: 0x5cc4b0, accent: 0xc9a96a, light: 0.85, hemiSky: 0xfff4dc, hemiGround: 0x0b3d37,
    spark: 0xe6cc8f, people: [0x5cc4b0, 0xd4a94c, 0xf3eee2, 0xe08aa8, 0x8fb3ff],
  },
  dark: {
    disc: 0x163f47, discTop: 0x1a4a53, rim: 0x3ad6c0, tick: 0x3f8f95, wall: 0xe9e4d6, roof: 0xc9c1ad, dome: 0xd9a441,
    trim: 0x0d4b44, door: 0x10302c, glass: 0x3aa894, accent: 0xcf7a26, light: 0.75, hemiSky: 0x9fd9ff, hemiGround: 0x0b1b22,
    spark: 0x7fe6d6, people: [0x3aa894, 0xd9a441, 0x8fb3ff, 0xe08aa8, 0xf0efe8],
  },
  light: {
    disc: 0xdfeee9, discTop: 0xeaf5f1, rim: 0x00897a, tick: 0x9cc9c0, wall: 0xfffaf0, roof: 0xe3dccb, dome: 0xc99a3a,
    trim: 0x0d4b44, door: 0x0d3b38, glass: 0x00897a, accent: 0xc97316, light: 1.0, hemiSky: 0xffffff, hemiGround: 0xcfe3dd,
    spark: 0x00897a, people: [0x00897a, 0xc99a3a, 0x4f6fd1, 0xc5537a, 0x37474f],
  },
};

let S = null; // keadaan paparan (kekal walaupun panel admin dilukis semula)

const std = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new Mesh(new BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); return m; }
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) { const m = new Mesh(new CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y + h / 2, z); return m; }

function buildWorld(T) {
  const world = new Group(), zones = [];
  // tapak bulat + gelang bercahaya + tanda di tepi
  world.add(cyl(9.2, 9.4, 0.5, std(T.disc), 0, -0.5, 0, 64));
  const top = new Mesh(new CylinderGeometry(9.2, 9.2, 0.02, 64), std(T.discTop)); top.position.y = 0.01; world.add(top);
  const ring = new Mesh(new TorusGeometry(9.25, 0.05, 8, 128), new MeshBasicMaterial({ color: T.rim })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; world.add(ring);
  const inner = new Mesh(new TorusGeometry(8.4, 0.02, 6, 128), new MeshBasicMaterial({ color: T.tick })); inner.rotation.x = Math.PI / 2; inner.position.y = 0.03; world.add(inner);
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, long = i % 6 === 0;
    const t = new Mesh(new BoxGeometry(0.05, 0.02, long ? 0.45 : 0.22), new MeshBasicMaterial({ color: T.tick }));
    t.position.set(Math.cos(a) * 8.75, 0.03, Math.sin(a) * 8.75); t.rotation.y = -a + Math.PI / 2; world.add(t);
  }

  const wall = std(T.wall), roof = std(T.roof), gold = std(T.dome, { metalness: 0.35, roughness: 0.35 }), trim = std(T.trim), door = std(T.door);
  const glass = std(T.glass, { emissive: new Color(T.glass), emissiveIntensity: 0.55 });
  const zone = (id, group, anchorY) => { group.userData.zone = id; zones.push({ id, group, anchor: new Vector3(group.position.x, anchorY, group.position.z) }); world.add(group); return group; };

  // ---- madrasah utama (tengah) ----
  const main = new Group();
  main.add(box(5, 0.25, 3.6, trim, 0, 0, 0));
  main.add(box(4.4, 2.3, 3, wall, 0, 0.25, 0));
  main.add(box(4.7, 0.18, 3.3, roof, 0, 2.55, 0));
  const drum = cyl(1.15, 1.15, 0.45, wall, 0, 2.73, 0); main.add(drum);
  const dome = new Mesh(new SphereGeometry(1.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), gold); dome.position.y = 3.18; main.add(dome);
  main.add(cyl(0.04, 0.04, 0.5, gold, 0, 4.3, 0, 8));
  const crescent = new Mesh(new TorusGeometry(0.16, 0.035, 8, 24, Math.PI * 1.4), gold); crescent.position.y = 4.95; crescent.rotation.z = 0.9; main.add(crescent);
  main.add(box(0.9, 1.5, 0.12, door, 0, 0.25, 1.52));                            // pintu
  for (const x of [-1.5, -0.9, 0.9, 1.5]) main.add(box(0.36, 0.7, 0.08, glass, x, 1.05, 1.52)); // tingkap
  for (const sx of [-1, 1]) {                                                      // menara
    main.add(cyl(0.3, 0.34, 4.4, wall, sx * 2.55, 0.25, 1.65));
    main.add(cyl(0.42, 0.42, 0.14, trim, sx * 2.55, 3.4, 1.65));
    main.add(cyl(0.42, 0.42, 0.14, trim, sx * 2.55, 4.65, 1.65));
    const c = new Mesh(new ConeGeometry(0.36, 0.9, 20), gold); c.position.set(sx * 2.55, 5.1, 1.65); main.add(c);
  }
  zone('ringkasan', main, 6.2);

  // ---- bilik kelas video (kiri depan) ----
  const kelas = new Group(); kelas.position.set(-6, 0, 2.4);
  kelas.add(box(2.6, 1.5, 1.9, wall)); kelas.add(box(2.8, 0.14, 2.1, trim, 0, 1.5, 0));
  const screen = box(1.9, 1.05, 0.06, glass, 0, 0.25, 0.98); kelas.add(screen);
  const play = new Mesh(new ConeGeometry(0.22, 0.34, 3), std(0xffffff, { emissive: new Color(0xffffff), emissiveIntensity: 0.6 }));
  play.rotation.z = -Math.PI / 2; play.position.set(0.04, 0.78, 1.03); kelas.add(play);
  zone('video', kelas, 2.6);

  // ---- pejabat pelajar (kanan depan) ----
  const pejabat = new Group(); pejabat.position.set(6, 0, 2.4);
  pejabat.add(box(2.2, 2.2, 1.8, wall)); pejabat.add(box(2.4, 0.14, 2, trim, 0, 2.2, 0));
  for (let r = 0; r < 2; r++) for (const x of [-0.55, 0, 0.55]) pejabat.add(box(0.3, 0.42, 0.06, glass, x, 0.45 + r * 0.85, 0.92));
  pejabat.add(cyl(0.03, 0.03, 1.1, trim, 0.8, 2.34, -0.5, 6));
  const flag = box(0.55, 0.32, 0.02, std(T.accent), 1.08, 3.05, -0.5); pejabat.add(flag);
  zone('pelajar', pejabat, 3.6);

  // ---- tabung sumbangan (kiri belakang): wakaf kecil ----
  const tabung = new Group(); tabung.position.set(-4.3, 0, -5.6);
  tabung.add(cyl(1.25, 1.35, 0.2, trim));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; tabung.add(cyl(0.07, 0.07, 1.5, wall, Math.cos(a) * 1, 0.2, Math.sin(a) * 1, 8)); }
  const roofC = new Mesh(new ConeGeometry(1.45, 0.9, 6), gold); roofC.position.y = 2.15; tabung.add(roofC);
  tabung.add(box(0.55, 0.6, 0.45, std(T.accent), 0, 0.2, 0));
  zone('sumbangan', tabung, 3.1);

  // ---- peti soalan (kanan belakang) ----
  const soalan = new Group(); soalan.position.set(4.3, 0, -5.6);
  soalan.add(cyl(0.12, 0.12, 1.1, trim, 0, 0, 0, 10));
  soalan.add(box(1.3, 0.95, 0.9, wall, 0, 1.1, 0));
  soalan.add(box(0.8, 0.06, 0.04, door, 0, 1.75, 0.46));
  const bubble = new Mesh(new SphereGeometry(0.42, 24, 16), std(T.glass, { emissive: new Color(T.glass), emissiveIntensity: 0.45 }));
  bubble.position.set(0, 2.65, 0); soalan.add(bubble); soalan.userData.bubble = bubble;
  zone('soalan', soalan, 3.4);

  // ---- papan hebahan (depan) ----
  const hebahan = new Group(); hebahan.position.set(0, 0, 6.3);
  for (const x of [-1, 1]) hebahan.add(cyl(0.06, 0.06, 1.3, trim, x, 0, 0, 8));
  hebahan.add(box(2.4, 0.9, 0.1, std(T.trim, { emissive: new Color(T.trim), emissiveIntensity: 0.25 }), 0, 1.0, 0));
  hebahan.add(box(2.0, 0.08, 0.12, std(T.dome), 0, 1.55, 0));
  zone('hebahan', hebahan, 2.4);

  return { world, zones };
}

// Pelajar kecil yang berjalan mengelilingi madrasah (bilangan ikut pelajar aktif, maksimum 40)
function buildPeople(T, n) {
  const g = new Group(), list = [];
  const head = new SphereGeometry(0.13, 12, 8), body = new CapsuleGeometry(0.12, 0.28, 4, 8);
  for (let i = 0; i < n; i++) {
    const c = T.people[i % T.people.length], p = new Group();
    const b = new Mesh(body, std(c)); b.position.y = 0.26; p.add(b);
    const h = new Mesh(head, std(0xf1d3b3)); h.position.y = 0.6; p.add(h);
    const r = 7.6 + (i % 3) * 0.35, a = (i / n) * Math.PI * 2, sp = (0.05 + (i % 5) * 0.012) * (i % 2 ? 1 : -1);
    list.push({ p, r, a, sp, bob: i * 0.7 }); g.add(p);
  }
  return { g, list };
}

function sparkles(T) {
  const pos = [];
  for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 9; pos.push(Math.cos(a) * r, 1 + Math.random() * 7, Math.sin(a) * r); }
  const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return new Points(geo, new PointsMaterial({ color: T.spark, size: 0.07, transparent: true, opacity: 0.7 }));
}

const LABELS = {
  ringkasan: 'Pelajar aktif', video: 'Bilik kelas video', pelajar: 'Pejabat pelajar',
  sumbangan: 'Tabung sumbangan', soalan: 'Peti soalan', hebahan: 'Papan hebahan',
};
const TARGET = { ringkasan: 'pelajar', video: 'video', pelajar: 'pelajar', sumbangan: 'sumbangan', soalan: 'soalan', hebahan: 'hebahan' };

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

// Tekan bangunan/kad: admin buka tab; laman web tunjuk penerangan ciri
function activate(id) {
  if (!S || !id) return;
  if (S.opts.onSelect) { S.sel = id; setHover(S.hover); S.opts.onSelect(id); }
  else if (S.opts.onNavigate) S.opts.onNavigate(TARGET[id]);
}

function buildOverlay(opts) {
  const ov = el('div', 'm3d-ov');
  const cards = {}, labels = { ...LABELS, ...Object.fromEntries(Object.entries(opts.cards || {}).map(([k, v]) => [k, v.label])) };
  for (const id of Object.keys(LABELS)) {
    const c = el('button', 'm3d-card'); c.type = 'button'; c.dataset.zone = id;
    c.append(el('span', 'm3d-cl', labels[id]), el('b', 'm3d-cv', '–'), el('span', 'm3d-cs', ''));
    c.addEventListener('click', () => activate(id));
    c.addEventListener('pointerenter', () => setHover(id)); c.addEventListener('pointerleave', () => setHover(null));
    ov.appendChild(c); cards[id] = c;
  }
  const live = el('div', 'm3d-live');
  live.append(el('span', 'm3d-livebadge', 'LIVE'));
  const rows = {};
  // baris "mob" hanya dipapar di telefon (kad terapung lain disorok kerana skrin kecil)
  for (const [k, l, mob] of [['kutipan', 'Kutipan bulan ini'], ['sumbangan', 'Sumbangan bulan ini'], ['baharu', 'Pelajar baharu 30 hari'], ['tonton', 'Tonton video 7 hari'],
    ['soalan', 'Soalan menunggu', 1], ['notif', 'Terima notifikasi', 1]]) {
    const r = el('div', mob ? 'm3d-row m3d-mob' : 'm3d-row'); const v = el('b', '', '–'); r.append(el('span', '', l), v); live.appendChild(r); rows[k] = v;
  }
  if (opts.live !== false) ov.appendChild(live);
  ov.appendChild(el('div', 'm3d-hint', opts.hint || 'Seret untuk pusing · tekan bangunan untuk buka'));
  return { ov, cards, rows };
}

function setHover(id) {
  if (!S) return;
  S.hover = id;
  for (const z of S.zones) z.group.scale.setScalar(z.id === id || z.id === S.sel ? 1.06 : 1);
  for (const [k, c] of Object.entries(S.ui.cards)) c.classList.toggle('on', k === id || k === S.sel);
  S.canvas.style.cursor = id ? 'pointer' : 'grab';
}

const rm = sen => 'RM' + (sen / 100).toLocaleString('en-MY', { maximumFractionDigits: sen % 100 ? 2 : 0 });
// Laman web: isi kad dengan teks tetap
function setCards(cards) {
  for (const [id, v] of Object.entries(cards || {})) {
    const c = S.ui.cards[id]; if (!c) continue;
    c.children[0].textContent = v.label || ''; c.children[1].textContent = v.value || ''; c.children[2].textContent = v.sub || '';
  }
  const want = S.opts.people || 24;
  if (!S.people || S.people.list.length !== want) { if (S.people) S.world.remove(S.people.g); S.people = buildPeople(S.T, want); S.world.add(S.people.g); }
}

function fill(d) {
  if (!d) { setCards(S.opts.cards); return; }
  const st = d.dash.status, active = st.aktif + st.hampirTamat, cur = d.dash.revenue[d.dash.revenue.length - 1];
  const set = (id, v, s) => { const c = S.ui.cards[id]; c.children[1].textContent = v; c.children[2].textContent = s; };
  set('ringkasan', String(active), `${d.stats.totalUsers} berdaftar · ${st.hampirTamat} tamat ≤ 7 hari`);
  set('video', `${d.dash.watchers7} pelajar`, 'tonton dalam 7 hari');
  set('pelajar', `${d.dash.newUsers30} baharu`, `${st.belumBayar} belum bayar`);
  set('sumbangan', rm(cur.sumbangan), 'bulan ini');
  set('soalan', `${d.stats.unansweredQuestions} menunggu`, d.stats.unansweredQuestions ? 'tekan untuk jawab' : 'semua dah dijawab');
  set('hebahan', `${d.stats.pushUsers} telefon`, 'terima notifikasi');
  S.ui.rows.kutipan.textContent = rm(cur.langganan);
  S.ui.rows.sumbangan.textContent = rm(cur.sumbangan);
  S.ui.rows.baharu.textContent = String(d.dash.newUsers30);
  S.ui.rows.tonton.textContent = String(d.dash.watchers7);
  S.ui.rows.soalan.textContent = String(d.stats.unansweredQuestions);
  S.ui.rows.notif.textContent = String(d.stats.pushUsers);
  S.waiting = d.stats.unansweredQuestions > 0;
  const want = Math.min(40, active);
  if (!S.people || S.people.list.length !== want) {
    if (S.people) S.world.remove(S.people.g);
    S.people = buildPeople(S.T, want); S.world.add(S.people.g);
  }
}

function build(theme) {
  const T = THEMES[theme] || THEMES.light;
  const scene = new Scene();
  scene.add(new HemisphereLight(T.hemiSky, T.hemiGround, 0.9 * T.light));
  scene.add(new AmbientLight(0xffffff, 0.35 * T.light));
  const sun = new DirectionalLight(0xffffff, 1.6 * T.light); sun.position.set(8, 14, 6); scene.add(sun);
  const { world, zones } = buildWorld(T);
  scene.add(world);
  const sp = sparkles(T); world.add(sp);
  return { T, scene, world, zones, sp, theme };
}

export function mount(container, data, opts = {}) {
  if (!S) {
    const canvas = document.createElement('canvas');
    let renderer;
    try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true }); }
    catch { return false; }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const root = el('div', 'm3d-root'); root.appendChild(canvas);
    const ui = buildOverlay(opts); root.appendChild(ui.ov);
    const camera = new PerspectiveCamera(32, 1, 0.1, 200);
    S = { root, canvas, renderer, camera, ui, opts, theta: 0.6, phi: 0.62, dist: 31, drag: null, idle: 0, hover: null, people: null,
      reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, ray: new Raycaster(), ptr: new Vector2(), raf: 0, last: performance.now() };
    Object.assign(S, build(themeOf(opts)));
    bindInput();
  }
  S.opts = opts;
  if (themeOf(opts) !== S.theme) retheme(themeOf(opts));
  container.appendChild(S.root);
  fill(data);
  resize();
  if (!S.ro) { S.ro = new ResizeObserver(resize); }
  S.ro.disconnect(); S.ro.observe(container);
  if (!S.raf) loop();
  return true;
}

const themeOf = o => o.theme || (o.dark ? 'dark' : 'light');
export function update(data, opts = {}) { if (!S) return; Object.assign(S.opts, opts); if (themeOf(S.opts) !== S.theme) retheme(themeOf(S.opts)); fill(data); }
export function select(id) { if (!S) return; S.sel = id; setHover(S.hover); }

export function unmount() {
  if (!S) return;
  cancelAnimationFrame(S.raf); S.raf = 0;
  if (S.ro) S.ro.disconnect();
  S.root.remove();
}

function retheme(theme) {
  S.scene.clear?.();
  const keepPeople = S.people ? S.people.list.length : 0;
  Object.assign(S, build(theme));
  S.people = buildPeople(S.T, keepPeople); S.world.add(S.people.g);
}

function resize() {
  if (!S || !S.root.parentNode) return;
  const w = S.root.clientWidth, h = S.root.clientHeight;
  if (!w || !h) return;
  S.renderer.setSize(w, h, false);
  S.camera.aspect = w / h;
  // jarak kamera supaya tapak bulat muat ikut lebar skrin (telefon menegak perlukan jarak lebih jauh)
  const hHalf = Math.atan(Math.tan(S.camera.fov * Math.PI / 360) * S.camera.aspect);
  S.dist = Math.max(29, 11.4 / Math.tan(hHalf));
  // skrin menegak (telefon): pandang lebih dari atas supaya tapak memenuhi ruang
  if (!S.touched) S.phi = S.camera.aspect < 1 ? 0.98 : 0.62;
  // telefon: anjak paparan ke atas supaya panel LIVE di bawah tidak menutup tapak
  if (S.camera.aspect < 1 && S.opts.live !== false) S.camera.setViewOffset(w, h, 0, h * 0.16, w, h); else S.camera.clearViewOffset();
  S.camera.updateProjectionMatrix();
}

function bindInput() {
  const c = S.canvas;
  c.style.cursor = 'grab'; c.style.touchAction = 'none';
  c.addEventListener('pointerdown', e => { S.touched = true; S.drag = { x: e.clientX, y: e.clientY, t: S.theta, p: S.phi, moved: false }; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    S.ptr.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (S.drag) {
      const dx = e.clientX - S.drag.x, dy = e.clientY - S.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) S.drag.moved = true;
      S.theta = S.drag.t - dx * 0.008;
      S.phi = Math.max(0.32, Math.min(1.15, S.drag.p - dy * 0.005));
      S.idle = 0;
    } else setHover(pick());
  });
  c.addEventListener('pointerup', e => {
    const d = S.drag; S.drag = null;
    if (d && !d.moved) activate(pick());
  });
  c.addEventListener('pointerleave', () => { if (!S.drag) setHover(null); });
  c.addEventListener('wheel', e => { e.preventDefault(); S.zoom = Math.max(0.7, Math.min(1.35, (S.zoom || 1) * (e.deltaY > 0 ? 1.08 : 0.93))); }, { passive: false });
}

function pick() {
  S.ray.setFromCamera(S.ptr, S.camera);
  const hit = S.ray.intersectObjects(S.zones.map(z => z.group), true)[0];
  let o = hit && hit.object;
  while (o && !o.userData.zone) o = o.parent;
  return o ? o.userData.zone : null;
}

const tmp = new Vector3();
function loop() {
  S.raf = requestAnimationFrame(loop);
  if (!S.root.isConnected || document.hidden) return;
  const now = performance.now(), dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
  S.idle += dt;
  if (!S.reduce && !S.drag && S.idle > 2.5) S.theta += dt * 0.06; // pusing perlahan bila tiada sentuhan
  const dist = S.dist * (S.zoom || 1);
  S.camera.position.set(Math.sin(S.theta) * Math.cos(S.phi) * dist, Math.sin(S.phi) * dist + 1, Math.cos(S.theta) * Math.cos(S.phi) * dist);
  S.camera.lookAt(0, 1.1, 0);
  if (!S.reduce) {
    const t = now / 1000;
    if (S.people) for (const q of S.people.list) {
      q.a += q.sp * dt;
      q.p.position.set(Math.cos(q.a) * q.r, Math.abs(Math.sin(t * 4 + q.bob)) * 0.05, Math.sin(q.a) * q.r);
      q.p.rotation.y = -q.a + (q.sp > 0 ? Math.PI : 0);
    }
    S.sp.rotation.y += dt * 0.02;
    const soal = S.zones.find(z => z.id === 'soalan');
    if (soal && soal.group.userData.bubble) {
      const b = soal.group.userData.bubble;
      b.position.y = 2.65 + Math.sin(t * 2) * 0.12;
      b.scale.setScalar(S.waiting ? 1 + Math.sin(t * 4) * 0.08 : 0.85);
    }
  } else if (S.people) {
    for (const q of S.people.list) q.p.position.set(Math.cos(q.a) * q.r, 0, Math.sin(q.a) * q.r);
  }
  S.renderer.render(S.scene, S.camera);
  placeCards();
}

// Letak kad label di atas bangunan; kad yang bertindih dianjak ke atas (garis penunjuk kekal ke bangunan)
function placeCards() {
  const W = S.root.clientWidth, H = S.root.clientHeight, items = [];
  for (const z of S.zones) {
    const c = S.ui.cards[z.id]; if (!c) continue;
    tmp.copy(z.anchor).applyMatrix4(S.world.matrixWorld).project(S.camera);
    const depth = z.group.position.clone().applyMatrix4(S.world.matrixWorld).distanceTo(S.camera.position);
    items.push({ c, id: z.id, x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H, w: c.offsetWidth, h: c.offsetHeight, depth });
  }
  // utama dulu, kemudian yang paling dekat dengan kamera
  items.sort((a, b) => (a.id === 'ringkasan' ? -1 : b.id === 'ringkasan' ? 1 : a.depth - b.depth));
  const placed = [], gap = 6;
  const hits = r => placed.find(p => r.left < p.left + p.w + gap && r.left + r.w + gap > p.left && r.top < p.top + p.h + gap && r.top + r.h + gap > p.top);
  for (const it of items) {
    if (!it.w) continue; // kad disorok (telefon)
    const r = { w: it.w, h: it.h, left: Math.max(6, Math.min(W - it.w - 6, it.x - it.w / 2)), top: it.y - it.h - 10 };
    for (let guard = 0, o; guard < 8 && (o = hits(r)); guard++) {
      const up = o.top - r.h - gap, down = o.top + o.h + gap;
      r.top = up >= 6 && it.y - up < H * 0.6 ? up : down; // naik dahulu; jika terlalu jauh, turun
    }
    r.top = Math.max(6, Math.min(H - r.h - 6, r.top));
    placed.push(r);
    const stem = Math.max(0, it.y - (r.top + r.h));
    it.c.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
    it.c.style.setProperty('--stem', stem + 'px');
    it.c.style.setProperty('--sx', Math.round(Math.max(10, Math.min(r.w - 10, it.x - r.left))) + 'px');
    it.c.style.opacity = it.id === 'ringkasan' ? 1 : Math.max(0.7, Math.min(1, 1.5 - (it.depth - S.dist * (S.zoom || 1) + 6) / 16));
    it.c.style.zIndex = String(1000 - Math.round(it.depth * 10));
  }
}

window.Madrasah3D = { mount, update, unmount, select };
