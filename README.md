# Bantuin

> Personal AI assistant Bahasa Indonesia-first yang bisa kamu host sendiri.

Bantuin adalah asisten AI lokal-first dengan web chat, memory, knowledge, safe actions, automations, task tracking, CLI, Telegram adapter, backup/restore, dan Docker runtime non-root. Proyek ini mengambil inspirasi produk dari TinyClaw, tetapi arsitektur Bantuin tetap single-owner dan modular monolith sederhana.

## Fitur saat ini

- Web chat streaming dengan history durable di SQLite.
- Provider-neutral: `mock` default, OpenRouter opsional.
- Profile, memory eksplisit, knowledge `.txt`/`.md`, dan export JSON.
- Safe actions, tasks, automations, MCP metadata-only registry.
- CLI tipis via shared HTTP/SSE client.
- Telegram private-text adapter dengan allowlist dan dedup inbound.
- Backup/restore SQLite dengan checksum, schema check, dan integrity check.
- Docker image non-root dengan `/health` dan `/ready`.

## Quick start lokal

Prasyarat: Bun 1.3.14.

```bash
git clone https://github.com/isnaenihidayat/Bantuin.git
cd Bantuin
bun install --frozen-lockfile
cp .env.example .env
bun run db:migrate
bun run start
```

Buka `http://127.0.0.1:4310`, lalu buat owner pertama dari layar setup.

Health check:

```bash
curl http://127.0.0.1:4310/health
curl http://127.0.0.1:4310/ready
```

## Provider OpenRouter

Mode default `mock` tidak butuh API key. Untuk OpenRouter, isi:

```env
BANTUIN_PROVIDER=openrouter
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

Live provider check bersifat opt-in lewat `BANTUIN_LIVE_PROVIDER_CHECK=true`.

## CLI

CLI memakai akun owner yang sudah dibuat di web.

```bash
BANTUIN_EMAIL=owner@example.com \
BANTUIN_PASSWORD='password panjang kamu' \
bun run start:cli
```

Perintah CLI:

- `/new` membuat percakapan baru.
- `/status` membaca status runtime/usage.
- `/exit` keluar.

## Telegram

Telegram adapter hanya menerima private chat dari satu user ID yang diizinkan. Tidak ada token yang disimpan di DB/export/log.

```bash
TELEGRAM_BOT_TOKEN= \
TELEGRAM_ALLOWED_USER_ID= \
BANTUIN_EMAIL=owner@example.com \
BANTUIN_PASSWORD='password panjang kamu' \
bun run start:telegram
```

WhatsApp belum aktif dan butuh approval terpisah.

## Backup dan restore

Backup membuat snapshot SQLite plus manifest SHA-256:

```bash
DATABASE_URL=file:data/bantuin.sqlite bun run db:backup backups
```

Restore selalu ke file baru dan menolak overwrite:

```bash
bun run db:restore backups/bantuin-...sqlite.json file:data/restored.sqlite
```

Rollback paling kecil:

1. Stop proses/container.
2. Restore manifest terakhir ke path SQLite baru.
3. Jalankan dengan `DATABASE_URL=file:<path-baru>`.
4. Cek `/ready`.
5. Baru ganti volume/path produksi.

## Docker

```bash
docker build -t bantuin:local .
docker run --rm -p 4310:4310 -v bantuin-data:/data bantuin:local
```

Default container:

- bind `0.0.0.0:4310`;
- SQLite di `/data/bantuin.sqlite`;
- provider `mock`;
- user non-root `bantuin`;
- healthcheck `/ready`.

## Konfigurasi

Salin `.env.example`. Jangan commit `.env`, database, backup, log, API key, atau channel token.

| Variabel | Keterangan |
| --- | --- |
| `BANTUIN_HOST`, `BANTUIN_PORT`, `BANTUIN_PUBLIC_ORIGIN` | Host/port/origin API |
| `DATABASE_URL` | SQLite `file:` URL |
| `BANTUIN_PROVIDER` | `mock` atau `openrouter` |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Wajib hanya untuk OpenRouter |
| `BANTUIN_EMAIL`, `BANTUIN_PASSWORD`, `BANTUIN_API_URL` | CLI/Telegram client |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID` | Telegram adapter |

## Quality gate

```bash
bun run check
bun audit
docker build -t bantuin:local .
```

Gate saat ini menjalankan format check, lint, strict typecheck, package-boundary check, secret scan, 39 tests, dan build API/web/CLI/Telegram.

## Struktur

```text
apps/api        HTTP, OpenAPI, SSE, auth, web static serving
apps/web        React UI
apps/cli        readline CLI
apps/telegram   Telegram long-polling adapter
packages/core   config, error, runtime, provider contracts
packages/agent  context assembly and provider orchestration
packages/db     SQLite migrations and repositories
packages/client HTTP/SSE client
packages/providers mock and OpenRouter providers
scripts         checks and backup/restore
```

## Status

Phases 01–04 personal AI assistant clone program sudah verified di branch `feat/sprint-3-memory`. Sprint 06 hardening/release sedang menutup blocker dokumentasi, versioning, dan runbook sebelum release/tag.

## Lisensi dan atribusi

MIT. Lihat [LICENSE](LICENSE) dan [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
