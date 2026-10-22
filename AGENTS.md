# Repository guidance for Codex

This repository is for **Space Runner**, a lightweight browser-based 3D endless runner targeting desktop, mobile, and eventual Yandex Games publication.

## Stack and priorities
- Three.js, TypeScript (strict), Vite; HTML/CSS for UI.
- Prioritize responsive controls, a complete playable loop, clarity, and stable performance.
- Keep logic independent from the eventual Yandex SDK adapter.
- Do not add a backend, heavyweight framework, or full physics engine without an explicit reason.

## Work process
- Check the current Git status and inspect relevant code before changing it.
- Keep tasks small and follow `docs/CODEX_MASTER_PROMPT.md` and `docs/TASKS.md`.
- Favor executable progress over speculative documents; update docs only when facts change.
- Verify changes using available typecheck, tests, build, and browser inspection.
- Report command results truthfully and note anything that was not tested.
- Keep individual modules focused and settings centralized in config files.

## Assets and security
- Use licensed assets only; prefer official Kenney Space Kit CC0.
- Document source, author, and license for external assets in `docs/ASSETS.md`.
- Ask for approval when downloads/network access require it. Do not bypass sandbox restrictions or execute untrusted scripts.
- Never commit secrets, dependencies (`node_modules`), or production output (`dist`).
- Do not modify files outside this repo. Do not run destructive Git commands or push to remotes without permission.

## Delivery
- Preserve functional controls, game loop, health, scoring, pause/resume, and restart.
- Make tested, meaningful Git commits at milestones where allowed.
- Keep README setup/controls/build commands accurate.
