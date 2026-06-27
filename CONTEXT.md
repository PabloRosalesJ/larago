# CONTEXT.md — Contexto del proyecto LaraGo

> Fecha de capture: 2026-06-27
> Fuente: https://laravel.com/docs/13.x

## Índice original de Laravel 13.x (extraído del JSON embebido)

### Prologue
- Release Notes (/docs/13.x/releases)
- Upgrade Guide (/docs/13.x/upgrade)
- Contribution Guide (/docs/13.x/contributions)

### Getting Started
- Installation (/docs/13.x/installation)
- Configuration (/docs/13.x/configuration)
- Agentic Development (/docs/13.x/ai)
- Directory Structure (/docs/13.x/structure)
- Frontend (/docs/13.x/frontend)
- Starter Kits (/docs/13.x/starter-kits)
- Deployment (/docs/13.x/deployment)

### Architecture Concepts
- Request Lifecycle (/docs/13.x/lifecycle)
- Service Container (/docs/13.x/container)
- Service Providers (/docs/13.x/providers)
- Facades (/docs/13.x/facades)

### The Basics
- Routing (/docs/13.x/routing)
- Middleware (/docs/13.x/middleware)
- CSRF Protection (/docs/13.x/csrf)
- Controllers (/docs/13.x/controllers)
- Requests (/docs/13.x/requests)
- Responses (/docs/13.x/responses)
- Views (/docs/13.x/views)
- Blade Templates (/docs/13.x/blade)
- Asset Bundling (/docs/13.x/vite)
- URL Generation (/docs/13.x/urls)
- Session (/docs/13.x/session)
- Validation (/docs/13.x/validation)
- Error Handling (/docs/13.x/errors)
- Logging (/docs/13.x/logging)

### Digging Deeper
- Artisan Console (/docs/13.x/artisan)
- Broadcasting (/docs/13.x/broadcasting)
- Cache (/docs/13.x/cache)
- Collections (/docs/13.x/collections)
- Concurrency (/docs/13.x/concurrency)
- Context (/docs/13.x/context)
- Contracts (/docs/13.x/contracts)
- Events (/docs/13.x/events)
- File Storage (/docs/13.x/filesystem)
- Helpers (/docs/13.x/helpers)
- HTTP Client (/docs/13.x/http-client)
- Localization (/docs/13.x/localization)
- Mail (/docs/13.x/mail)
- Notifications (/docs/13.x/notifications)
- Package Development (/docs/13.x/packages)
- Processes (/docs/13.x/processes)
- Queues (/docs/13.x/queues)
- Rate Limiting (/docs/13.x/rate-limiting)
- Search (/docs/13.x/search)
- Strings (/docs/13.x/strings)
- Task Scheduling (/docs/13.x/scheduling)

### Security
- Authentication (/docs/13.x/authentication)
- Authorization (/docs/13.x/authorization)
- Email Verification (/docs/13.x/verification)
- Encryption (/docs/13.x/encryption)
- Hashing (/docs/13.x/hashing)
- Password Reset (/docs/13.x/passwords)

### Database
- Getting Started (/docs/13.x/database)
- Query Builder (/docs/13.x/queries)
- Pagination (/docs/13.x/pagination)
- Migrations (/docs/13.x/migrations)
- Seeding (/docs/13.x/seeding)
- Redis (/docs/13.x/redis)
- MongoDB (/docs/13.x/mongodb)

### Eloquent ORM
- Getting Started (/docs/13.x/eloquent)
- Relationships (/docs/13.x/eloquent-relationships)
- Collections (/docs/13.x/eloquent-collections)
- Mutators / Casts (/docs/13.x/eloquent-mutators)
- API Resources (/docs/13.x/eloquent-resources)
- Serialization (/docs/13.x/eloquent-serialization)
- Factories (/docs/13.x/eloquent-factories)

### AI
- AI SDK (/docs/13.x/ai-sdk)
- MCP (/docs/13.x/mcp)
- Boost (/docs/13.x/boost)

### Testing
- Getting Started (/docs/13.x/testing)
- HTTP Tests (/docs/13.x/http-tests)
- Console Tests (/docs/13.x/console-tests)
- Browser Tests (/docs/13.x/dusk)
- Database (/docs/13.x/database-testing)
- Mocking (/docs/13.x/mocking)

### Packages
- Cashier (Stripe) (/docs/13.x/billing)
- Cashier (Paddle) (/docs/13.x/cashier-paddle)
- Dusk (/docs/13.x/dusk)
- Envoy (/docs/13.x/envoy)
- Fortify (/docs/13.x/fortify)
- Folio (/docs/13.x/folio)
- Homestead (/docs/13.x/homestead)
- Horizon (/docs/13.x/horizon)
- Mix (/docs/13.x/mix)
- Octane (/docs/13.x/octane)
- Passport (/docs/13.x/passport)
- Pennant (/docs/13.x/pennant)
- Pint (/docs/13.x/pint)
- Precognition (/docs/13.x/precognition)
- Prompts (/docs/13.x/prompts)
- Pulse (/docs/13.x/pulse)
- Reverb (/docs/13.x/reverb)
- Sail (/docs/13.x/sail)
- Sanctum (/docs/13.x/sanctum)
- Scout (/docs/13.x/scout)
- Socialite (/docs/13.x/socialite)
- Telescope (/docs/13.x/telescope)
- Valet (/docs/13.x/valet)

## Decisiones de diseño

### Mapping 1:1
Cada página de Laravel que tenga equivalente en Go stdlib tiene su contraparte en LaraGo.
Las páginas sin equivalente directo (Blade, Vite, Eloquent ORM, etc.) se agrupan en una sola página
de contexto: "Lo que Laravel tiene y Go no necesita".

### Secciones extra
- **GORM** (sección 07): equivalente a Eloquent ORM, guía completa
- **sqlc** (sección 08): alternativa a Query Builder con generación de código
- **Comparativa** (sección 09): tabla de referencia Eloquent ↔ GORM ↔ sqlc

### Páginas de Laravel omitidas como páginas individuales
Las siguientes páginas de Laravel NO tienen página individual en LaraGo,
sino que se cubren en la página 12.1 "Lo que Laravel tiene y Go no necesita":
- Blade Templates
- Asset Bundling (Vite)
- URL Generation
- Artisan Console
- Broadcasting
- Collections
- Concurrency (parcialmente cubierto en Events)
- Context
- Contracts
- Helpers
- Localization
- Package Development
- Processes
- Rate Limiting
- Search
- Strings
- Redis
- MongoDB
- Eloquent ORM completo (sustituido por GORM)
- AI completo (AI SDK, MCP, Boost)
- Console Tests, Browser Tests
- Todos los packages (Cashier, Dusk, etc.)

### Convenciones de nomenclatura de archivos
- Números de dos dígitos para orden: `01-prologue`, `02-getting-started`, etc.
- Archivos: `01-01-filosofia-de-go-vs-laravel.md`
- Slugs: kebab-case, derivados del título

### Formato de las páginas
Cada página incluye:
1. Frontmatter YAML (title, description, order, section, laravel url)
2. TL;DR inicial
3. "En Laravel" — contexto
4. "En Go" — implementación
5. Código funcional
6. Tabla comparativa Laravel ↔ Go
7. Errores comunes
8. Ejercicio sugerido
