// Madrasah Online — Cloudflare Worker: API + fail statik (public/).
import { json, fail, HttpError, now } from './util.js';
import {
  register, login, logout, me, changePin, deleteAccount,
  adminLogin, adminMe, createAdmin, adminResetPin, requireAdmin, publicUser,
  setupStatus, adminChangePassword,
} from './auth.js';
import { publicConfig, forgotPin, resetPin, updateEmail } from './reset.js';
import {
  adminCreateVideo, adminUploadTicket, adminListVideos, adminUpdateVideo, adminDeleteVideo,
  listVideos, playVideo, saveProgress, adminSetSubscription, adminBunnyVideos, adminImportVideo,
} from './videos.js';
import {
  adminGetSettings, adminSaveSettings, listAnnouncements,
  adminListAnnouncements, adminCreateAnnouncement, adminUpdateAnnouncement, adminDeleteAnnouncement,
} from './content.js';
import { legalPaths, renderLegal } from './legal.js';
import { pushKey, pushSubscribe, pushUnsubscribe, pushTest, pushInbox, processJobs, sendClassReminders } from './push.js';
import { listQuestions, askQuestion, deleteOwnQuestion, adminListQuestions, adminAnswer, adminHideQuestion } from './questions.js';

// Lindung daripada permintaan silang laman (CSRF): POST/PUT/DELETE mesti datang dari domain sendiri.
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // pelayar lama / alat CLI; kuki SameSite=Lax tetap melindungi
  return origin === new URL(request.url).origin;
}

const routes = [
  ['POST', /^\/api\/register$/, (env, req) => register(env, req)],
  ['POST', /^\/api\/login$/, (env, req) => login(env, req)],
  ['POST', /^\/api\/logout$/, (env, req) => logout(env, req, 'user')],
  ['GET', /^\/api\/me$/, (env, req) => me(env, req)],
  ['POST', /^\/api\/me\/pin$/, (env, req) => changePin(env, req)],
  ['POST', /^\/api\/me\/delete$/, (env, req) => deleteAccount(env, req)],
  ['POST', /^\/api\/me\/email$/, (env, req) => updateEmail(env, req)],
  ['GET', /^\/api\/config$/, (env) => publicConfig(env)],
  ['POST', /^\/api\/pin\/forgot$/, (env, req) => forgotPin(env, req)],
  ['POST', /^\/api\/pin\/reset$/, (env, req) => resetPin(env, req)],

  ['POST', /^\/api\/admin\/login$/, (env, req) => adminLogin(env, req)],
  ['POST', /^\/api\/admin\/logout$/, (env, req) => logout(env, req, 'admin')],
  ['GET', /^\/api\/admin\/me$/, (env, req) => adminMe(env, req)],
  ['GET', /^\/api\/admin\/setup-status$/, (env) => setupStatus(env)],
  ['POST', /^\/api\/admin\/password$/, (env, req) => adminChangePassword(env, req)],
  ['POST', /^\/api\/admin\/admins$/, (env, req) => createAdmin(env, req)],
  ['GET', /^\/api\/admin\/stats$/, (env, req) => adminStats(env, req)],
  ['GET', /^\/api\/admin\/users$/, (env, req) => adminUsers(env, req)],
  ['POST', /^\/api\/admin\/users\/(\d+)\/pin$/, (env, req, m) => adminResetPin(env, req, Number(m[1]))],
  ['POST', /^\/api\/admin\/users\/(\d+)\/subscription$/, (env, req, m) => adminSetSubscription(env, req, Number(m[1]))],

  ['GET', /^\/api\/videos$/, (env, req) => listVideos(env, req)],
  ['GET', /^\/api\/videos\/(\d+)\/play$/, (env, req, m) => playVideo(env, req, Number(m[1]))],
  ['POST', /^\/api\/videos\/(\d+)\/progress$/, (env, req, m) => saveProgress(env, req, Number(m[1]))],
  ['GET', /^\/api\/admin\/videos$/, (env, req) => adminListVideos(env, req)],
  ['GET', /^\/api\/admin\/bunny-videos$/, (env, req) => adminBunnyVideos(env, req)],
  ['POST', /^\/api\/admin\/videos\/import$/, (env, req) => adminImportVideo(env, req)],
  ['POST', /^\/api\/admin\/videos$/, (env, req) => adminCreateVideo(env, req)],
  ['POST', /^\/api\/admin\/videos\/(\d+)$/, (env, req, m) => adminUpdateVideo(env, req, Number(m[1]))],
  ['POST', /^\/api\/admin\/videos\/(\d+)\/delete$/, (env, req, m) => adminDeleteVideo(env, req, Number(m[1]))],
  ['POST', /^\/api\/admin\/videos\/(\d+)\/upload-ticket$/, (env, req, m) => adminUploadTicket(env, req, Number(m[1]))],

  ['GET', /^\/api\/announcements$/, (env, req) => listAnnouncements(env, req)],
  ['GET', /^\/api\/admin\/announcements$/, (env, req) => adminListAnnouncements(env, req)],
  ['POST', /^\/api\/admin\/announcements$/, (env, req, m, ctx) => adminCreateAnnouncement(env, req, ctx)],
  ['POST', /^\/api\/admin\/announcements\/(\d+)$/, (env, req, m) => adminUpdateAnnouncement(env, req, Number(m[1]))],
  ['POST', /^\/api\/admin\/announcements\/(\d+)\/delete$/, (env, req, m) => adminDeleteAnnouncement(env, req, Number(m[1]))],
  ['GET', /^\/api\/admin\/settings$/, (env, req) => adminGetSettings(env, req)],
  ['POST', /^\/api\/admin\/settings$/, (env, req) => adminSaveSettings(env, req)],

  ['GET', /^\/api\/questions$/, (env, req) => listQuestions(env, req)],
  ['POST', /^\/api\/questions$/, (env, req) => askQuestion(env, req)],
  ['POST', /^\/api\/questions\/(\d+)\/delete$/, (env, req, m) => deleteOwnQuestion(env, req, Number(m[1]))],
  ['GET', /^\/api\/admin\/questions$/, (env, req) => adminListQuestions(env, req)],
  ['POST', /^\/api\/admin\/questions\/(\d+)\/answer$/, (env, req, m, ctx) => adminAnswer(env, req, Number(m[1]), ctx)],
  ['POST', /^\/api\/admin\/questions\/(\d+)\/hide$/, (env, req, m) => adminHideQuestion(env, req, Number(m[1]))],

  ['GET', /^\/api\/push\/key$/, (env, req) => pushKey(env, req)],
  ['POST', /^\/api\/push\/subscribe$/, (env, req) => pushSubscribe(env, req)],
  ['POST', /^\/api\/push\/unsubscribe$/, (env, req) => pushUnsubscribe(env, req)],
  ['POST', /^\/api\/push\/test$/, (env, req) => pushTest(env, req)],
  ['GET', /^\/api\/push\/inbox$/, (env, req) => pushInbox(env, req)],
];

