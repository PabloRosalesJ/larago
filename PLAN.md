# LaraGo — Plan del Proyecto

> De Laravel a Go con la stdlib. Documentación para devs PHP/Laravel que migran a Go.

## Stack

- **Contenido**: Markdown (frontmatter + body)
- **Build**: Astro + Content Collections
- **UI**: shadcn/ui (componentes React/Tailwind)
- **Despliegue**: Static Site Generation → GitHub Pages / Vercel
- **Idioma**: Español (mandatorio)

## Estructura del proyecto

```
/Users/incfile/Desktop/LaraGo/
├── PLAN.md                 ← Este archivo
├── CHECKLIST.md            ← Checklist granular para seguimiento
├── CONTEXT.md              ← Decisiones de diseño, capture de Laravel docs
├── CONTENT/                ← Markdown fuente
│   ├── template.md         ← Template de cada página
│   ├── 01-prologue/        ← Páginas del prólogo
│   ├── 02-getting-started/
│   ├── 03-architecture/
│   ├── 04-the-basics/
│   ├── 05-security/
│   ├── 06-database/
│   ├── 07-gorm/
│   ├── 08-sqlc/
│   ├── 09-comparativa/
│   ├── 10-digging-deeper/
│   ├── 11-testing/
│   └── 12-contexto-laravel/ ← "Lo que Laravel tiene y Go no necesita"
├── scraped/                ← Datos crudos del scrapping
└── larago/                 ← Proyecto Astro (generado en Fase 4)
    ├── src/
    │   ├── content/        ← MD copiados aquí para Content Collections
    │   ├── layouts/
    │   ├── components/     ← shadcn/ui
    │   └── pages/
    ├── astro.config.mjs
    └── package.json
```

## Índice completo LaraGo vs Laravel 13.x

### Prólogo
| # | Laravel | Go stdlib | LaraGo | Estado |
|---|---------|-----------|--------|--------|
| 1.1 | Release Notes | — | Filosofía de Go vs Laravel | ✏️ Pendiente |
| 1.2 | Upgrade Guide | — | Migrar mentalidad: Framework → Biblioteca | ✏️ Pendiente |
| 1.3 | Contribution Guide | — | Cómo contribuir a Go std | ✏️ Pendiente |

### Getting Started
| # | Laravel | Go stdlib | LaraGo | Estado |
|---|---------|-----------|--------|--------|
| 2.1 | Installation | go install, go mod init | Instalación y setup | ✏️ Pendiente |
| 2.2 | Configuration | os.Getenv, flag | Configuración sin .env mágico | ✏️ Pendiente |
| 2.3 | Directory Structure | Layout estándar Go | Estructura de proyecto | ✏️ Pendiente |
| 2.4 | Deployment | net/http, os/exec | Build + deploy | ✏️ Pendiente |

### Arquitectura
| # | Laravel | Go stdlib | LaraGo | Estado |
|---|---------|-----------|--------|--------|
| 3.1 | Request Lifecycle | net/http handler chain | Ciclo de vida de una request | ✏️ Pendiente |
| 3.2 | Service Container | Inyección manual | DI sin contenedor mágico | ✏️ Pendiente |
| 3.3 | Service Providers | init(), composición | Bootstrapping explícito | ✏️ Pendiente |
| 3.4 | Facades | — | Por qué Go no necesita fachadas | ✏️ Pendiente |

### The Basics
| # | Laravel | Go stdlib | LaraGo | Estado |
|---|---------|-----------|--------|--------|
| 4.1 | Routing | net/http.ServeMux (1.22+) | Routing con stdlib | ✏️ Pendiente |
| 4.2 | Middleware | http.Handler wrapper pattern | Middleware pattern | ✏️ Pendiente |
| 4.3 | CSRF Protection | crypto/rand + hash | CSRF desde cero | ✏️ Pendiente |
| 4.4 | Controllers | Handler functions / structs | Handlers y organización | ✏️ Pendiente |
| 4.5 | Requests | *http.Request | Leyendo requests | ✏️ Pendiente |
| 4.6 | Responses | http.ResponseWriter | Construyendo responses | ✏️ Pendiente |
| 4.7 | Views | html/template | Templates sin Blade | ✏️ Pendiente |
| 4.8 | Session | net/http cookie + crypto | Sessions con cookies | ✏️ Pendiente |
| 4.9 | Validation | Manual + validación | Validación sin Validator | ✏️ Pendiente |
| 4.10 | Error Handling | errors, log/slog | Errores como valores | ✏️ Pendiente |
| 4.11 | Logging | log/slog | Logging estructurado | ✏️ Pendiente |

### Seguridad
| # | Laravel | Go stdlib | LaraGo | Estado |
|---|---------|-----------|--------|--------|
| 5.1 | Authentication | crypto/rand, bcrypt | Auth desde cero | ✏️ Pendiente |
| 5.2 | Authorization | Middleware + RBAC manual | Autorización explícita | ✏️ Pendiente |
| 5.3 | Encryption | crypto/aes, crypto/cipher | Encriptación | ✏️ Pendiente |
| 5.4 | Hashing | golang.org/x/crypto/bcrypt | Hashing de contraseñas | ✏️ Pendiente |
| 5.5 | Password Reset | net/smtp + tokens | Reset passwords | ✏️ Pendiente |

