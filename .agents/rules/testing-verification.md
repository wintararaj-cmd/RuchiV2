# Verification & Quality Assurance Protocol

## Mandatory Pre-Completion Checks
Before marking any task as complete:
1. **Type Check:** Ensure there are no TypeScript compilation errors (`npx tsc --noEmit`).
2. **Build Verification:** Run `npm run build` or inspect affected modules when modifying build/configuration files.
3. **Database Integrity:** When updating migrations or schemas, verify that SQL scripts execute without syntax or constraint errors.
4. **No Broken Dependencies:** Check that any new npm package is correctly recorded in `package.json`.
