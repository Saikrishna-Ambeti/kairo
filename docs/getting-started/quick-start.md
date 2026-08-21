# Quick start

Kairo runs as a local assistant app during development. The current build still exposes some coding-agent setup because the product is moving from a developer workbench toward a broader assistant for everyday work.

Install and authenticate at least one supported AI provider before starting Kairo. The app can then keep conversation context, use persistent memory where available, and work with connected platform data as those integrations are enabled.

```bash
# Development (with hot reload)
vp run dev

# Desktop development
vp run dev:desktop

# Desktop development on an isolated port set
KAIRO_DEV_INSTANCE=feature-xyz vp run dev:desktop

# Production
vp run build
vp run start

# Build a shareable macOS .dmg (arm64 by default)
vp run dist:desktop:dmg

# Or from any project directory after publishing:
npx kairo
```
