import { json, err, uid, rowToSoal } from '../utils.js';

export async function listSoal({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM soal ORDER BY created_at DESC').all();
  return json(results.map(rowToSoal));
}

export async function createSoal({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!body.teks || !body.teks.trim()) return err('Teks soal wajib diisi');
  const id = uid();
  await env.DB.prepare(
    `INSERT INTO soal (id, teks, mapel, tingkat, bobot, pilihan, kunci) VALUES (?,?,?,?,?,?,?)`
  ).bind(
    id, body.teks, body.mapel || 'Matematika', body.tingkat || 'Sedang', body.bobot || 10,
    JSON.stringify(body.pilihan || []), JSON.stringify(body.kunci || [])
  ).run();
  const row = await env.DB.prepare('SELECT * FROM soal WHERE id=?').bind(id).first();
  return json(rowToSoal(row), { status: 201 });
}

export async function updateSoal({ request, env, params }) {
  const existing = await env.DB.prepare('SELECT * FROM soal WHERE id=?').bind(params.id).first();
  if (!existing) return err('Soal tidak ditemukan', 404);
  const body = await request.json().catch(() => ({}));
  await env.DB.prepare(
    `UPDATE soal SET teks=?, mapel=?, tingkat=?, bobot=?, pilihan=?, kunci=? WHERE id=?`
  ).bind(
    body.teks ?? existing.teks,
    body.mapel ?? existing.mapel,
    body.tingkat ?? existing.tingkat,
    body.bobot ?? existing.bobot,
    JSON.stringify(body.pilihan ?? JSON.parse(existing.pilihan)),
    JSON.stringify(body.kunci ?? JSON.parse(existing.kunci)),
    params.id
  ).run();
  const row = await env.DB.prepare('SELECT * FROM soal WHERE id=?').bind(params.id).first();
  return json(rowToSoal(row));
}

export async function deleteSoal({ env, params }) {
  await env.DB.prepare('DELETE FROM soal WHERE id=?').bind(params.id).run();
  return json({ ok: true });
}
