// Semak kamus English panel admin (public/i18n-admin-en.js):
//  - setiap toast / A.err dalam admin.js dan setiap mesej fail() server ada terjemahan
//  - bilangan {n} sama antara teks BM dan English
// Jalankan: node test/i18n-admin.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'public/i18n-admin-en.js'), 'utf8'), ctx);
const D = ctx.window.EN_ADMIN;
const norm = s => s.replace(/\$\{[^}]*\}/g, '{n}');
const has = s => D[s] != null || D[s.replace(/\d+(?:[.,:]\d+)*/g, '{n}')] != null;

const missing = [];
const admin = fs.readFileSync(path.join(root, 'public/admin.js'), 'utf8');
for (const m of admin.matchAll(/(?:toast|A\.err\s*=)\(?\s*(['`])((?:\\.|(?!\1).)*)\1/g)) {
  const s = norm(m[2]);
  if (/[A-Za-z]/.test(s) && !s.includes('{n}{n}') && !has(s)) missing.push('admin.js: ' + s);
}
for (const f of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(root, 'src', f), 'utf8');
  for (const m of src.matchAll(/fail\(\d+,\s*(['`])((?:\\.|(?!\1).)*)\1/g)) {
    const s = norm(m[2]);
    if (!has(s)) missing.push(`src/${f}: ${s}`);
  }
}
const bad = Object.entries(D).filter(([k, v]) => typeof v === 'string' && (k.match(/\{n\}/g) || []).length !== (v.match(/\{n\}/g) || []).length).map(([k]) => k);

console.log(`${Object.keys(D).length} teks admin, ${missing.length} tiada terjemahan, ${bad.length} {n} tak sepadan`);
missing.forEach(m => console.log('  TIADA  ' + m));
bad.forEach(k => console.log('  {n}    ' + k));
process.exit(missing.length || bad.length ? 1 : 0);
