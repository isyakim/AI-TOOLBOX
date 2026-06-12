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
- Project vectors and index manifest: `userData/vector_db` and `userData/rag-index-manifest.json`.
- Conversations and lightweight UI state: renderer storage pending a future repository abstraction.

## RAG Indexing

Each project receives a stable ID derived from its real path. The manifest records file hashes, index version, and embedding model. Unchanged files are skipped; changed and deleted files are synchronized with LanceDB.

## Provider Requests

The renderer starts a chat request using a provider configuration ID. The main process resolves credentials, performs the request, and emits typed token, completion, or error events associated with a request ID. Ollama uses the same OpenAI-compatible chat and embedding path without requiring an API key.
