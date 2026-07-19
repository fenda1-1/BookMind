# BookMind

BookMind is a local-first desktop workspace for reading, full-text search, annotations, character exploration, and AI-assisted knowledge work. It is built with Tauri, Rust, React, and TypeScript.

BookMind does not distribute books, indexes, or user data. Import only content that you are legally allowed to use.

## Privacy

Books, indexes, reading progress, annotations, and knowledge data stay local by default. Content is sent to an external service only when you explicitly configure and use a cloud AI or translation provider. API keys are stored locally and must never be committed to this repository.

## Development

Requirements: Node.js 22+, a stable Rust toolchain, and the platform dependencies required by Tauri.

```bash
cd apps/desktop
npm ci
npm run tauri:dev
```

Run verification:

```bash
cd apps/desktop
npm run build
npm test
cd src-tauri && cargo check --all-targets
```

Build the native bundle on the current platform:

```bash
cd apps/desktop
npm run tauri:build
```

Native artifacts are written to `apps/desktop/src-tauri/target/release/bundle/`. CI builds Windows, macOS, and Linux artifacts and publishes a `SHA256SUMS.txt` file with each build artifact.

## Contributing and Security

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution requirements and [SECURITY.md](../SECURITY.md) for private vulnerability reporting.

The project is available under the [Apache License 2.0](../LICENSE).
