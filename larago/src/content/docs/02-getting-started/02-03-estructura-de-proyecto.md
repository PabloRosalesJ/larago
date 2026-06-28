---
title: "Estructura de proyecto"
description: "Organiza tu proyecto Go siguiendo los estandares de la comunidad, sin la rigidez de Laravel"
order: 3
section: "02-getting-started"
laravel_url: "https://laravel.com/docs/13.x/structure"
go_packages: []
---

# Estructura de proyecto

**TL;DR** — Laravel impone una estructura rígida (app/, config/, database/, routes/). Go no impone estructura, pero la comunidad ha adoptado convenciones que mantienen los proyectos organizados y escalables.

---

## En Laravel

```
my-app/
├── app/           # Controladores, Modelos, Providers
├── bootstrap/     # app.php, cache
├── config/        # Configuración
├── database/      # Migrations, seeds, factories
├── public/        # index.php (entry point)
├── resources/     # Views (Blade), assets
├── routes/        # web.php, api.php
├── storage/       # Logs, cache, sesiones
├── tests/         # Tests
└── vendor/        # Dependencias (Composer)
```

Laravel te dice *exactamente* dónde va cada cosa. Un controlador va en `app/Http/Controllers/`, un modelo en `app/Models/`.

## En Go

Go no dicta estructura. Pero la comunidad ha convergido en ciertos patrones. Aquí tienes el layout estándar para una aplicación web:

```
mi-app/
├── cmd/
│   └── server/
│       └── main.go        # Entry point de la aplicación
├── internal/
│   ├── handler/           # HTTP handlers (como controladores)
│   │   └── user.go
│   ├── service/           # Lógica de negocio
│   │   └── user.go
│   ├── repository/        # Acceso a datos (como models)
│   │   └── user.go
│   └── middleware/        # Middleware HTTP
│       └── auth.go
├── pkg/                   # Paquetes reutilizables (opcional)
│   └── validator/
│       └── validator.go
├── migrations/            # Archivos SQL (si usas migraciones manuales)
│   └── 001_create_users.sql
├── go.mod                 # Módulo (como composer.json)
├── go.sum                 # Checksum de dependencias (como composer.lock)
├── Makefile               # Tareas comunes (build, test, migrate)
└── README.md
```

### Explicación de cada directorio

- **`cmd/`**: Contiene los entry points de tu aplicación. Cada subdirectorio es un binario diferente (ej: `cmd/server`, `cmd/cli`). El archivo `main.go` aquí solo hace bootstrap.
- **`internal/`**: Código privado que no puede ser importado por otros módulos. Es la forma nativa de Go de decir "esto es privado".
- **`pkg/`**: Código que sí puede ser usado por otros proyectos. Úsalo solo cuando desarrolles librerías reutilizables.
- **`migrations/`**: Archivos SQL versionados. Alternativamente, usa una carpeta `db/migrations/`.

### Proyecto simple vs proyecto grande

**Proyecto simple** (api básica):

```
mi-app/
├── main.go                 # Todo en un archivo
├── handler.go
├── store.go
├── go.mod
└── go.sum
```

**Proyecto mediano** (varios dominios):

```
mi-app/
├── cmd/server/main.go
├── internal/
│   ├── handler/
│   ├── service/
│   └── repository/
├── go.mod
└── Makefile
```

**Proyecto grande** (múltiples equipos):

```
mi-app/
├── cmd/
│   ├── server/main.go
│   └── worker/main.go
├── internal/
│   ├── users/              # Todo lo de usuarios (handler, service, repo)
│   ├── orders/
│   └── billing/
├── pkg/
│   ├── httputil/
│   └── db/
├── migrations/
├── deployments/
└── docs/
```

## Comparativa: Estructura

| Concepto Laravel | Equivalente Go |
|------------------|----------------|
| `app/Http/Controllers/` | `internal/handler/` |
| `app/Models/` | `internal/repository/` (o `internal/user/model.go`) |
| `app/Providers/` | `cmd/server/main.go` (bootstrapping explícito) |
| `config/` | Struct `Config` en `cmd/server/main.go` |
| `database/migrations/` | `migrations/` |
| `routes/web.php` | Registro de rutas en `cmd/server/main.go` |
| `resources/views/` | `internal/template/` (parciales HTML) |
| `tests/` | `*_test.go` al lado del código que prueban |
| `vendor/` | `go.sum` (no hay vendor por defecto) |
| `public/index.php` | `cmd/server/main.go` (entry point) |

## Errores comunes

1. **Replicar la estructura MVC de Laravel** — En Go, la organización por dominio (carpeta `users/` con handler+service+repo) es más común que por capa técnica (carpeta `controllers/`).
2. **Poner todo en `src/`** — En Go no se usa carpeta `src/`. El módulo raíz ya es la fuente.
3. **Mezclar `internal/` y `pkg/`** — `internal/` no puede ser importado externamente. `pkg/` sí. Úsalos correctamente.
4. **No usar `internal/`** — Es la forma más simple de mantener privado el código que no quieres exponer.

## Buenas prácticas

- Empieza simple: un solo paquete al inicio, luego separa cuando crezca.
- Organiza por dominio, no por capa técnica. Es más fácil de navegar.
- Usa `internal/` para proteger código que no debe ser importado.
- El `main.go` debe ser pequeño: solo lee config, construye dependencias, inicia el servidor.
- No tengas miedo de tener varios `main.go` (uno para el servidor, otro para workers CLI).

## Ejercicio sugerido

> Crea un proyecto con estructura `cmd/server/main.go`, `internal/handler/hello.go` y `internal/service/greeting.go`. El handler debe llamar al service y responder "Hola, mundo". El `main.go` solo debe iniciar el servidor y conectar las piezas.

## Siguientes pasos

- [Build + deploy](/getting-started/build-y-deploy/)
