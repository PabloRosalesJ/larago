<h1 align="center">LaraGo</h1>

<p align="center">
  <strong>From Laravel to Go with the stdlib</strong><br>
  Documentation for PHP/Laravel developers migrating to Go.
</p>

<p align="center">
  <a href="https://pablorosalesj.github.io/larago/">
    <img src="https://img.shields.io/badge/📖_Read_the_docs-online-blue?style=for-the-badge" alt="Read the docs">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT">
  </a>
</p>

---

## About

LaraGo maps Laravel 13.x concepts to Go's standard library. Each section compares side by side how the same problem is solved in both ecosystems, with working code, comparison tables, and hands-on exercises.

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

## Contributing

Contributions are welcome. Check `PLAN.md` and `CHECKLIST.md` to see the project status and what's left to write.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
