-- Skema Database — Sistem Ujian Sekolah (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS soal (
  id        TEXT PRIMARY KEY,
  teks      TEXT NOT NULL,
  mapel     TEXT NOT NULL DEFAULT 'Matematika',
  tingkat   TEXT NOT NULL DEFAULT 'Sedang',
  bobot     INTEGER NOT NULL DEFAULT 10,
  pilihan   TEXT NOT NULL DEFAULT '[]',   -- JSON array string
  kunci     TEXT NOT NULL DEFAULT '[]',   -- JSON array of indices (int)
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);

CREATE TABLE IF NOT EXISTS sesi (
  id               TEXT PRIMARY KEY,
  nama             TEXT NOT NULL,
  mapel            TEXT NOT NULL DEFAULT 'Matematika',
  kelas            TEXT NOT NULL DEFAULT '',
  jadwal           TEXT DEFAULT 'Belum dijadwalkan',
  durasi           INTEGER NOT NULL DEFAULT 90,
  soal_ids         TEXT NOT NULL DEFAULT '[]',  -- JSON array of soal.id
  acak_soal        INTEGER NOT NULL DEFAULT 1,
  acak_pilihan     INTEGER NOT NULL DEFAULT 1,
  tampilkan_nilai  INTEGER NOT NULL DEFAULT 0,
  interval_token   INTEGER NOT NULL DEFAULT 15,
  kkm              INTEGER NOT NULL DEFAULT 70,
  nilai_minus      INTEGER NOT NULL DEFAULT 0,
  pengawas         TEXT DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'Draft', -- Draft | Terjadwal | Berlangsung | Selesai
  token            TEXT,
  token_set_at     INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);

CREATE TABLE IF NOT EXISTS peserta (
  id      TEXT PRIMARY KEY,
  nomor   TEXT NOT NULL UNIQUE,
  pin     TEXT NOT NULL,
  nama    TEXT NOT NULL,
  kelas   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hasil (
  id             TEXT PRIMARY KEY,
  peserta_id     TEXT NOT NULL REFERENCES peserta(id),
  sesi_id        TEXT NOT NULL REFERENCES sesi(id),
  status         TEXT NOT NULL DEFAULT 'Belum Mulai', -- Belum Mulai | Sedang Mengerjakan | Selesai
  waktu_mulai    INTEGER,
  waktu_selesai  INTEGER,
  jawaban        TEXT NOT NULL DEFAULT '{}',      -- JSON { soalId: pilihanIdx }
  status_soal    TEXT NOT NULL DEFAULT '{}',      -- JSON { soalId: 'dijawab'|'ragu' }
  benar          INTEGER NOT NULL DEFAULT 0,
  salah          INTEGER NOT NULL DEFAULT 0,
  nilai          INTEGER,
  reset_alasan   TEXT,
  UNIQUE(peserta_id, sesi_id)
);

CREATE TABLE IF NOT EXISTS pengaturan (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  username             TEXT NOT NULL DEFAULT 'admin',
  password             TEXT NOT NULL DEFAULT 'admin123',
  acak_soal            INTEGER NOT NULL DEFAULT 1,
  acak_pilihan         INTEGER NOT NULL DEFAULT 1,
  logging_fullscreen   INTEGER NOT NULL DEFAULT 1,
  batas_identitas      INTEGER NOT NULL DEFAULT 5,
  batas_token          INTEGER NOT NULL DEFAULT 5,
  interval_token       INTEGER NOT NULL DEFAULT 15,
  interval_autosave    INTEGER NOT NULL DEFAULT 60,
  toleransi_offline    INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token       TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limit (
  kunci   TEXT PRIMARY KEY,
  jumlah  INTEGER NOT NULL DEFAULT 0,
  mulai   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hasil_sesi ON hasil(sesi_id);
CREATE INDEX IF NOT EXISTS idx_hasil_peserta ON hasil(peserta_id);
CREATE INDEX IF NOT EXISTS idx_soal_mapel ON soal(mapel);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_exp ON admin_sessions(expires_at);
