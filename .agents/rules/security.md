# Security & Hardening Rules

## Credentials & Environment
- Never expose API keys, database connection strings, JWT secrets, or administrative credentials in source code.
- Always check that `.gitignore` prevents sensitive configuration files (`.env*` except `.env.example`) from reaching version control.

## Database Protection
- Enforce parameterized SQL queries (`$1`, `$2`, etc.) in all database interactions with PostgreSQL.
- Prevent destructive queries (`DROP TABLE`, `TRUNCATE`, bulk deletions) without explicit validation and transaction bounds.
- Use explicit transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) for multi-step mutations to prevent inconsistent database state.

## Endpoint & Auth Security
- Protect administrative routes under `/api/admin/*` and pages under `/admin/*` by checking session / JWT tokens.
- Restrict sensitive actions (financial data, order deletion, user role updates) to authorized admin roles only.
