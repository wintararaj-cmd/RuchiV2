# Git & Change Management Rules

## Commit Message Protocol
Follow the Conventional Commits specification:
- `feat`: New customer-facing or admin feature
- `fix`: Bug fix
- `sec`: Security fix or credential protection
- `refactor`: Code restructuring without behavioral change
- `perf`: Performance enhancement
- `docs`: Documentation update

## Change Scope & Safety
- Keep commits focused and atomic.
- Do not stage or commit untracked debug artifacts, temporary dump files, or system cache files.
- Always review `git status` and `git diff` before committing or pushing changes.
