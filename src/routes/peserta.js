import { json, err, uid, rowToPeserta } from '../utils.js';

export async function listPeserta({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM peserta ORDER BY nomor ASC').all();
  return json(results.map(rowToPeserta));
}

export async function createPeserta({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const nomor = String(body.nomor || '').trim();
  const nama = String(body.nama || '').trim();
  const kelas = String(body.kelas || '').trim();
  if (!nomor || !nama || !kelas) return err('Nomor, nama, dan kelas wajib diisi');

  const dobel = await env.DB.prepare('SELECT id FROM peserta WHERE nomor=?').bind(nomor).first();
  if (dobel) return err('Nomor peserta sudah dipakai peserta lain', 409);

  const id = uid();
  const pin = body.pin ? String(body.pin).trim() : String(Math.floor(1000 + Math.random() * 9000));
  await env.DB.prepare('INSERT INTO peserta (id, nomor, pin, nama, kelas) VALUES (?,?,?,?,?)')
    .bind(id, nomor, pin, nama, kelas).run();
  const row = await env.DB.prepare('SELECT * FROM peserta WHERE id=?').bind(id).first();
  return json(rowToPeserta(row), { status: 201 });
}

export async function getPeserta({ env, params }) {
  const row = await env.DB.prepare('SELECT * FROM peserta WHERE id=?').bind(params.id).first();
  if (!row) return err('Peserta tidak ditemukan', 404);
  return json(rowToPeserta(row));
}

export async function deletePeserta({ env, params }) {
  const existing = await env.DB.prepare('SELECT id FROM peserta WHERE id=?').bind(params.id).first();
  if (!existing) return err('Peserta tidak ditemukan', 404);
  await env.DB.prepare('DELETE FROM hasil WHERE peserta_id=?').bind(params.id).run();
  await env.DB.prepare('DELETE FROM peserta WHERE id=?').bind(params.id).run();
  return json({ ok: true });
}

export async function resetPin({ env, params }) {
  const existing = await env.DB.prepare('SELECT * FROM peserta WHERE id=?').bind(params.id).first();
  if (!existing) return err('Peserta tidak ditemukan', 404);
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  await env.DB.prepare('UPDATE peserta SET pin=? WHERE id=?').bind(pin, params.id).run();
  return json({ pin });
}
