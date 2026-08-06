import { json, err, getCookie, createAdminSession, clearSessionCookieHeader, cekDanCatatPercobaan, resetPercobaan, isAdminAuthed } from '../utils.js';

export async function login({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  if (!username || !password) return err('Username dan password wajib diisi');

  // Batasi percobaan login per alamat IP — cegah brute force.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const kunciLimit = `admin-login:${ip}`;
  const bolehCoba = await cekDanCatatPercobaan(env, kunciLimit, 10); // 10x / 15 menit
  if (!bolehCoba) return err('Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.', 429);

  const p = await env.DB.prepare('SELECT username, password FROM pengaturan WHERE id=1').first();
  if (!p || username !== p.username || password !== p.password) {
    return err('Username atau password salah', 401);
  }

  await resetPercobaan(env, kunciLimit);
  const { cookie } = await createAdminSession(env, request);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
}

export async function logout({ request, env }) {
  const token = getCookie(request, 'admin_session');
  if (token) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token=?').bind(token).run();
  }
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookieHeader(request) } });
}

export async function me({ request, env }) {
  const authed = await isAdminAuthed(request, env);
  return json({ authenticated: authed });
}
