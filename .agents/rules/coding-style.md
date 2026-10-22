# Coding Style & Architecture Rules

## TypeScript Standards
- Zero implicit `any`. Always supply explicit types or leverage strong inference.
- Shared domain entities (Order, Customer, MenuItem, Category, AdminUser) must remain centralized in `types/`.

## Component Architecture (Next.js 14 App Router)
- Favor Server Components (RSC) for initial page renders and data fetching.
- Mark interactive components explicitly with `'use client'`.
- Clean error boundary and loading UI for graceful customer degradation.

## Defensive Programming
- Check for `null` and `undefined` when accessing deeply nested properties.
- When parsing JSON from external sources or localStorage, always wrap with `try...catch` and provide safe fallback defaults.
- Prevent race conditions on order placement and inventory state.
