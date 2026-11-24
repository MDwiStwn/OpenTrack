# OpenTrack

**OpenTrack** adalah platform **Issue & Project Tracker** open-source dan *self-hosted* (alternatif modern untuk Linear dan Jira) yang dibangun dengan Next.js 15 App Router, TypeScript, Prisma 6, PostgreSQL 16, Tailwind CSS, shadcn/ui, dan komponen interaktif React Bits.

Dirancang untuk tim engineering, product, dan QC yang membutuhkan pelacakan tiket cepat, isolasi data multi-workspace, pelaporan progres sprint (Cycles) dengan grafik burn-up, serta kepemilikan penuh atas database dan file media di server sendiri.

---

## Daftar Isi

1. [Fitur Utama](#fitur-utama)
2. [Tech Stack & Arsitektur](#tech-stack--arsitektur)
3. [Prasyarat](#prasyarat)
4. [Instalasi Cepat (Docker Compose)](#instalasi-cepat-docker-compose)
5. [Instalasi Development Lokal (Tanpa Docker untuk App)](#instalasi-development-lokal)
6. [Konfigurasi Environment Variables](#konfigurasi-environment-variables)
7. [Panduan Penggunaan Lengkap](#panduan-penggunaan-lengkap)
8. [Migrasi Data dari Jira & Linear](#migrasi-data-dari-jira--linear)
9. [Arsitektur Keamanan](#arsitektur-keamanan)
10. [Referensi REST API v1 & Webhooks](#referensi-rest-api-v1--webhooks)
11. [Deploy ke Production & Backup Data](#deploy-ke-production--backup-data)
12. [CI/CD Otomatis (GitHub Actions)](#cicd-otomatis-github-actions)
13. [Struktur Proyek](#struktur-proyek)
14. [Kontribusi & Lisensi](#kontribusi--lisensi)

---

## Fitur Utama

### 1. Global User Account & Multi-Workspace Architecture (RBAC)
- Satu akun email dapat tergabung ke banyak workspace perusahaan atau tim berbeda dengan **isolasi data penuh** (project, tiket, workflow, cycle, label, view, API key, dan webhook terpisah per workspace).
- **Workspace Switcher** di pojok kiri atas sidebar untuk berpindah workspace secara instan atau membuat workspace baru.
- **Role-Based Access Control (RBAC)**: `OWNER`, `ADMIN`, dan `MEMBER`.
- **Invitation Flow**: Undang anggota baru melalui tautan undangan (`/invite/:token`) dengan batas masa berlaku dan pilihan role, atau kelola langsung di **Settings -> Members & Invitations**.
- **Kode Tiket Seragam (Unified Issue Prefix)**: Satu kode awalan tiket untuk seluruh project dalam satu workspace (misal: `SDG-1`, `SDG-2`, `ENG-1`) yang dapat diubah kapan saja di **Settings -> General**, termasuk opsi menyeragamkan seluruh tiket lama.

### 2. Projects & Milestones
- Halaman direktori **`/projects`** menampilkan tabel lengkap (Name, active Milestone, Health `On track`/`At risk`/`Off track`, Priority, Lead, Target date, jumlah Issues, dan persentase progres) serta tampilan kartu responsif khusus layar HP.
- Halaman detail **`/projects/:id`** dengan 3 tab utama:
  - **Overview**: Ikon project, judul, ringkasan inline-editable, Properties (Status, Priority, Lead, Start -> Target date), Resources (`+ Add document or link...`), composer **Project Update** (memperbarui status Health), deskripsi Markdown, dan daftar **Milestones** (`Stabilization`, `Feature Request`, `Maintenance` + progres masing-masing).
  - **Activity**: Linimasa gabungan Project Updates dan seluruh aktivitas perubahan tiket di dalam project tersebut.
  - **Issues**: Daftar/papan tiket yang otomatis terfilter untuk project tersebut.

### 3. Cycles (Sprints) & Burn-Up Chart
- Halaman **`/cycles`**: Timeline vertikal seluruh sprint (Upcoming, Current, Completed) dengan sumbu tanggal di kiri, indikator kapasitas & scope, serta **Grafik Burn-Up SVG** terintegrasi langsung pada Current Cycle (`Scope`, `Started`, `Completed`, dan bar penyelesaian harian).
- Halaman detail **`/cycles/:id`** (serta shortcut **Current** & **Upcoming** di sidebar):
  - Menampilkan daftar tiket (mode List & Kanban Board) beserta panel kanan **Progress** (Grafik Burn-Up + breakdown **Assignees**, **Labels**, **Priority**, **Projects**).
  - Menampilkan tampilan **Planning** (`Capacity`, `Days to start`, `Scope`) dan tombol cepat `Create new issue [C]` untuk cycle mendatang yang masih kosong.

### 4. Issues (List View, Kanban Board, Search & Detail Lengkap)
- **List View** dengan tab `Active`, `Backlog`, `All issues` dan quick-edit inline untuk status, prioritas, estimate, dan assignee.
- **Kanban Board** dengan swimlane (`Priority`, `Assignee`, `None`) yang dapat dilipat (*collapsible*) dan drag-and-drop optimis (`@dnd-kit/core`).
- **Pencarian Fleksibel** (`Ctrl + K` Command Palette & filter search): ketik `sdg 1` atau kata kunci bebas untuk menemukan tiket secara instan.
- **Detail Tiket (`/issues/:identifier`)**:
  - Editor Markdown kaya fitur dengan **checklist interaktif** (bisa dicentang langsung di mode baca), tabel, **unggah & paste (`Ctrl+V`) gambar maupun video** dengan pratinjau langsung sebelum dikirim, pemutar video inline (HTTP 206 Range streaming), dan lightbox zoom.
  - **Panel Kanan Lengkap**: Properties, Labels, Project & Milestone picker, Custom Fields dinamis (`+ Field`), **Multi-PIC Workflow Stages** (`Development`, `Code Review`, `QC Demo`, `QC Production`, `Delivered` dengan dukungan 1 atau lebih PIC per tahap), Platform/Environment, dan **Time Tracking** (stopwatch live, grafik 7 hari, tambah cepat `+15m`/`+30m`/`+1j`, input manual, serta akumulasi durasi otomatis per tahap).
  - **`@mention` & Inbox (`/inbox`)**: Tag anggota tim di kolom komentar dengan `@nama` untuk mengirim notifikasi instan ke Inbox mereka.
  - **Issue Templates**: Template deskripsi tiket yang dapat diedit di **Settings -> Issue Templates** dan diterapkan dengan 1 klik tombol **Isi Template Standar**.

### 5. Custom & Saved Views
- Buat papan kerja khusus sesuai divisi (misal: *Mobile Development*, *QC Mobile*, *Web Development & API*, *QC Web & API*) dengan filter multi-Project, multi-Workflow Status, Label, Priority, dan Cycle.
- Tersedia tombol **`+ Tambah Status`** langsung di dalam modal View Editor untuk menambah tahap workflow baru (misal: `QC Production Standby`, `QC Production`) tanpa berpindah halaman.

### 6. Mobile / HP Responsive & Graceful Disconnect Handling
- Dilengkapi **Mobile Top Header Bar**, drawer navigasi sentuh, dan kartu responsif di layar HP (`< 768px`).
- Halaman **404 Not Found** dan deteksi otomatis saat koneksi ke server terputus / maintenance menggunakan komponen interaktif React Bits (`FuzzyText`, `SpotlightCard`, `SquaresBackground`).

---

## Tech Stack & Arsitektur

| Lapisan | Teknologi |
| :--- | :--- |
| Framework | Next.js 15 (App Router, Standalone Output), React 19, TypeScript |
| Styling & UI | Tailwind CSS 3, shadcn/ui (New York, Zinc Dark), React Bits, Lucide Icons |
| Database & ORM | PostgreSQL 16, Prisma 6 |
| Autentikasi | Encrypted JWT (JWE `A256GCM` via `jose`), `bcryptjs` (cost 12), Cookie `HttpOnly` |
| Drag & Drop | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Markdown | `react-markdown`, `remark-gfm` |
| Validasi | `zod` |
| Kontainerisasi | Docker & Docker Compose |

---

## Prasyarat

- **Docker** & **Docker Compose** (direkomendasikan untuk setup tercepat dan production)
- Atau untuk development lokal: **Node.js 20+**, **npm**, dan **PostgreSQL 16**

---

## Instalasi Cepat (Docker Compose)

Secara default, OpenTrack dimulai dengan **database bersih (kosong)** (`SEED_DATABASE=false`) sehingga setiap perusahaan atau tim membuat akun, workspace, project, dan tiketnya sendiri dari awal.

### 1. Clone Repository
```bash
git clone https://github.com/<username>/OpenTrack.git
cd OpenTrack
```

### 2. Buat File `.env` dan Generate `JWT_SECRET`
```bash
cp .env.example .env
openssl rand -hex 32
```
Salin string acak 64 karakter hasil perintah di atas ke variabel `JWT_SECRET` di dalam file `.env`. Jangan pernah meng-commit file `.env` ke Git (sudah masuk di `.gitignore`).

### 3. Jalankan dengan Docker Compose
```bash
docker compose up -d --build
```

### 4. Buka Aplikasi & Setup Workspace Pertama
1. Buka browser ke **`http://localhost:3000`**.
2. Klik **Buat Workspace Baru** (`/register`).
3. Isi **Email**, **Nama Workspace**, dan **Kata Sandi** (minimal 8 karakter). Kolom Nama Tampilan bersifat opsional (jika dikosongkan otomatis menggunakan email).
4. Anda otomatis masuk sebagai **OWNER** dan 8 tahap workflow standar langsung siap digunakan.

> **Opsional (Data Demo Lokal)**: Jika Anda hanya ingin menguji dengan data contoh di localhost, jalankan dengan `SEED_DATABASE=true docker compose up -d` atau `npm run db:seed`.

---

## Instalasi Development Lokal

Jika ingin menjalankan Next.js secara lokal tanpa build ulang Docker image:

```bash
# 1. Jalankan hanya PostgreSQL via Docker
docker compose up -d db

# 2. Install dependensi
npm install

# 3. Salin dan sesuaikan .env
cp .env.example .env

# 4. Sinkronisasi schema Prisma ke PostgreSQL
npx prisma generate
npx prisma db push

# 5. Jalankan dev server
npm run dev
```

Aplikasi berjalan di **`http://localhost:3000`**.

---

## Konfigurasi Environment Variables

| Variabel | Wajib | Default | Deskripsi |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Ya | - | Connection string PostgreSQL 16 |
| `JWT_SECRET` | Ya | - | Kunci enkripsi JWE AES-256-GCM (minimal 32 karakter acak, buat via `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | Tidak | `24h` | Masa berlaku sesi login (contoh: `12h`, `24h`, `7d`) |
| `COOKIE_SECURE` | Tidak | `false` | Set ke `true` saat production di belakang HTTPS |
| `SEED_DATABASE` | Tidak | `false` | Set `false` untuk database bersih; `true` hanya jika ingin data demo lokal |
| `UPLOAD_DIR` | Tidak | `/app/uploads` | Lokasi penyimpanan file gambar & video yang diunggah |
| `APP_PORT` | Tidak | `3000` | Port host untuk container aplikasi |

---

## Panduan Penggunaan Lengkap

### 1. Mengatur Workspace & Kode Tiket Seragam
1. Buka **Settings -> General**.
2. Ubah **Nama Workspace** atau atur **Kode Tiket Seragam (Issue Prefix)**, misalnya `SDG`, `ENG`, atau `OPS`.
3. Centang **"Seragamkan juga seluruh tiket yang sudah ada ke kode ini"** bila ingin semua tiket lama langsung berubah penomorannya secara berurutan (`SDG-1`, `SDG-2`, dst.).

### 2. Mengundang Anggota Tim
1. Buka **Settings -> Members & Invitations**.
2. Pilih role (`MEMBER`, `ADMIN`, atau `OWNER`) dan masa berlaku tautan (1-30 hari), lalu klik **Buat Tautan Undangan**.
3. Bagikan tautan `/invite/...` ke anggota tim. Mereka bisa mendaftar akun baru atau bergabung memakai akun OpenTrack yang sudah dimiliki.

### 3. Mengelola Project & Milestone
1. Buka menu **Projects** di sidebar, lalu klik **`+ New project`**.
2. Setiap project baru otomatis mendapatkan 3 milestone default (`Stabilization`, `Feature Request`, `Maintenance`).
3. Klik baris project untuk membuka tab **Overview** (tulis Project Update, tautkan dokumen di Resources, edit Deskripsi Markdown, tambah/hapus Milestone), **Activity**, dan **Issues**.

### 4. Mengelola Cycle (Sprint)
1. Buka menu **Cycles** di sidebar, lalu klik **`+ New cycle`**.
2. Tentukan nama sprint, tanggal mulai & selesai, dan status (`Upcoming` atau `Active`).
3. Buka detail cycle (atau klik **Current** / **Upcoming** di sidebar) untuk memantau **Grafik Burn-Up**, breakdown progres per **Assignees / Labels / Priority / Projects**, dan memindahkan tiket ke dalam sprint.

### 5. Membuat, Melacak Tiket & Time Tracking
- Tekan tombol keyboard **`C`** dari halaman mana saja (atau klik tombol **`+ New issue`**) untuk membuka modal pembuatan tiket cepat.
- Tekan **`Ctrl + K`** (atau `Cmd + K`) untuk membuka Command Palette pencarian cepat.
- Klik area kartu atau baris tiket mana saja untuk masuk ke halaman detail:
  - Paste (`Ctrl+V`) atau unggah gambar/video langsung di deskripsi maupun komentar.
  - Gunakan `@nama` di komentar untuk mengirim notifikasi ke **Inbox** rekan tim.
  - Di panel kanan, atur **Project & Milestone**, **Workflow Stages** (bisa memilih lebih dari 1 PIC per tahap), serta gunakan **Time Tracking** (Timer Start/Stop, tombol cepat `+15m`/`+30m`/`+1j`, atau input manual).

### 6. Membuat Custom Views & Menambah Status Workflow
1. Klik tombol **`+`** di samping **Saved Views** di sidebar (atau buka halaman **Views**).
2. Pilih preset cepat atau filter sesuai kebutuhan (Projects, Workflow Statuses, Labels, Priority, Cycle).
3. Jika butuh tahap workflow baru (misal: `QC Production Standby` atau `QC Production`), klik **`+ Tambah Status`** langsung di bagian Filter Workflow Statuses (atau kelola urutannya di **Settings -> Workflow Statuses**).

---

## Migrasi Data dari Jira & Linear

Perusahaan atau startup yang sebelumnya memakai Linear atau Jira dapat memindahkan tiket secara massal melalui **Settings -> Import / Migrasi**:

1. **Export dari Linear**: `Settings -> Import / Export -> Export CSV`.
2. **Export dari Jira**: `Filters -> View all issues -> Export -> Export Excel CSV (all fields)`.
3. Buka **Settings -> Import / Migrasi** di OpenTrack.
4. Klik **Pilih File CSV / JSON** (format Linear, Jira, atau Generic CSV/JSON terdeteksi otomatis, maksimal 500 tiket per batch).
5. Pilih **Project Tujuan** dan **Fallback Status**, tinjau tabel pratinjau, lalu klik **Mulai Import**.
6. Status, Priority, Estimate/Story Points, Assignee, dan Labels akan dipetakan otomatis, sementara ID tiket asal (`JIRA-123` atau `LIN-45`) tetap tercatat pada Custom Field tiket.

---

## Arsitektur Keamanan

OpenTrack telah diaudit dan diperkuat pada lapisan autentikasi, jaringan, dan file upload:
- **Encrypted Session Tokens (JWE)**: Sesi menggunakan `jose` `EncryptJWT` (`alg: dir`, `enc: A256GCM`) dengan validasi ketat `iss`, `aud`, dan `exp` (`JWT_EXPIRES_IN`, default `24h`), disimpan di cookie `HttpOnly` + `SameSite=Lax`. Payload token terenkripsi penuh dan tidak dapat di-decode Base64 oleh klien.
- **Password Hashing**: `bcryptjs` dengan cost factor `12` dan panjang minimum 8 karakter.
- **Auth & Invitation Rate Limiting**: Pembatasan sliding-window pada `/api/auth/login`, `/api/auth/register`, dan `/api/invitations/:token` (`HTTP 429` + `Retry-After`).
- **SSRF Protection pada Webhook**: Validasi DNS dan pemblokiran protokol non-HTTP(S), `localhost`, host internal, IP privat RFC1918/IPv6, link-local, dan endpoint metadata cloud dengan `redirect: "manual"`.
- **Upload Magic-Byte Verification**: Verifikasi signature biner (PNG, JPEG, GIF, WEBP, MP4, WEBM, MOV, OGG), penolakan path traversal, validasi header `Range`, serta serving header terisolasi (`X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`).
- **HTTP Security Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, dan `poweredByHeader: false`.

---

## Referensi REST API v1 & Webhooks

Buat API Key di **Settings -> API Keys**, lalu kirim lewat header `Authorization: Bearer <API_KEY>` atau `X-API-Key: <API_KEY>`:

```bash
# Daftar tiket dengan filter
curl -H "Authorization: Bearer <API_KEY>" \
  "http://localhost:3000/api/v1/issues?status=qc-demo-standby"

# Detail satu tiket
curl -H "Authorization: Bearer <API_KEY>" \
  "http://localhost:3000/api/v1/issues/SDG-1"

# Ubah status tiket (mencatat ActivityLog + memicu Webhook)
curl -X PATCH \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"status":"QC Demo"}' \
  "http://localhost:3000/api/v1/issues/SDG-1/status"

# Ambil cycle aktif & statistik progres
curl -H "Authorization: Bearer <API_KEY>" \
  "http://localhost:3000/api/v1/cycles/active"
```

**Outbound Webhooks** (dikonfigurasi di **Settings -> Webhooks**) mendukung event `issue.created`, `issue.updated`, dan `issue.status_changed`, ditandatangani dengan header `X-OpenTrack-Signature: sha256=<HMAC_HEX>`.

---

## Deploy ke Production & Backup Data

### Penyimpanan Data (Persistent Volumes)
Saat dijalankan dengan Docker Compose di VPS (Ubuntu/Debian, Coolify, atau Dokploy):
- **`opentrack_pgdata`**: Menyimpan seluruh database PostgreSQL 16 (`/var/lib/postgresql/data`).
- **`opentrack_uploads`**: Menyimpan seluruh gambar dan video lampiran (`/app/uploads`).

### Checklist Production
1. Set `JWT_SECRET` acak 64-hex (`openssl rand -hex 32`) dan ganti `POSTGRES_PASSWORD` di `.env`.
2. Pastikan `SEED_DATABASE=false`.
3. Pasang reverse proxy HTTPS (Nginx / Caddy / Cloudflare Tunnel) menuju port `3000` dan set `COOKIE_SECURE=true`.
4. Jadwalkan backup PostgreSQL berkala:
   ```bash
   docker exec opentrack-db pg_dump -U opentrack opentrack > backup_$(date +%F).sql
   ```

---

## CI/CD Otomatis (GitHub Actions)

Repository ini sudah dilengkapi pipeline CI/CD di `.github/workflows/ci-cd.yml` dan `docker-compose.prod.yml` dengan 3 tahap otomatis setiap ada push ke branch `main`:

1. **`ci` (Lint, Typecheck & Build)**: Menjalankan `prisma validate`, `tsc --noEmit`, `npm run lint`, dan `npm run build` pada setiap Push maupun Pull Request.
2. **`docker` (Build & Push ke GHCR)**: Membangun image production di server GitHub Actions (sehingga RAM VPS Anda tetap ringan) lalu menyimpannya ke GitHub Container Registry (`ghcr.io/<owner>/<repo>:latest`).
3. **`deploy` (Auto-Deploy via SSH + Healthcheck)**: Login ke VPS/EC2 Anda via SSH, menarik image terbaru, me-restart container `opentrack-app`, dan memverifikasi endpoint `/api/health` mengembalikan `"ok"`.

### Cara Mengaktifkan Auto-Deploy di GitHub
Buka repository GitHub Anda -> **Settings -> Secrets and variables -> Actions -> New repository secret**, lalu tambahkan secret berikut:

| Nama Secret | Wajib | Contoh Nilai | Keterangan |
| :--- | :---: | :--- | :--- |
| `SSH_HOST` | Ya | `103.xx.xx.xx` | Alamat IP publik VPS / Elastic IP EC2 Anda |
| `SSH_USER` | Ya | `ubuntu` atau `root` | Username SSH server |
| `SSH_PRIVATE_KEY` | Ya | `-----BEGIN OPENSSH PRIVATE KEY----- ...` | Isi private key SSH (`.pem` atau `~/.ssh/id_ed25519`) |
| `SSH_PORT` | Opsional | `22` | Port SSH server (default `22`) |
| `DEPLOY_PATH` | Opsional | `/home/ubuntu/OpenTrack` | Folder lokasi clone repo di server (default `~/OpenTrack`) |
| `GHCR_TOKEN` | Opsional | `ghp_...` | Personal Access Token (`read:packages`) hanya jika repo bersifat **Private** |

> Jika secret `SSH_HOST` belum diisi, tahap `ci` dan `docker` tetap berjalan hijau (tanpa error) sampai server VPS Anda siap.

---

## Struktur Proyek

```text
OpenTrack/
├── prisma/
│   ├── schema.prisma          # Skema database PostgreSQL (Workspace, Project, Milestone, Cycle, Issue, dll.)
│   └── seed.ts                # Opsional seed data demo lokal
├── src/
│   ├── app/
│   │   ├── (auth)/            # Halaman Login & Register (React Bits + shadcn/ui)
│   │   ├── (app)/             # Halaman utama: board, projects, cycles, views, inbox, issues, settings
│   │   ├── invite/[token]/    # Halaman penerimaan undangan workspace
│   │   ├── api/               # Internal API, Auth API, Upload streaming, Import API, REST API v1
│   │   ├── not-found.tsx      # Halaman 404 Not Found (React Bits FuzzyText)
│   │   └── error.tsx          # Global Error / Server Disconnected boundary
│   ├── components/
│   │   ├── ui/                # Primitif shadcn/ui (Button, Input, Card, Table, Badge, Tabs, dll.)
│   │   ├── reactbits/         # Komponen React Bits (FuzzyText, SpotlightCard, SquaresBackground, CountUp)
│   │   └── ...                # AppSidebar, IssuesWorkspace, KanbanBoard, ListView, CycleBurnupChart, dll.
│   └── lib/                   # auth.ts (JWE), security.ts (SSRF/RateLimit/MagicBytes), issues.ts, cycle-metrics.ts
├── docker-compose.yml
├── Dockerfile
├── docker-entrypoint.sh
└── .env.example
```

---

## Kontribusi & Lisensi

Kontribusi sangat terbuka! Lihat [CONTRIBUTING.md](CONTRIBUTING.md) untuk panduan pengembangan dan pull request.

Project ini dirilis di bawah lisensi **MIT** - lihat [LICENSE](LICENSE).
