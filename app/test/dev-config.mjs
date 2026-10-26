// Ujian tempatan: wrangler dev dengan "routes" (domain sebenar) memaksa semua permintaan jadi host route pertama,
// jadi ujian Host (laman web vs apps) tak boleh dibuat. Fail ini cipta wrangler.local.jsonc tanpa "routes".
// Guna: node test/dev-config.mjs && npx wrangler dev -c wrangler.local.jsonc --local --test-scheduled --port 8787 --ip 127.0.0.1
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const out = src.replace(/\n\s*"routes":\s*\[[\s\S]*?\],?\n/, '\n');
if (out === src) throw new Error('Blok "routes" tidak dijumpai dalam wrangler.jsonc');
writeFileSync(new URL('../wrangler.local.jsonc', import.meta.url), '// Dijana oleh test/dev-config.mjs — jangan edit\n' + out);
console.log('wrangler.local.jsonc dicipta');
