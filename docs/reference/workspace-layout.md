# Workspace layout

- `/apps/server`: Node.js WebSocket server. Coordinates assistant sessions, provider runtimes, memory/context flows, connected-platform data, and ordered WebSocket pushes.
- `/apps/web`: React + Vite UI. Conversation, assistant state, provider selection, and user-facing workflow rendering. Connects to the server via WebSocket.
- `/apps/desktop`: Electron shell. Spawns a desktop-scoped `kairo` backend process and loads the shared web app.
- `/packages/contracts`: Shared effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types.
- `/packages/shared`: Shared runtime utilities consumed by both server and web. Uses explicit subpath exports (e.g. `@kairo/shared/git`, `@kairo/shared/DrainableWorker`) — no barrel index.
