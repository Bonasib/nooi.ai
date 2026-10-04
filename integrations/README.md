# nooi.ai integrations · التكاملات

## MCP — Claude · ChatGPT · Qwen · Cursor
Endpoint: `https://YOUR_DOMAIN/mcp` (Streamable HTTP, JSON). Create a token in the app → Integrations.
- **Claude** (web/desktop/mobile): Settings → Connectors → Add custom connector → `https://YOUR_DOMAIN/mcp?token=nooi_…`
- **ChatGPT** (plans with developer mode / custom connectors): add a connector with the same URL.
- **Qwen Code / Qwen-Agent** (`settings.json`):
```json
{ "mcpServers": { "nooi": { "httpUrl": "https://YOUR_DOMAIN/mcp", "headers": { "Authorization": "Bearer nooi_…" } } } }
```
- **Claude Desktop / Cursor / any JSON-config client**:
```json
{ "mcpServers": { "nooi": { "command": "npx", "args": ["-y", "mcp-remote", "https://YOUR_DOMAIN/mcp", "--header", "Authorization: Bearer nooi_…"] } } }
```
Tools: `nooi_generate_video`, `nooi_generate_image`, `nooi_storyboard`, `nooi_job_status`, `nooi_list_assets`, `nooi_schedule_post`, `nooi_credits`.
Client menus change between versions — if a menu name differs, look for "custom connector" / "MCP server".

## Blender — `blender/nooi_blender.py`
Edit → Preferences → Add-ons → Install → pick the file → set Server + token. Sidebar (N) → **nooi**: refresh, import (GLB/OBJ/FBX/PLY), send selection back to your library.

## Unity — `unity/NooiWindow.cs`
Copy to `Assets/Editor/`. Install **glTFast** (`com.unity.cloud.gltfast`) for GLB. Menu: Window → nooi.ai.