async function adminStats(env, request) {
  await requireAdmin(env, request);
  const t = now();
  const week = t + 7 * 24 * 3600 * 1000;
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [total, active, expiring, unpaid, revenue, unanswered, pushUsers] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM users'),
    env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE paid_until > ?').bind(t),
    env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE paid_until > ? AND paid_until <= ?').bind(t, week),
    env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE paid_until IS NULL'),
    env.DB.prepare("SELECT COALESCE(SUM(amount_sen), 0) AS s FROM payments WHERE status = 'completed' AND purpose = 'langganan' AND completed_at >= ?").bind(monthStart.getTime()),
    env.DB.prepare('SELECT COUNT(*) AS n FROM questions WHERE hidden = 0 AND answer IS NULL'),
    env.DB.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM push_subs'),
  ]);
  return json({
    ok: true,
    stats: {
      totalUsers: total.results[0].n,
      activeUsers: active.results[0].n,
      expiringIn7Days: expiring.results[0].n,
      registeredNotPaid: unpaid.results[0].n,
      revenueThisMonthSen: revenue.results[0].s,
      unansweredQuestions: unanswered.results[0].n,
      pushUsers: pushUsers.results[0].n,
    },
  });
}

async function adminUsers(env, request) {
  await requireAdmin(env, request);
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const filter = url.searchParams.get('status') || 'semua';
  const t = now();
  let sql = 'SELECT * FROM users WHERE 1=1';
  const args = [];
  if (q) {
    sql += ' AND (name LIKE ? OR phone LIKE ?)';
    const digits = q.replace(/\D/g, '');
    args.push(`%${q}%`, digits ? `%${digits.replace(/^0/, '')}%` : '%__none__%');
  }
  if (filter === 'aktif') { sql += ' AND paid_until > ?'; args.push(t); }
  if (filter === 'tamat') { sql += ' AND paid_until IS NOT NULL AND paid_until <= ?'; args.push(t); }
  if (filter === 'belum-bayar') sql += ' AND paid_until IS NULL';
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json({ ok: true, users: results.map(u => ({ ...publicUser(u), createdAt: u.created_at })) });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    if (legalPaths.includes(path) && request.method === 'GET') {
      try { return await renderLegal(env, path); }
      catch (err) { console.error(err); return new Response('Ralat sistem. Sila cuba sebentar lagi.', { status: 500 }); }
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      if (request.method !== 'GET' && !sameOrigin(request)) return fail(403, 'Permintaan ditolak.');
      for (const [method, pattern, handler] of routes) {
        const m = url.pathname.match(pattern);
        if (m && request.method === method) return await handler(env, request, m, ctx);
      }
      return fail(404, 'Laluan tidak dijumpai.');
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message);
      console.error(err);
      return fail(500, 'Ralat sistem. Sila cuba sebentar lagi.');
    }
  },

  // Cron setiap 5 minit: peringatan kelas + hantar baki notifikasi.
  // Sekali sehari (3 pagi waktu Malaysia): buang sesi dan rekod lama.
  async scheduled(event, env, ctx) {
    const t = now();
    try { await sendClassReminders(env); } catch (e) { console.error('peringatan', e); }
    try { await processJobs(env); } catch (e) { console.error('push', e); }
    const d = new Date(event.scheduledTime || t);
    if (d.getUTCHours() === 19 && d.getUTCMinutes() < 5) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
        env.DB.prepare('DELETE FROM rate_limits WHERE window_ends < ?').bind(t),
        env.DB.prepare('DELETE FROM pin_resets WHERE expires_at < ?').bind(t),
        env.DB.prepare('DELETE FROM notifications WHERE created_at < ?').bind(t - 30 * 864e5),
      ]);
    }
  },
};
