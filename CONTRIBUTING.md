# Contributing to AI Toolbox

Thank you for helping make AI Toolbox a credible local-first developer agent.

## Setup

```bash
git clone https://github.com/isyakim/AI-TOOLBOX.git
cd AI-TOOLBOX
npm ci
npm run dev
```

Use Node.js 20 or newer. Commit `package-lock.json` whenever dependencies change.

## Product Rules

- Keep changes aligned with chat, project knowledge, plugins, settings, or reviewed file actions.
- Do not add arbitrary JavaScript execution to plugins.
- Do not expose raw Node or Electron APIs to the renderer.
- File operations must remain workspace-scoped and require diff preview for mutations.
- Prefer explicit types and shared IPC contracts over renderer-specific declarations.
- Split features before a page, component, or store becomes a mixed-responsibility module.

## Verification

Run before opening a pull request:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

`npm run lint` and `npm run format:check` never rewrite files. Use the corresponding `:fix` or `format` commands intentionally.

## Pull Requests

- Use Conventional Commits.
- Explain user-visible behavior and security implications.
- Add tests for bug fixes and IPC or filesystem changes.
- Keep unrelated refactors out of feature pull requests.
- Update public documentation when an interface or workflow changes.

Issues and discussions belong at <https://github.com/isyakim/AI-TOOLBOX>.
