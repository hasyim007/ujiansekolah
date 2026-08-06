// src/index.js
// Worker tunggal (format baru "Connect to Git" Cloudflare, bukan Pages Functions lagi).
// Menggabungkan seluruh route yang dulu ada di folder functions/api/* menjadi satu
// router di sini. Logic masing-masing endpoint (auth admin, rate limit, grading,
// hentikan sesi paksa, dll) TIDAK diubah — hanya dipindah bentuk dari
// `onRequestGet/Post/...` (Pages Functions) menjadi fungsi handler biasa yang
// dipanggil lewat tabel rute di bawah.
//
// Aset statis (semua file .html + api.js) dilayani lewat binding `ASSETS`
// (lihat wrangler.toml). Karena kita butuh mengecek sesi admin SEBELUM
// halaman admin-*.html dikirim ke browser (dulu ini kerja functions/_middleware.js),
// wrangler.toml men-set run_worker_first untuk /admin-* dan /api/*, supaya
// dua kelompok path itu selalu lewat Worker ini dulu.

import { isAdminAuthed } from './utils.js';
import * as auth from './routes/auth.js';
import * as pengaturan from './routes/pengaturan.js';
import * as soal from './routes/soal.js';
import * as sesi from './routes/sesi.js';
import * as peserta from './routes/peserta.js';
import * as hasil from './routes/hasil.js';
import * as ujian from './routes/ujian.js';

// ---------- Tabel rute API (pengganti file-based routing functions/api/*) ----------
// segments: template path setelah /api/, ':nama' = parameter dinamis.
const ROUTES = [
  // soal
  { method: 'GET', segments: ['soal'], handler: soal.listSoal },
  { method: 'POST', segments: ['soal'], handler: soal.createSoal },
  { method: 'PUT', segments: ['soal', ':id'], handler: soal.updateSoal },
  { method: 'DELETE', segments: ['soal', ':id'], handler: soal.deleteSoal },

  // sesi
  { method: 'GET', segments: ['sesi'], handler: sesi.listSesi },
  { method: 'POST', segments: ['sesi'], handler: sesi.createSesi },
  { method: 'GET', segments: ['sesi', ':id'], handler: sesi.getSesi },
  { method: 'PUT', segments: ['sesi', ':id'], handler: sesi.updateSesi },
  { method: 'DELETE', segments: ['sesi', ':id'], handler: sesi.deleteSesi },
  { method: 'POST', segments: ['sesi', ':id', 'regen-token'], handler: sesi.regenToken },
  { method: 'POST', segments: ['sesi', ':id', 'hentikan'], handler: sesi.hentikanSesi },

  // peserta
  { method: 'GET', segments: ['peserta'], handler: peserta.listPeserta },
  { method: 'POST', segments: ['peserta'], handler: peserta.createPeserta },
  { method: 'GET', segments: ['peserta', ':id'], handler: peserta.getPeserta },
  { method: 'DELETE', segments: ['peserta', ':id'], handler: peserta.deletePeserta },
  { method: 'POST', segments: ['peserta', ':id', 'reset-pin'], handler: peserta.resetPin },

  // hasil
  { method: 'GET', segments: ['hasil'], handler: hasil.listHasil },
  { method: 'GET', segments: ['hasil', ':id'], handler: hasil.getHasil },
  { method: 'POST', segments: ['hasil', ':id', 'reset'], handler: hasil.resetHasil },

  // ujian (alur peserta)
  { method: 'POST', segments: ['ujian', 'verifikasi-identitas'], handler: ujian.verifikasiIdentitas },
  { method: 'GET', segments: ['ujian', 'sesi-aktif'], handler: ujian.sesiAktif },
  { method: 'POST', segments: ['ujian', 'verifikasi-token'], handler: ujian.verifikasiToken },
  { method: 'POST', segments: ['ujian', 'mulai'], handler: ujian.mulai },
  { method: 'POST', segments: ['ujian', 'jawaban'], handler: ujian.jawaban },
  { method: 'POST', segments: ['ujian', 'submit'], handler: ujian.submit },

  // pengaturan
  { method: 'GET', segments: ['pengaturan'], handler: pengaturan.getPengaturan },
  { method: 'PUT', segments: ['pengaturan'], handler: pengaturan.putPengaturan },
  { method: 'GET', segments: ['pengaturan', 'publik'], handler: pengaturan.getPengaturanPublik },

  // auth admin
  { method: 'POST', segments: ['auth', 'login'], handler: auth.login },
  { method: 'POST', segments: ['auth', 'logout'], handler: auth.logout },
  { method: 'GET', segments: ['auth', 'me'], handler: auth.me },
];

function matchRoute(method, pathSegments) {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    if (route.segments.length !== pathSegments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < route.segments.length; i++) {
      const tpl = route.segments[i];
      const actual = pathSegments[i];
      if (tpl.startsWith(':')) {
        params[tpl.slice(1)] = decodeURIComponent(actual);
      } else if (tpl !== actual) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: route.handler, params };
  }
  return null;
}

// ---------- Gate akses admin (pengganti functions/_middleware.js) ----------
const ADMIN_PAGE = /^\/admin-[a-z-]+\.html$/;

// Endpoint API yang HANYA boleh diakses admin yang sudah login.
// GET publik (soal/sesi/peserta/hasil) tetap terbuka karena dipakai juga oleh
// halaman peserta (login, pengerjaan ujian) dan layar livescore publik.
function isProtectedApi(pathname, method) {
  if (pathname === '/api/pengaturan' && (method === 'GET' || method === 'PUT')) return true;
  if (pathname.startsWith('/api/soal') && method !== 'GET') return true;
  if (pathname.startsWith('/api/sesi') && method !== 'GET') return true;
  if (pathname.startsWith('/api/peserta') && method !== 'GET') return true;
  if (pathname.startsWith('/api/hasil') && method !== 'GET') return true;
  return false;
}

async function handleApi(request, env, url) {
  const pathname = url.pathname;
  const isProtected = isProtectedApi(pathname, request.method);

  if (isProtected) {
    const authed = await isAdminAuthed(request, env);
    if (!authed) {
      return new Response(JSON.stringify({ error: 'Sesi admin tidak valid, silakan login ulang.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const segments = pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
  const match = matchRoute(request.method, segments);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Rute API tidak ditemukan' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return match.handler({ request, env, params: match.params });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // 1. Semua panggilan API
    if (pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    // 2. Halaman admin — butuh sesi admin yang valid, kalau tidak redirect ke login-admin.html.
    if (ADMIN_PAGE.test(pathname)) {
      const authed = await isAdminAuthed(request, env);
      if (!authed) {
        return Response.redirect(`${url.origin}/login-admin.html`, 302);
      }
      return env.ASSETS.fetch(request);
    }

    // 3. Semua path lain (halaman peserta, livescore, api.js, dsb) — file statis biasa.
    return env.ASSETS.fetch(request);
  },
};
