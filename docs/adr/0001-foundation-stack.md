# ADR-0001: Foundation Stack

Status: Accepted  
Date: 21-06-26

## Decision

Use a Bun and strict TypeScript monorepo, Hono API, SQLite persistence, React/Vite web client in a later sprint, and OpenRouter as the initial model provider behind a provider-neutral adapter.

The API binds to loopback by default. Provider credentials are supplied through process environment and never stored in normal application tables or returned to clients.

## Consequences

- Runtime-specific APIs such as `bun:sqlite` must be isolated behind package boundaries.
- Automated tests use a deterministic mock provider; live OpenRouter checks are opt-in.
- Alternative providers can be added without changing agent-domain contracts.
- Internet exposure requires a separate authentication and deployment review.
