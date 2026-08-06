import { json, err, rowToHasil } from '../utils.js';

export async function listHasil({ request, env }) {
  const url = new URL(request.url);
  const sesiId = url.searchParams.get('sesiId');
  const pesertaId = url.searchParams.get('pesertaId');

  let query = 'SELECT * FROM hasil WHERE 1=1';
  const bindings = [];
  if (sesiId) { query += ' AND sesi_id=?'; bindings.push(sesiId); }
  if (pesertaId) { query += ' AND peserta_id=?'; bindings.push(pesertaId); }

  const { results } = await env.DB.prepare(query).bind(...bindings).all();
  return json(results.map(rowToHasil));
}

export async function getHasil({ env, params }) {
  const row = await env.DB.prepare('SELECT * FROM hasil WHERE id=?').bind(params.id).first();
  if (!row) return err('Hasil tidak ditemukan', 404);
  return json(rowToHasil(row));
}

export async function resetHasil({ request, env, params }) {
  const existing = await env.DB.prepare('SELECT * FROM hasil WHERE id=?').bind(params.id).first();
  if (!existing) return err('Data hasil tidak ditemukan', 404);
  const body = await request.json().catch(() => ({}));
  if (!body.alasan || !body.alasan.trim()) return err('Alasan reset wajib diisi');

  await env.DB.prepare(
    `UPDATE hasil SET status='Belum Mulai', waktu_mulai=NULL, waktu_selesai=NULL, jawaban='{}', status_soal='{}', benar=0, salah=0, nilai=NULL, reset_alasan=? WHERE id=?`
  ).bind(body.alasan, params.id).run();

  return json({ ok: true });
}
