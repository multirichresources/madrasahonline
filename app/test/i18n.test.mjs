// Semak setiap teks t('…') dalam app pelajar & halaman sumbangan ada terjemahan English.
// Jalankan: node test/i18n.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync('public/i18n-en.js', 'utf8'), ctx);
const EN = ctx.window.EN_DICT;
const keys = new Set();
for (const f of ['public/pelajar.js', 'public/sumbang.js', 'public/common.js', 'public/padam-akaun.js']) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
  for (const m of s.matchAll(/\bt\((?:D\.f\.monthly|R\.monthly) \? '((?:[^'\\]|\\.)*)' : '((?:[^'\\]|\\.)*)'/g)) { keys.add(m[1]); keys.add(m[2]); }
}
keys.delete('');
const missing = [...keys].filter(k => EN[k] == null && !/^[…]$/.test(k));
const badVars = [...keys].filter(k => EN[k] != null && (k.match(/\{\w+\}/g) || []).sort().join() !== (EN[k].match(/\{\w+\}/g) || []).sort().join());
console.log(`${keys.size} teks, ${missing.length} tiada terjemahan, ${badVars.length} pemboleh ubah tak sepadan`);
missing.forEach(k => console.log('  TIADA:', k));
badVars.forEach(k => console.log('  {VAR}:', k));
process.exit(missing.length || badVars.length ? 1 : 0);
