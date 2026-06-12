# Security Policy

## Supported Version

Security fixes target the current `main` branch and latest release.

## Reporting

Please report vulnerabilities privately through GitHub Security Advisories for `isyakim/AI-TOOLBOX`. Do not include credentials, private source code, or sensitive project data in public issues.

## Security Model

- Renderer code has no Node integration and runs with context isolation and sandboxing.
- IPC exposes a typed allowlist rather than generic `invoke` access.
- File actions are limited to the selected workspace and reject traversal, absolute paths, and symlink escapes.
- Mutating file actions require a diff preview and an expected file hash before execution.
- Multi-file changes are grouped into a `ChangeSet`; plan approval and change approval are separate steps.
- Writes use same-directory temporary files and atomic replacement. Stale previews are rejected instead of overwritten.
- Command execution is limited to individually approved `package.json` scripts whose names match lint, typecheck, test, or build. Arbitrary shell text is not accepted.
- Plugins are declarative JSON workflows. Arbitrary plugin JavaScript is not executed.
- Public provider settings are stored separately from credentials encrypted through Electron `safeStorage`.
- Chat, embedding, and provider connection requests run in the trusted main process. The renderer never receives stored credentials.
- External windows are denied; only `http` and `https` links may open in the system browser.

AI-generated file changes still require human review. Do not approve changes you have not inspected.
