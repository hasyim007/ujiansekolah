-- Data contoh awal — jalankan setelah schema.sql
-- Hapus/ubah sesuai kebutuhan sekolah kamu sebelum dipakai sungguhan.

INSERT INTO pengaturan (id, username, password, acak_soal, acak_pilihan, logging_fullscreen, batas_identitas, batas_token, interval_token, interval_autosave, toleransi_offline)
VALUES (1, 'admin', 'admin123', 1, 1, 1, 5, 5, 15, 60, 10)
ON CONFLICT(id) DO NOTHING;

INSERT INTO soal (id, teks, mapel, tingkat, bobot, pilihan, kunci) VALUES
('s1','Hasil dari 245 + 378 adalah ...','Matematika','Mudah',10,'["613","623","633","643"]','[1]'),
('s2','Sebuah persegi memiliki sisi 8 cm. Berapa luas persegi tersebut?','Matematika','Sedang',10,'["16 cm²","32 cm²","64 cm²","72 cm²"]','[2]'),
('s3','Pecahan 3/4 jika diubah ke bentuk desimal menjadi ...','Matematika','Mudah',10,'["0,25","0,50","0,75","0,80"]','[2]'),
('s4','KPK dari 6 dan 8 adalah ...','Matematika','Sedang',10,'["12","24","36","48"]','[1]'),
('s5','Bangun ruang yang memiliki 6 sisi berbentuk persegi disebut ...','Matematika','Sulit',10,'["Balok","Kubus","Prisma","Limas"]','[1]'),
('s6','Kalimat yang menggunakan ejaan baku adalah ...','Bahasa Indonesia','Sedang',10,'["Ia pergi ke pasar","Ia pergi kepasar","Ia pergi ke-pasar","Ia pergi ke Pasar"]','[0]'),
('s7','Sinonim dari kata "gembira" adalah ...','Bahasa Indonesia','Mudah',10,'["Sedih","Marah","Senang","Takut"]','[2]');

INSERT INTO sesi (id, nama, mapel, kelas, jadwal, durasi, soal_ids, acak_soal, acak_pilihan, tampilkan_nilai, interval_token, kkm, nilai_minus, pengawas, status, token, token_set_at) VALUES
('sesi1','Ujian Sekolah — Matematika','Matematika','VI-A, VI-B','12 Agu 2026, 08:00',90,'["s1","s2","s3","s4","s5"]',1,1,1,15,70,0,'Bu Sari — Ruang 5A','Berlangsung','482913', strftime('%s','now')*1000),
('sesi2','Ujian Sekolah — Bahasa Indonesia','Bahasa Indonesia','VI-A, VI-B','13 Agu 2026, 08:00',90,'["s6","s7"]',1,1,0,15,70,0,'','Terjadwal','119284', strftime('%s','now')*1000);

INSERT INTO peserta (id, nomor, pin, nama, kelas) VALUES
('p1','25-05A-01','1234','Ahmad Fauzan','VI-A'),
('p2','25-05A-02','1234','Bilqis Aisyah','VI-A'),
('p3','25-05A-03','1234','Citra Dewi','VI-A'),
('p4','25-05B-01','1234','Dimas Ramadhan','VI-B'),
('p5','25-05B-02','1234','Erlangga Putra','VI-B');

-- beberapa hasil contoh biar dashboard/livescore tidak kosong saat pertama dicoba
INSERT INTO hasil (id, peserta_id, sesi_id, status, waktu_mulai, waktu_selesai, jawaban, status_soal, benar, salah, nilai) VALUES
('h1','p2','sesi1','Selesai', (strftime('%s','now')-3600)*1000, (strftime('%s','now')-3000)*1000, '{"s1":1,"s2":2,"s3":2,"s4":1,"s5":0}', '{}', 4, 1, 80),
('h2','p4','sesi1','Selesai', (strftime('%s','now')-3500)*1000, (strftime('%s','now')-2900)*1000, '{"s1":1,"s2":2,"s3":2,"s4":1,"s5":1}', '{}', 5, 0, 100);
