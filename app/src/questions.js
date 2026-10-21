// Soal jawab dengan ustaz: pelajar bertanya (umum atau tentang video), admin/ustaz menjawab.
// Jawapan boleh dibaca semua pelajar supaya soalan yang sama tak perlu dijawab berulang kali.
import { now, json, fail, readJson, cleanMultiline, rateLimit, displayPhone } from './util.js';
import { requireUser, requireAdmin } from './auth.js';
import { notify, processJobs } from './push.js';

const firstName = n => String(n || 'Pelajar').trim().split(/\s+/)[0];

function studentShape(q, uid) {
  return {
    id: q.id,
    body: q.body,
    answer: q.answer || null,
    answeredBy: q.answer ? (q.answerer || 'Ustaz') : null,
    answeredAt: q.answered_at || null,
    createdAt: q.created_at,
    asker: firstName(q.asker),
    mine: q.user_id === uid,
    videoId: q.video_id || null,
    videoTitle: q.video_title || null,
  };
}

const BASE_SELECT = `SELECT q.*, u.name AS asker, u.phone AS asker_phone, a.name AS answerer, v.title AS video_title
  FROM questions q
  LEFT JOIN users u ON u.id = q.user_id
  LEFT JOIN admins a ON a.id = q.answered_by
  LEFT JOIN videos v ON v.id = q.video_id`;

// Pelajar nampak: semua soalan yang sudah dijawab + soalan sendiri yang belum dijawab.
export async function listQuestions(env, request) {
  const u = await requireUser(env, request);
  const vid = Number(new URL(request.url).searchParams.get('video')) || null;
  const { results } = await env.DB.prepare(`${BASE_SELECT}
    WHERE q.hidden = 0 AND (q.answer IS NOT NULL OR q.user_id = ?) ${vid ? 'AND q.video_id = ?' : ''}
    ORDER BY CASE WHEN q.answer IS NULL THEN 0 ELSE 1 END, COALESCE(q.answered_at, q.created_at) DESC LIMIT 100`)
    .bind(u.id, ...(vid ? [vid] : [])).all();
  return json({ ok: true, questions: results.map(q => studentShape(q, u.id)) });
}

export async function askQuestion(env, request) {
  const u = await requireUser(env, request);
  if (!(u.paid_until > now())) return fail(402, 'Soal jawab dengan ustaz untuk pelajar yang melanggan.');
  const b = await readJson(request);
  const body = cleanMultiline(b.body, 1000);
  if (body.length < 5) return fail(400, 'Sila tulis soalan anda.');
  let videoId = null;
  if (b.videoId) {
    const v = await env.DB.prepare('SELECT id FROM videos WHERE id = ? AND published = 1').bind(Number(b.videoId)).first();
    if (!v) return fail(400, 'Video tidak dijumpai.');
    videoId = v.id;
  }
  if (!(await rateLimit(env.DB, 'ask:' + u.id, 10, 24 * 3600e3))) return fail(429, 'Anda sudah hantar banyak soalan hari ini. Cuba lagi esok.');
  const row = await env.DB.prepare('INSERT INTO questions (user_id, video_id, body, hidden, created_at) VALUES (?, ?, ?, 0, ?) RETURNING id').bind(u.id, videoId, body, now()).first();
  const q = await env.DB.prepare(`${BASE_SELECT} WHERE q.id = ?`).bind(row.id).first();
  return json({ ok: true, question: studentShape(q, u.id) }, 201);
}

// Pelajar boleh tarik balik soalan sendiri selagi belum dijawab.
export async function deleteOwnQuestion(env, request, id) {
  const u = await requireUser(env, request);
  const r = await env.DB.prepare('DELETE FROM questions WHERE id = ? AND user_id = ? AND answer IS NULL').bind(id, u.id).run();
  if (!r.meta.changes) return fail(400, 'Soalan yang sudah dijawab tidak boleh dipadam.');
  return json({ ok: true });
}

// ---------- admin ----------
function adminShape(q) {
  return {
    id: q.id, body: q.body, answer: q.answer || null, answeredBy: q.answerer || null, answeredAt: q.answered_at || null,
    createdAt: q.created_at, hidden: !!q.hidden, videoId: q.video_id || null, videoTitle: q.video_title || null,
    asker: q.asker || '(akaun dipadam)', askerPhone: q.asker_phone ? displayPhone(q.asker_phone) : null,
  };
}

export async function adminListQuestions(env, request) {
  await requireAdmin(env, request);
  const status = new URL(request.url).searchParams.get('status') || 'belum';
  const where = status === 'dijawab' ? 'q.hidden = 0 AND q.answer IS NOT NULL'
    : status === 'sembunyi' ? 'q.hidden = 1'
    : 'q.hidden = 0 AND q.answer IS NULL';
  const order = status === 'belum' ? 'q.created_at ASC' : 'COALESCE(q.answered_at, q.created_at) DESC';
  const [list, count] = await env.DB.batch([
    env.DB.prepare(`${BASE_SELECT} WHERE ${where} ORDER BY ${order} LIMIT 200`),
    env.DB.prepare('SELECT COUNT(*) AS n FROM questions WHERE hidden = 0 AND answer IS NULL'),
  ]);
  return json({ ok: true, questions: list.results.map(adminShape), unanswered: count.results[0].n });
}

export async function adminAnswer(env, request, id, ctx) {
  const a = await requireAdmin(env, request);
  const b = await readJson(request);
  const answer = cleanMultiline(b.answer, 3000);
  if (answer.length < 2) return fail(400, 'Sila tulis jawapan.');
  const before = await env.DB.prepare('SELECT user_id, body, answer FROM questions WHERE id = ?').bind(id).first();
  if (!before) return fail(404, 'Soalan tidak dijumpai.');
  await env.DB.prepare('UPDATE questions SET answer = ?, answered_by = ?, answered_at = COALESCE(answered_at, ?) WHERE id = ?').bind(answer, a.id, now(), id).run();
  // Beritahu pelajar bila soalannya dijawab buat kali pertama
  if (!before.answer && before.user_id) {
    const n = await notify(env, { kind: 'user', userId: before.user_id }, {
      title: 'Ustaz sudah menjawab soalan anda',
      body: before.body.length > 90 ? before.body.slice(0, 90) + '…' : before.body,
      url: '/?k=soaljawab',
    });
    if (n && ctx) ctx.waitUntil(processJobs(env, 10));
  }
  const q = await env.DB.prepare(`${BASE_SELECT} WHERE q.id = ?`).bind(id).first();
  return json({ ok: true, question: adminShape(q) });
}

export async function adminHideQuestion(env, request, id) {
  await requireAdmin(env, request);
  const b = await readJson(request);
  await env.DB.prepare('UPDATE questions SET hidden = ? WHERE id = ?').bind(b.hidden ? 1 : 0, id).run();
  return json({ ok: true });
}
