# Security Policy

## Supported versions

Bantuin is pre-release. Security fixes apply to the latest `main` branch until the first stable release.

## Reporting a vulnerability

Do not open a public issue containing exploit details, credentials, personal data, or private logs. Contact the repository owner privately through their verified GitHub profile and include reproduction steps with secrets removed.

## Secret handling

- Never commit API keys, channel tokens, databases, logs, or backups.
- Use local environment files only; `.env.example` contains names, never values.
- Revoke and rotate any credential that may have entered Git history or logs.
- Live-provider and external-channel tests are opt-in and must not run in public CI with untrusted code.
