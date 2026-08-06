/* ============================================================
   api.js — Klien API frontend
   Semua halaman memanggil window.DB.xxx(...) seperti biasa,
   tapi sekarang setiap panggilan adalah fetch() async ke
   Cloudflare Pages Functions (folder /functions/api) yang
   membaca/menulis ke Cloudflare D1. Tidak ada lagi localStorage.
   ============================================================ */
(function () {
  const BASE = '/api';
  const SESSION_KEY = 'ujian_session_v1';

  async function http(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      credentials: 'same-origin', // sertakan cookie sesi admin
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* respons kosong, tidak apa */ }
    if (res.status === 401 && /^\/admin-/.test(window.location.pathname)) {
      window.location.href = 'login-admin.html';
    }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `Permintaan gagal (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  const DB = {
    // ---------- SOAL ----------
    getSoal: () => http('GET', '/soal'),
    addSoal: (s) => http('POST', '/soal', s),
    updateSoal: (id, patch) => http('PUT', `/soal/${id}`, patch),
    deleteSoal: (id) => http('DELETE', `/soal/${id}`),

    // ---------- SESI ----------
    getSesi: () => http('GET', '/sesi'),
    getSesiById: (id) => http('GET', `/sesi/${id}`),
    addSesi: (s) => http('POST', '/sesi', s),
    updateSesi: (id, patch) => http('PUT', `/sesi/${id}`, patch),
    deleteSesi: (id) => http('DELETE', `/sesi/${id}`),
    regenToken: (id) => http('POST', `/sesi/${id}/regen-token`),
    hentikanSesi: (id) => http('POST', `/sesi/${id}/hentikan`),

    // ---------- PESERTA (roster) ----------
    getPesertaRoster: () => http('GET', '/peserta'),
    getPesertaById: (id) => http('GET', `/peserta/${id}`),
    addPeserta: (p) => http('POST', '/peserta', p),
    deletePeserta: (id) => http('DELETE', `/peserta/${id}`),
    resetPin: (id) => http('POST', `/peserta/${id}/reset-pin`).then(r => r.pin),

    // ---------- HASIL ----------
    getHasil: (sesiId) => http('GET', `/hasil?sesiId=${encodeURIComponent(sesiId)}`),
    getHasilForPeserta: (pesertaId) => http('GET', `/hasil?pesertaId=${encodeURIComponent(pesertaId)}`),
    getHasilById: (id) => http('GET', `/hasil/${id}`),
    resetHasil: (id, alasan) => http('POST', `/hasil/${id}/reset`, { alasan }),

    // ---------- ALUR UJIAN / AUTH PESERTA ----------
    verifikasiIdentitas: (identitas, pin) =>
      http('POST', '/ujian/verifikasi-identitas', { identitas, pin }).catch(() => null),
    sesiAktifUntukPeserta: (pesertaId) => http('GET', `/ujian/sesi-aktif?pesertaId=${encodeURIComponent(pesertaId)}`),
    verifikasiToken: (sesiId, token) =>
      http('POST', '/ujian/verifikasi-token', { sesiId, token }).then(r => r.valid),
    getOrCreateHasil: (pesertaId, sesiId) => http('POST', '/ujian/mulai', { pesertaId, sesiId }),
    simpanJawaban: (hasilId, soalId, jawabanIdx, status) =>
      http('POST', '/ujian/jawaban', { hasilId, soalId, jawabanIdx, status }),
    submitHasil: (hasilId) => http('POST', '/ujian/submit', { hasilId }),

    // ---------- PENGATURAN ----------
    getPengaturan: () => http('GET', '/pengaturan'),
    savePengaturan: (patch) => http('PUT', '/pengaturan', patch),
    getPengaturanPublik: () => http('GET', '/pengaturan/publik'),

    // ---------- AUTH ADMIN ----------
    adminLogin: (username, password) => http('POST', '/auth/login', { username, password }),
    adminLogout: () => http('POST', '/auth/logout'),
    adminMe: () => http('GET', '/auth/me'),

    // ---------- SESSION peserta yang sedang login (tetap di browser, per tab) ----------
    setSession(data) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); },
    getSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; } },
    clearSession() { sessionStorage.removeItem(SESSION_KEY); },
  };

  window.DB = DB;
})();
