import { json, b, rowToPengaturan } from '../utils.js';

export async function getPengaturan({ env }) {
  const row = await env.DB.prepare('SELECT * FROM pengaturan WHERE id=1').first();
  return json(rowToPengaturan(row));
}

export async function putPengaturan({ request, env }) {
  const existing = await env.DB.prepare('SELECT * FROM pengaturan WHERE id=1').first();
  const body = await request.json().catch(() => ({}));
  await env.DB.prepare(
    `UPDATE pengaturan SET username=?, password=?, acak_soal=?, acak_pilihan=?, logging_fullscreen=?, batas_identitas=?, batas_token=?, interval_token=?, interval_autosave=?, toleransi_offline=? WHERE id=1`
  ).bind(
    body.username ?? existing.username,
    body.password ?? existing.password,
    body.acakSoal !== undefined ? b(body.acakSoal) : existing.acak_soal,
    body.acakPilihan !== undefined ? b(body.acakPilihan) : existing.acak_pilihan,
    body.loggingFullscreen !== undefined ? b(body.loggingFullscreen) : existing.logging_fullscreen,
    body.batasIdentitas ?? existing.batas_identitas,
    body.batasToken ?? existing.batas_token,
    body.intervalToken ?? existing.interval_token,
    body.intervalAutosave ?? existing.interval_autosave,
    body.toleransiOffline ?? existing.toleransi_offline
  ).run();
  const row = await env.DB.prepare('SELECT * FROM pengaturan WHERE id=1').first();
  return json(rowToPengaturan(row));
}

// Subset pengaturan yang aman diakses tanpa login — dipakai halaman peserta
// (login-peserta.html) untuk tahu batas percobaan, interval token, dll.
// TIDAK menyertakan username/password admin.
export async function getPengaturanPublik({ env }) {
  const row = await env.DB.prepare('SELECT * FROM pengaturan WHERE id=1').first();
  return json({
    acakSoal: !!row.acak_soal,
    acakPilihan: !!row.acak_pilihan,
    loggingFullscreen: !!row.logging_fullscreen,
    batasIdentitas: row.batas_identitas,
    batasToken: row.batas_token,
    intervalToken: row.interval_token,
    intervalAutosave: row.interval_autosave,
    toleransiOffline: row.toleransi_offline,
  });
}
