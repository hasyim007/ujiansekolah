// src/utils.js
// Helper bersama dipakai semua route API.
// (Port 1:1 dari functions/api/_utils.js versi Pages Functions — logic tidak diubah.)

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

export function err(message, status = 400) {
  return json({ error: message }, { status });
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function b(v) { return v ? 1 : 0; }

export function rowToSoal(r) {
  return {
    id: r.id, teks: r.teks, mapel: r.mapel, tingkat: r.tingkat, bobot: r.bobot,
    pilihan: JSON.parse(r.pilihan || '[]'), kunci: JSON.parse(r.kunci || '[]'),
  };
}

export function rowToSesi(r) {
  return {
    id: r.id, nama: r.nama, mapel: r.mapel, kelas: r.kelas, jadwal: r.jadwal, durasi: r.durasi,
    soalIds: JSON.parse(r.soal_ids || '[]'), jumlahSoal: JSON.parse(r.soal_ids || '[]').length,
    acakSoal: !!r.acak_soal, acakPilihan: !!r.acak_pilihan, tampilkanNilai: !!r.tampilkan_nilai,
    intervalToken: r.interval_token, kkm: r.kkm, nilaiMinus: !!r.nilai_minus,
    pengawas: r.pengawas, status: r.status, token: r.token, tokenSetAt: r.token_set_at,
  };
}

export function rowToPeserta(r) {
  return { id: r.id, nomor: r.nomor, pin: r.pin, nama: r.nama, kelas: r.kelas };
}

export function rowToHasil(r) {
  return {
    id: r.id, pesertaId: r.peserta_id, sesiId: r.sesi_id, status: r.status,
    waktuMulai: r.waktu_mulai, waktuSelesai: r.waktu_selesai,
    jawaban: JSON.parse(r.jawaban || '{}'), statusSoal: JSON.parse(r.status_soal || '{}'),
    benar: r.benar, salah: r.salah, nilai: r.nilai,
  };
}

export function rowToPengaturan(r) {
  return {
    username: r.username, password: r.password, acakSoal: !!r.acak_soal, acakPilihan: !!r.acak_pilihan,
    loggingFullscreen: !!r.logging_fullscreen, batasIdentitas: r.batas_identitas, batasToken: r.batas_token,
    intervalToken: r.interval_token, intervalAutosave: r.interval_autosave, toleransiOffline: r.toleransi_offline,
  };
}

// ---------- AUTH ADMIN ----------
const COOKIE_NAME = 'admin_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 jam

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function sessionCookieHeader(request, token, maxAgeSeconds) {
  const isHttps = new URL(request.url).protocol === 'https:';
  let cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
  if (isHttps) cookie += '; Secure';
  return cookie;
}

export function clearSessionCookieHeader(request) {
  const isHttps = new URL(request.url).protocol === 'https:';
  let cookie = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  if (isHttps) cookie += '; Secure';
  return cookie;
}

export async function createAdminSession(env, request) {
  const token = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare('INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?,?,?)')
    .bind(token, now, now + SESSION_DURATION_MS).run();
  return { token, cookie: sessionCookieHeader(request, token, SESSION_DURATION_MS / 1000) };
}

// Cek apakah request punya sesi admin yang valid. Sekaligus bersih-bersih sesi kedaluwarsa sesekali.
export async function isAdminAuthed(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return false;
  const row = await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token=?').bind(token).first();
  if (!row) return false;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token=?').bind(token).run();
    return false;
  }
  return true;
}

export { COOKIE_NAME };

// ---------- RATE LIMITING (server-side) ----------
// Batasi percobaan gagal per kunci (mis. "identitas:<ip>" atau "token:<pesertaId>")
// dalam jendela waktu tetap. Mengembalikan true kalau MASIH BOLEH mencoba.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 menit

export async function cekDanCatatPercobaan(env, kunci, batasMaks) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT * FROM rate_limit WHERE kunci=?').bind(kunci).first();
  if (!row || (now - row.mulai) > RATE_LIMIT_WINDOW_MS) {
    await env.DB.prepare('INSERT INTO rate_limit (kunci, jumlah, mulai) VALUES (?,1,?) ON CONFLICT(kunci) DO UPDATE SET jumlah=1, mulai=?')
      .bind(kunci, now, now).run();
    return true;
  }
  if (row.jumlah >= batasMaks) return false;
  await env.DB.prepare('UPDATE rate_limit SET jumlah=jumlah+1 WHERE kunci=?').bind(kunci).run();
  return true;
}

export async function resetPercobaan(env, kunci) {
  await env.DB.prepare('DELETE FROM rate_limit WHERE kunci=?').bind(kunci).run();
}

// Hitung nilai akhir sebuah hasil berdasarkan kunci jawaban soal-soal di sesinya.
// Dipakai oleh /ujian/submit dan /sesi/:id/hentikan (submit paksa).
export async function gradingHasil(env, hasilRow) {
  const sesi = await env.DB.prepare('SELECT * FROM sesi WHERE id=?').bind(hasilRow.sesi_id).first();
  const soalIds = JSON.parse(sesi?.soal_ids || '[]');
  if (soalIds.length === 0) return { benar: 0, salah: 0, nilai: 0 };
  const placeholders = soalIds.map(() => '?').join(',');
  const { results: soalRows } = await env.DB.prepare(`SELECT * FROM soal WHERE id IN (${placeholders})`).bind(...soalIds).all();
  const jawaban = JSON.parse(hasilRow.jawaban || '{}');
  let benar = 0, salah = 0, skor = 0, maks = 0;
  for (const s of soalRows) {
    maks += s.bobot;
    const kunci = JSON.parse(s.kunci || '[]');
    const jw = jawaban[s.id];
    if (jw !== undefined) {
      if (kunci.includes(jw)) { benar++; skor += s.bobot; }
      else { salah++; if (sesi.nilai_minus) skor -= s.bobot * 0.25; }
    }
  }
  const nilai = maks > 0 ? Math.max(0, Math.round((skor / maks) * 100)) : 0;
  return { benar, salah, nilai };
}
