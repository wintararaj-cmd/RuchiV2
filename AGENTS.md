# AGENTS.md — AI Engineering Standards & Rules
# Adapted from Everything Claude Code (ECC) for Google Antigravity

> This file provides strict engineering guidelines, security rules, and architectural standards for Antigravity agents working on this codebase.

---

## 1. Core Operating Principles (Git. Ship. Done.)

1. **Verify Before Declaring Done:**
   - Never assume code works without checking.
   - Run type checks (`npm run build` or `npx tsc --noEmit`) and lint checks before finalizing any change.
   - If a change affects database schema, verify that migrations and rollback paths are intact.

2. **Spec-Driven & Progressive Execution:**
   - For multi-step or complex features, break work down into:
     - **Plan:** Understand file impacts and declare changes.
     - **Execute:** Implement cleanly with minimal footprint.
     - **Verify:** Run checks and diagnostic tests.
   - Avoid bloated changes: make single-purpose, atomic, high-cohesion edits.

3. **Preserve Documentation & Comments:**
   - Maintain existing comments, docstrings, and context unless explicitly asked to modify them.

---

## 2. Security & Safety Rules (Zero-Trust)

1. **Secrets & Credentials Protection:**
   - **NEVER** hardcode passwords, API keys, JWT secrets, database connection strings, or tokens into code files.
   - Always load sensitive credentials from environment variables (`process.env.*`).
   - Never commit `.env`, `.env.local`, or `.env.production` containing real secrets. Only update `.env.example` with placeholders.

2. **Database Security & SQL Injection Prevention:**
   - **ALWAYS** use parameterized queries with `$1`, `$2`, etc. when interacting with PostgreSQL (`pg` pool).
   - **NEVER** use string interpolation or concatenation (e.g., `WHERE id = '${id}'` is strictly forbidden).
   - Always handle connection releases properly (`client.release()` in `finally` blocks).

3. **Input Validation & Sanitization:**
   - Validate and sanitize all external inputs in API routes (`app/api/**`).
   - Defend against NaN, undefined, empty strings, and out-of-range numerical values (especially for prices, quantities, and order totals).

---

## 3. TypeScript & Next.js 14 Guidelines

1. **Strict Type Safety:**
   - Avoid `any`. Define explicit interfaces or types in `types/` or co-located with components.
   - Use proper return types for API route handlers (`NextResponse.json(...)`).

2. **Server vs. Client Component Boundaries:**
   - Keep components Server Components (`RSC`) by default.
   - Only add `'use client'` when state (`useState`), effects (`useEffect`), browser APIs, or event listeners are required.
   - Keep client components lean by passing processed data from server components where possible.

3. **API Routes & Error Handling:**
   - Every API route (`app/api/**/route.ts`) must wrap operations in `try...catch`.
   - Never expose raw stack traces or database errors to client responses in production.
   - Return structured error responses: `{ error: string, details?: any }` with appropriate HTTP status codes (400, 401, 403, 404, 500).

---

## 4. Git & Commit Conventions

1. **Conventional Commits:**
   - Format: `<type>(<scope>): <short description>`
   - Types: `feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`, `sec:`
   - Example: `fix(order): validate minimum order amount before placing order`

2. **Clean Working Tree:**
   - Do not commit temporary test files, logs, or diagnostic scripts into git unless requested.
   - Review `git status` and `git diff` before committing.