### Database
| # | Laravel | Go stdlib | LaraGo | Estado |
|---|---------|-----------|--------|--------|
| 6.1 | Getting Started | database/sql | Conectando a DB | ✏️ Pendiente |
| 6.2 | Query Builder | database/sql | Queries con stdlib | ✏️ Pendiente |
| 6.3 | Pagination | database/sql + LIMIT/OFFSET | Paginación | ✏️ Pendiente |
| 6.4 | Migrations | embed + SQL files | Migraciones sin ORM | ✏️ Pendiente |
| 6.5 | Seeding | Manual Go + SQL | Seed data | ✏️ Pendiente |

### GORM (extra: como Eloquent)
| # | Título | Estado |
|---|--------|--------|
| 7.1 | Instalación y Setup | ✏️ Pendiente |
| 7.2 | Modelos (Definición) | ✏️ Pendiente |
| 7.3 | CRUD Básico | ✏️ Pendiente |
| 7.4 | Relaciones | ✏️ Pendiente |
| 7.5 | Hooks y Eventos del Ciclo de Vida | ✏️ Pendiente |
| 7.6 | Migraciones con GORM | ✏️ Pendiente |
| 7.7 | Consejos y Buenas Prácticas | ✏️ Pendiente |

### sqlc (extra: como Query Builder++)
| # | Título | Estado |
|---|--------|--------|
| 8.1 | Instalación y Setup | ✏️ Pendiente |
| 8.2 | Schema y Modelos | ✏️ Pendiente |
| 8.3 | Queries (SELECT) | ✏️ Pendiente |
| 8.4 | Mutaciones (INSERT, UPDATE, DELETE) | ✏️ Pendiente |
| 8.5 | Relaciones con sqlc | ✏️ Pendiente |
| 8.6 | Transacciones | ✏️ Pendiente |
| 8.7 | Integración Continua | ✏️ Pendiente |

### Comparativa GORM / sqlc / Eloquent
| # | Título | Estado |
|---|--------|--------|
| 9.1 | Tabla Eloquent → GORM → sqlc | ✏️ Pendiente |

### Digging Deeper
| # | Laravel | Go stdlib | LaraGo | Estado |
|---|---------|-----------|--------|--------|
| 10.1 | Cache | sync.Map, map+sync.RWMutex | Caching en memoria | ✏️ Pendiente |
| 10.2 | Events | Channels + sync | Eventos con goroutines | ✏️ Pendiente |
| 10.3 | File Storage | os, io, io/fs, embed | File system | ✏️ Pendiente |
| 10.4 | HTTP Client | net/http.Client | Cliente HTTP | ✏️ Pendiente |
| 10.5 | Mail | net/smtp | Envío de emails | ✏️ Pendiente |
| 10.6 | Notifications | Interfaces + channels | Notificaciones | ✏️ Pendiente |
| 10.7 | Queues | Goroutines + channels | Colas con canales | ✏️ Pendiente |
| 10.8 | Task Scheduling | time.Ticker, time.After | Cron/tareas | ✏️ Pendiente |

### Testing
| # | Laravel | Go stdlib | LaraGo | Estado |
|---|---------|-----------|--------|--------|
| 11.1 | Getting Started | testing package | Testing en Go | ✏️ Pendiente |
| 11.2 | HTTP Tests | net/http/httptest | Testing HTTP | ✏️ Pendiente |
| 11.3 | Database Testing | testing + database/sql | Testing con DB | ✏️ Pendiente |
| 11.4 | Mocking | Interfaces + testing | Mocks sin framework | ✏️ Pendiente |

### Contexto
| # | Título | Estado |
|---|--------|--------|
| 12.1 | Lo que Laravel tiene y Go no necesita | ✏️ Pendiente |

## Estructura de cada página MD

Cada archivo .md sigue este template (ver CONTENT/template.md):

```yaml
---
title: "Título en Español"
description: "Descripción corta para SEO"
order: 1
section: "01-prologue"
laravel: "https://laravel.com/docs/13.x/releases"
---

# Título

TL;DR — Una frase que conecta el concepto de Laravel con Go.

## En Laravel

Contexto: cómo funciona esto en Laravel (máximo 3 párrafos).

## En Go

Cómo se implementa con la stdlib de Go.

\`\`\`go
// Código de ejemplo completo y funcional
\`\`\`

## Comparativa

| Laravel | Go |
|---------|-----|
| ... | ... |

## Errores comunes

- Error 1: ...
- Error 2: ...

## Ejercicio sugerido

Breve ejercicio práctico para afianzar el concepto.
```

## Reglas de escritura

1. **Español impecable** — toda la prosa en español, código en inglés
2. **TL;DR obligatorio** — primera línea después del título, conecta con Laravel
3. **Código funcional** — ejemplos que se puedan copiar y pegar
4. **Comparativas explícitas** — tabla Laravel vs Go en cada página
5. **Sin rodeos** — directo al grano, como la doc de Laravel
6. **Bilingüe técnico** — términos como "middleware", "handler", "request" se mantienen en inglés

## Fases de ejecución

1. ✅ Crear archivos de contexto
2. ⏳ Scrapear estructura de cada página de Laravel
3. ⏳ Escribir contenido MD (por secciones)
4. ⏳ Montar proyecto Astro + shadcn/ui
5. ⏳ Build y verificación
