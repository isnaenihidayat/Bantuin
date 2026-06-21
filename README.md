# Bantuin

> Personal AI assistant yang bisa kamu miliki, jalankan, dan kembangkan sendiri.

Bantuin adalah proyek asisten AI **Bahasa Indonesia-first** yang self-hostable. Fondasinya dibuat sederhana: Bun + TypeScript, SQLite lokal, streaming SSE, dan provider AI yang dapat diganti tanpa mengikat core aplikasi ke satu vendor.

Saat ini Sprint 1 telah terverifikasi. API fondasi, database, mock streaming, dan adapter OpenRouter sudah tersedia; pengalaman chat utama dibangun pada Sprint 2.

## Kenapa Bantuin?

- **Data tetap dekat** — SQLite dan API berjalan lokal secara default.
- **Provider-neutral** — OpenRouter adalah provider pertama, bukan ketergantungan core.
- **Aman untuk dikembangkan** — live provider tidak dipanggil oleh test atau CI.
- **Mudah dibawa** — satu workspace Bun dan image Docker non-root.
- **Kontrak jelas** — OpenAPI, error envelope, request ID, migrasi, dan batas package sudah diuji.

## Coba dalam 2 menit

Prasyarat: [Bun 1.3.14](https://bun.sh/) atau versi kompatibel.

```bash
git clone https://github.com/isnaenihidayat/Bantuin.git
cd Bantuin
git switch feat/sprint-1-foundation
bun install --frozen-lockfile
cp .env.example .env
bun start
```

API berjalan di `http://127.0.0.1:4310`.

```bash
# Liveness dan readiness
curl http://127.0.0.1:4310/health
curl http://127.0.0.1:4310/ready

# Kontrak OpenAPI
curl http://127.0.0.1:4310/openapi.json

# Streaming chat deterministik tanpa API key
curl -N -X POST http://127.0.0.1:4310/_foundation/mock-chat \
  -H 'content-type: application/json' \
  -d '{"message":"Halo, Bantuin!"}'
```

## Menjalankan dengan Docker

```bash
docker build -t bantuin:local .
docker run --rm -p 4310:4310 -v bantuin-data:/data bantuin:local
```

Image menjalankan API sebagai user non-root dan menyimpan SQLite di volume `/data`.

## Konfigurasi

Mode mock adalah default dan tidak membutuhkan kredensial.

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `BANTUIN_HOST` | `127.0.0.1` | Alamat bind API |
| `BANTUIN_PORT` | `4310` | Port API |
| `DATABASE_URL` | `file:data/bantuin.sqlite` | Lokasi SQLite |
| `BANTUIN_PROVIDER` | `mock` | `mock` atau `openrouter` |
| `OPENROUTER_API_KEY` | — | Wajib untuk provider OpenRouter |
| `OPENROUTER_MODEL` | — | Model slug OpenRouter |

Salin `.env.example` untuk daftar lengkap. Jangan commit `.env` atau API key.

## Arsitektur

```text
apps/api            HTTP, OpenAPI, SSE, composition root
packages/core       config, error, ID, kontrak provider
packages/agent      orkestrasi agent yang provider-neutral
packages/providers  mock dan adapter OpenRouter
packages/db         migrasi SQLite dan repository
packages/client     codec transport SSE
```

`apps` boleh menggunakan `packages`; package tidak boleh mengimpor aplikasi. `packages/agent` juga tidak boleh bergantung langsung pada implementasi provider.

## Quality gate

```bash
bun run check
```

Perintah tersebut menjalankan format check, lint, strict typecheck, pemeriksaan batas package, secret scan, 18 unit/integration test, dan production build.

## Status pengembangan

| Sprint | Fokus | Status |
| --- | --- | --- |
| 1 | Foundation, SQLite, provider contract, CI, Docker | ✅ Verified |
| 2 | Core chat dan streaming OpenRouter | Berikutnya |
| 3 | Memory | Direncanakan |
| 4–6 | Tools, channel, hardening, release | Direncanakan |

Rencana dan laporan teknis tersedia di [`process/features/personal-ai-assistant/`](process/features/personal-ai-assistant/).

## Inspirasi dan lisensi

Bantuin mengambil inspirasi arsitektur dari [TinyClaw](https://github.com/ahmadrosid/tinyclaw) tanpa menyalin source aplikasinya pada Sprint 1.

Dirilis dengan lisensi [MIT](LICENSE). Lihat [Third-Party Notices](THIRD_PARTY_NOTICES.md) untuk atribusi.
