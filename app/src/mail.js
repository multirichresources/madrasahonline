// Hantar emel. Sokong dua servis; yang mana dikonfigurasi akan digunakan:
//  1. Cloudflare Email Sending — binding `EMAIL` dalam wrangler.jsonc (perlu pelan Workers Paid + domain di Cloudflare)
//  2. Resend — secret `RESEND_API_KEY`
// Alamat pengirim: var `MAIL_FROM`, contoh "Madrasah Online <noreply@madrasahonline.my>"

// MAIL_DEV=1 hanya dalam .dev.vars (ujian tempatan): emel dicetak ke log, tidak dihantar.
export const mailReady = (env) => env.MAIL_DEV === '1' || (!!env.MAIL_FROM && (!!env.EMAIL || !!env.RESEND_API_KEY));

export async function sendMail(env, { to, subject, text, html }) {
  if (!mailReady(env)) throw new Error('Servis emel belum dikonfigurasi');
  if (env.MAIL_DEV === '1') { console.log('[MAIL_DEV]', to, '|', subject); return; }
  if (env.EMAIL) {
    await env.EMAIL.send({ from: env.MAIL_FROM, to, subject, text, html });
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text, html }),
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function resetCodeEmail(name, code) {
  const text = `Assalamualaikum ${name},

Kod untuk set semula PIN Madrasah Online anda: ${code}

Kod ini sah selama 15 minit. Jika anda tidak meminta kod ini, abaikan emel ini. PIN anda tidak berubah.

Madrasah Online`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#102221;max-width:480px">
  <p>Assalamualaikum ${escHtml(name)},</p>
  <p>Kod untuk set semula PIN Madrasah Online anda:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0d4b44;margin:16px 0">${code}</p>
  <p>Kod ini sah selama 15 minit. Jika anda tidak meminta kod ini, abaikan emel ini. PIN anda tidak berubah.</p>
  <p style="color:#4b5f5c">Madrasah Online</p>
</div>`;
  return { subject: `Kod set semula PIN: ${code}`, text, html };
}
