# AI Toolbox Plugin Schema

Plugins are portable, declarative JSON documents. Repository-owned templates live in `plugins/`; imported plugins are stored under Electron's `userData/plugins` directory.

## Minimal Plugin

```json
{
  "schemaVersion": 2,
  "compatibleAppVersion": ">=2.0.0",
  "id": "readme-generator",
  "name": "README Generator",
  "icon": "📘",
  "description": "Draft or improve README sections for developer-facing repositories.",
  "author": "AI Toolbox",
  "version": "1.0.0",
  "category": "coding",
  "permissions": ["ai:chat", "chat:context", "file:write"],
  "permissionReasons": {
    "ai:chat": "Required to generate README content.",
    "chat:context": "Allows the user to send the result into chat.",
    "file:write": "Allows proposed README changes to enter the ChangeSet approval flow."
  },
  "outputType": "markdown",
  "systemPrompt": "You write trustworthy open source README files...",
  "fields": [
    {
      "id": "project",
      "label": "Project context",
      "type": "textarea",
      "rows": 8,
      "required": true
    }
  ],
  "tags": ["readme", "docs"],
  "createdAt": "2026-05-15T00:00:00.000Z",
  "updatedAt": "2026-05-15T00:00:00.000Z"
}
```

## Required Fields

- `id`: Stable kebab-case identifier. Used as the file name in `plugins/{id}.json`.
- `name`: Display name.
- `version`: Semantic version for plugin changes.
- `systemPrompt`: The instruction sent as the AI system message.
- `fields`: Input fields rendered by the plugin runner.
- `schemaVersion`: Must be `2`. Version 1 documents are migrated on import.
- `compatibleAppVersion`: Semver range for compatible AI Toolbox releases.
- `permissionReasons`: User-facing reason for every declared permission.
- `outputType`: `markdown`, `json`, or `changeset`.

## Field Types

Supported `fields[].type` values:

- `text`
- `textarea`
- `select`
- `number`
- `toggle`
- `file`

For `select`, provide:

```json
"options": [
  { "label": "Markdown", "value": "markdown" }
]
```

## Permissions

Permissions are reviewed at import and enforced by the runtime.

- `ai:chat`: Calls the configured AI model.
- `chat:context`: May add results into the active chat context.
- `file:read`: May ask the file-action flow to read files.
- `file:write`: May ask the file-action flow to write, edit, save, or delete files.
- `rag:query`: May use project knowledge context.

File-writing still requires the diff preview approval flow.

Plugins without `ai:chat` cannot invoke a provider. Results cannot enter chat without `chat:context`, and file actions are removed unless the plugin declares `file:read` or `file:write` as appropriate. Imported prompts are checked for instruction overrides, credential requests, and destructive directory language.

## File Actions From Plugin Output

Plugins can return a fenced `file-action` block. The runner detects it and sends it through the same diff preview approval panel used by chat.

````markdown
```file-action
{
  "action": "write",
  "path": "docs/example.md",
  "content": "# Example\n"
}
```
````

## Import And Export

- Import: paste JSON or choose a `.json` file from the Plugin Center.
- Export: copies JSON to the clipboard and lets you save it as a `.json` file.
- Runtime storage: Electron writes imported plugins to `userData/plugins/{id}.json`.
- Plugin JavaScript and executable post-processors are not supported.
