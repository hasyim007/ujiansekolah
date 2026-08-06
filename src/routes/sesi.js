import { json, err, uid, b, rowToSesi, gradingHasil } from '../utils.js';

export async function listSesi({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM sesi ORDER BY created_at DESC').all();
  return json(results.map(rowToSesi));
}

export async function createSesi({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!body.nama || !body.nama.trim()) return err('Nama ujian wajib diisi');
  const id = uid();
  const token = String(Math.floor(100000 + Math.random() * 899999));
  await env.DB.prepare(
    `INSERT INTO sesi (id, nama, mapel, kelas, jadwal, durasi, soal_ids, acak_soal, acak_pilihan, tampilkan_nilai, interval_token, kkm, nilai_minus, pengawas, status, token, token_set_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, body.nama, body.mapel || 'Matematika', body.kelas || '', body.jadwal || 'Belum dijadwalkan',
    body.durasi || 90, JSON.stringify(body.soalIds || []), b(body.acakSoal ?? true), b(body.acakPilihan ?? true),
    b(body.tampilkanNilai ?? false), body.intervalToken || 15, body.kkm || 70, b(body.nilaiMinus ?? false),
    body.pengawas || '', 'Draft', token, Date.now()
  ).run();
  const row = await env.DB.prepare('SELECT * FROM sesi WHERE id=?').bind(id).first();
  return json(rowToSesi(row), { status: 201 });
}

export async function getSesi({ env, params }) {
  const row = await env.DB.prepare('SELECT * FROM sesi WHERE id=?').bind(params.id).first();
  if (!row) return err('Sesi tidak ditemukan', 404);
  return json(rowToSesi(row));
}

export async function updateSesi({ request, env, params }) {
  const existing = await env.DB.prepare('SELECT * FROM sesi WHERE id=?').bind(params.id).first();
  if (!existing) return err('Sesi tidak ditemukan', 404);
  const body = await request.json().catch(() => ({}));
  await env.DB.prepare(
    `UPDATE sesi SET nama=?, mapel=?, kelas=?, jadwal=?, durasi=?, soal_ids=?, acak_soal=?, acak_pilihan=?, tampilkan_nilai=?, interval_token=?, kkm=?, nilai_minus=?, pengawas=?, status=? WHERE id=?`
  ).bind(
    body.nama ?? existing.nama,
    body.mapel ?? existing.mapel,
    body.kelas ?? existing.kelas,
    body.jadwal ?? existing.jadwal,
    body.durasi ?? existing.durasi,
    JSON.stringify(body.soalIds ?? JSON.parse(existing.soal_ids)),
    body.acakSoal !== undefined ? b(body.acakSoal) : existing.acak_soal,
    body.acakPilihan !== undefined ? b(body.acakPilihan) : existing.acak_pilihan,
    body.tampilkanNilai !== undefined ? b(body.tampilkanNilai) : existing.tampilkan_nilai,
    body.intervalToken ?? existing.interval_token,
    body.kkm ?? existing.kkm,
    body.nilaiMinus !== undefined ? b(body.nilaiMinus) : existing.nilai_minus,
    body.pengawas ?? existing.pengawas,
    body.status ?? existing.status,
    params.id
  ).run();
  const row = await env.DB.prepare('SELECT * FROM sesi WHERE id=?').bind(params.id).first();
  return json(rowToSesi(row));
}

export async function deleteSesi({ env, params }) {
  await env.DB.prepare('DELETE FROM hasil WHERE sesi_id=?').bind(params.id).run();
  await env.DB.prepare('DELETE FROM sesi WHERE id=?').bind(params.id).run();
  return json({ ok: true });
}

export async function regenToken({ env, params }) {
  const existing = await env.DB.prepare('SELECT * FROM sesi WHERE id=?').bind(params.id).first();
  if (!existing) return err('Sesi tidak ditemukan', 404);
  const token = String(Math.floor(100000 + Math.random() * 899999));
  await env.DB.prepare('UPDATE sesi SET token=?, token_set_at=? WHERE id=?').bind(token, Date.now(), params.id).run();
  const row = await env.DB.prepare('SELECT * FROM sesi WHERE id=?').bind(params.id).first();
  return json(rowToSesi(row));
}

export async function hentikanSesi({ env, params }) {
  const existing = await env.DB.prepare('SELECT * FROM sesi WHERE id=?').bind(params.id).first();
  if (!existing) return err('Sesi tidak ditemukan', 404);

  await env.DB.prepare(`UPDATE sesi SET status='Selesai' WHERE id=?`).bind(params.id).run();

  const { results: berjalan } = await env.DB.prepare(
    `SELECT * FROM hasil WHERE sesi_id=? AND status='Sedang Mengerjakan'`
  ).bind(params.id).all();

  for (const h of berjalan) {
    const { benar, salah, nilai } = await gradingHasil(env, h);
    await env.DB.prepare(
      `UPDATE hasil SET status='Selesai', waktu_selesai=?, benar=?, salah=?, nilai=? WHERE id=?`
    ).bind(Date.now(), benar, salah, nilai, h.id).run();
  }

  return json({ ok: true, disubmitPaksa: berjalan.length });
}
