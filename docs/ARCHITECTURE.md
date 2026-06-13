# Architecture

AI Toolbox uses a three-process trust model.

## Main Process

The Electron main process owns provider requests, filesystem access, plugin persistence, credential encryption, project indexing, updates, and native dialogs. Renderer input is treated as untrusted and validated at IPC boundaries.

File actions require an active workspace selected through a native directory dialog. Absolute paths, traversal, and symlink escapes are rejected.

## Preload Contract

`src/shared/types/ipc.ts` is the single public contract for `window.api`. The preload exposes only named operations through `contextBridge`; Node integration is disabled and the renderer sandbox is enabled.

## Renderer

Vue pages compose stores and components. AI output is rendered through the shared safe Markdown renderer, and file mutations pass through the same preview and approval flow whether they originate from chat or a plugin.

## Persistence

- Public provider configuration: JSON under `userData`, without API keys.
- Provider credentials: a separate encrypted file protected by Electron `safeStorage`.
- User plugins: JSON files under `userData/plugins`.
- Official plugin templates: repository `plugins/` directory.
- Project vectors, maps, and index manifests: `userData/vector_db`, `userData/project-maps.json`, and `userData/project-index-manifest.json`.
- Conversations: an atomically replaced versioned snapshot under `userData`; legacy renderer storage is read once and migrated.
- Lightweight UI preferences: application configuration under `userData`.

## RAG Indexing

Each project receives a stable ID derived from its real path. The manifest records file hashes, index version, and embedding model. Unchanged files are skipped; changed and deleted files are synchronized with LanceDB.

Scanning follows root `.gitignore` rules and user exclusions, and rejects symlink escapes, binary files, oversized files, and sensitive filenames. TypeScript, JavaScript, and TSX use Tree-sitter WASM; Vue single-file components are split with `@vue/compiler-sfc` before analysis. Unsupported or malformed files fall back to line-aware text chunks.

Every vector and query carries a required project ID. Citations include the project, relative and absolute paths, line range, symbol, language, score, and index timestamp. The derived Project Map stores entry files, symbols, import and test relations, large files, and coupling hotspots.

## Provider Requests

The renderer starts a chat request using a provider configuration ID. The main process resolves credentials, performs the request, and emits typed token, completion, or error events associated with a request ID. Ollama uses the same OpenAI-compatible chat and embedding path without requiring an API key.

## Controlled Agent Execution

Agent tasks and execution records are persisted under `userData/agent-execution.json`. A task must move through plan approval before it can propose a ChangeSet. Each proposed file records the content hash observed during preview; execution stops if any file changed, and remaining actions are reported as skipped.

The main-process boundary is split into a persistence repository, ChangeSet service, verification service, and thin IPC handlers. The renderer follows the same shape: the Agent page only composes focused workflow panels and a feature composable.

Writes use a temporary file in the target directory followed by an atomic rename. Deletes only accept regular files. Verification commands are derived from the active workspace's `package.json`; only script names containing `lint`, `typecheck`, `test`, or `build` are exposed, each command requires separate approval, and execution is capped at 120 seconds.

Plugin permissions are runtime capabilities rather than labels. Provider access requires `ai:chat`, chat insertion requires `chat:context`, and file actions require `file:read` or `file:write`. Imported schema v1 plugins are normalized to schema v2 and inspected for dangerous prompt patterns.
