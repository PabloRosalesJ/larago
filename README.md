# LaraGo

> From Laravel to Go with the stdlib — Documentation for PHP/Laravel developers migrating to Go.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## About

LaraGo is a documentation site that maps Laravel 13.x concepts to Go's standard library. Each section compares side by side how the same problem is solved in both ecosystems, with working code, comparison tables, and hands-on exercises.

**Goal:** If you know Laravel, you should be productive in Go within a week.

## Sections

| Section | Topics |
|---------|--------|
| **Prologue** | Go vs Laravel philosophy, shifting your mindset |
| **Getting Started** | Installation, configuration, project structure, deployment |
| **Architecture** | Request lifecycle, DI, bootstrapping, why Go doesn't need facades |
| **The Basics** | Routing, middleware, CSRF, handlers, requests, responses, templates, sessions, validation, error handling, logging |
| **Security** | Auth, authorization, encryption, hashing, password reset |
| **Database** | Connection, queries, pagination, migrations, seeding |
| **GORM** | Eloquent-equivalent ORM: models, CRUD, relationships, hooks, migrations |
| **sqlc** | Type-safe code generation from pure SQL |
| **Comparison** | Eloquent ↔ GORM ↔ sqlc reference table |
| **Digging Deeper** | Caching, events, file system, HTTP client, email, notifications, queues, cron jobs |
| **Testing** | Unit tests, HTTP tests, database tests, mocks |
| **Context** | What Laravel has that Go doesn't need |

## Stack

- [Astro](https://astro.build) — Static site generation
- [React](https://react.dev) — Interactive UI
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [MDX](https://mdxjs.com) — Content with runnable code

## Prerequisites

- Node.js >= 22.12.0
- pnpm

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Production build
pnpm build

# Preview the build
pnpm preview
```

## Project Structure

```
larago/
├── src/
│   ├── content/docs/    ← Markdown files (content)
│   ├── components/      ← React components (shadcn/ui)
│   ├── layouts/         ← Astro layouts
│   ├── pages/           ← Routes
│   └── lib/             ← Utilities
├── public/              ← Static assets
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

## Content Format

Each Markdown page follows a standard format:

1. **Frontmatter** — title, description, section, order
2. **TL;DR** — quick connection to Laravel
3. **In Laravel** — concept context in PHP
4. **In Go** — stdlib implementation
5. **Code** — copy-pasteable working examples
6. **Comparison** — side-by-side table
7. **Common errors** — frequent pitfalls
8. **Exercise** — suggested practice

## Contributing

Contributions are welcome. Check `PLAN.md` and `CHECKLIST.md` to see the project status and what's left to write.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
