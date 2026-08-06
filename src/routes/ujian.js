import { json, err, uid, rowToHasil, rowToSesi, rowToPeserta, cekDanCatatPercobaan, resetPercobaan, gradingHasil } from '../utils.js';

export async function verifikasiIdentitas({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const identitas = String(body.identitas || '').trim().toLowerCase();
  const pin = String(body.pin || '').trim();
  if (!identitas || !pin) return err('Identitas dan PIN wajib diisi');

  const pengaturan = await env.DB.prepare('SELECT batas_identitas FROM pengaturan WHERE id=1').first();
  const batas = pengaturan?.batas_identitas || 5;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bolehCoba = await cekDanCatatPercobaan(env, `identitas:${ip}`, batas);
  if (!bolehCoba) return err('Terlalu banyak percobaan. Tunggu beberapa menit atau minta bantuan pengawas.', 429);

  const row = await env.DB.prepare(
    `SELECT * FROM peserta WHERE (LOWER(nomor)=? OR LOWER(nama)=?) AND pin=?`
  ).bind(identitas, identitas, pin).first();

  if (!row) return err('Nama/Nomor Peserta atau Password salah', 401);
  return json(rowToPeserta(row));
}

export async function sesiAktif({ request, env }) {
  const url = new URL(request.url);
  const pesertaId = url.searchParams.get('pesertaId');
  if (!pesertaId) return err('pesertaId wajib diisi');

  const peserta = await env.DB.prepare('SELECT * FROM peserta WHERE id=?').bind(pesertaId).first();
  if (!peserta) return err('Peserta tidak ditemukan', 404);

  const { results: sesiBerlangsung } = await env.DB.prepare(
    `SELECT * FROM sesi WHERE status='Berlangsung' AND kelas LIKE '%' || ? || '%'`
  ).bind(peserta.kelas).all();

  for (const s of sesiBerlangsung) {
    const selesai = await env.DB.prepare(
      `SELECT id FROM hasil WHERE peserta_id=? AND sesi_id=? AND status='Selesai'`
    ).bind(pesertaId, s.id).first();
    if (!selesai) return json(rowToSesi(s));
  }

  return json(null);
}

export async function verifikasiToken({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!body.sesiId || !body.token) return err('sesiId dan token wajib diisi');

  const pengaturan = await env.DB.prepare('SELECT batas_token FROM pengaturan WHERE id=1').first();
  const batas = pengaturan?.batas_token || 5;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const kunciLimit = `token:${ip}:${body.sesiId}`;
  const bolehCoba = await cekDanCatatPercobaan(env, kunciLimit, batas);
  if (!bolehCoba) return err('Terlalu banyak percobaan. Tunggu beberapa menit atau minta bantuan pengawas.', 429);

  const sesi = await env.DB.prepare('SELECT * FROM sesi WHERE id=?').bind(body.sesiId).first();
  if (!sesi) return err('Sesi tidak ditemukan', 404);

  const valid = String(sesi.token) === String(body.token);
  if (valid) await resetPercobaan(env, kunciLimit);
  return json({ valid });
}

export async function mulai({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!body.pesertaId || !body.sesiId) return err('pesertaId dan sesiId wajib diisi');

  let row = await env.DB.prepare(
    'SELECT * FROM hasil WHERE peserta_id=? AND sesi_id=?'
  ).bind(body.pesertaId, body.sesiId).first();

  if (!row) {
    const id = uid();
    await env.DB.prepare(
      `INSERT INTO hasil (id, peserta_id, sesi_id, status, waktu_mulai) VALUES (?,?,?,?,?)`
    ).bind(id, body.pesertaId, body.sesiId, 'Sedang Mengerjakan', Date.now()).run();
    row = await env.DB.prepare('SELECT * FROM hasil WHERE id=?').bind(id).first();
  } else if (row.status === 'Belum Mulai') {
    await env.DB.prepare(
      `UPDATE hasil SET status='Sedang Mengerjakan', waktu_mulai=? WHERE id=?`
    ).bind(Date.now(), row.id).run();
    row = await env.DB.prepare('SELECT * FROM hasil WHERE id=?').bind(row.id).first();
  }

  return json(rowToHasil(row));
}

export async function jawaban({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!body.hasilId || !body.soalId) return err('hasilId dan soalId wajib diisi');

  const row = await env.DB.prepare('SELECT * FROM hasil WHERE id=?').bind(body.hasilId).first();
  if (!row) return err('Data hasil tidak ditemukan', 404);
  if (row.status === 'Selesai') return err('Ujian ini sudah disubmit, tidak bisa diubah lagi', 409);

  const jawabanObj = JSON.parse(row.jawaban || '{}');
  const statusSoal = JSON.parse(row.status_soal || '{}');
  if (body.jawabanIdx !== undefined) jawabanObj[body.soalId] = body.jawabanIdx;
  if (body.status !== undefined) statusSoal[body.soalId] = body.status;

  await env.DB.prepare('UPDATE hasil SET jawaban=?, status_soal=? WHERE id=?')
    .bind(JSON.stringify(jawabanObj), JSON.stringify(statusSoal), body.hasilId).run();

  const updated = await env.DB.prepare('SELECT * FROM hasil WHERE id=?').bind(body.hasilId).first();
  return json(rowToHasil(updated));
}

export async function submit({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!body.hasilId) return err('hasilId wajib diisi');

  const row = await env.DB.prepare('SELECT * FROM hasil WHERE id=?').bind(body.hasilId).first();
  if (!row) return err('Data hasil tidak ditemukan', 404);
  if (row.status === 'Selesai') {
    return json(rowToHasil(row)); // idempotent — kalau sudah disubmit, kembalikan hasil yang ada
  }

  const { benar, salah, nilai } = await gradingHasil(env, row);
  await env.DB.prepare(
    `UPDATE hasil SET status='Selesai', waktu_selesai=?, benar=?, salah=?, nilai=? WHERE id=?`
  ).bind(Date.now(), benar, salah, nilai, body.hasilId).run();

  const updated = await env.DB.prepare('SELECT * FROM hasil WHERE id=?').bind(body.hasilId).first();
  return json(rowToHasil(updated));
}
