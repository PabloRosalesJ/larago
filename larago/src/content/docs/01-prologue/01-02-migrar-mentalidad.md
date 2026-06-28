---
title: "Migrar mentalidad: Framework → Biblioteca"
description: "Deja atras la mentalidad de framework y adopta el enfoque de biblioteca estandar de Go"
order: 2
section: "01-prologue"
laravel_url: "https://laravel.com/docs/13.x/upgrade"
go_packages: ["net/http", "fmt", "log"]
---

# Migrar mentalidad: Framework → Biblioteca

**TL;DR** — Pasar de Laravel a Go no es solo cambiar de lenguaje: tienes que dejar de pensar en términos de "instalar un paquete que resuelve todo" y empezar a pensar en términos de "construir con piezas pequeñas y componibles".

---

## En Laravel

Laravel es una *plataforma*. Cuando necesitas algo nuevo, buscas un paquete de Composer, un Service Provider, o un Facade. El framework orquesta todo por ti:

- ¿Necesitas caché? Instalas un driver Redis, configuras `.env`, usas `Cache::remember()`.
- ¿Necesitas colas? Configuras `QUEUE_CONNECTION=database`, usas `dispatch(new Job)`.
- ¿Necesitas auth? `php artisan make:auth` y todo listo.

Laravel te da un **contrato**: si sigues sus convenciones, el framework resuelve la integración. Tú solo te preocupas por la lógica de tu aplicación.

## En Go

Go es una *biblioteca*. No hay un "framework Go" que orqueste tu aplicación. La stdlib de Go te da piezas atómicas y tú las ensamblas:

```go
// No hay "instalar un paquete de caché" - construyes tu propia abstracción
type Cache interface {
    Get(key string) (any, bool)
    Set(key string, value any, ttl time.Duration)
}

// Implementación con la stdlib
type InMemoryCache struct {
    data sync.Map
}

func (c *InMemoryCache) Get(key string) (any, bool) {
    return c.data.Load(key)
}

func (c *InMemoryCache) Set(key string, value any, ttl time.Duration) {
    c.data.Store(key, value)
    time.AfterFunc(ttl, func() { c.data.Delete(key) })
}
```

Go no tiene un "contenedor de servicios". No hay una fachada `Cache::remember()` global. Pasas tus dependencias explícitamente:

```go
// Explícito: cada dependencia se pasa como parámetro
func NewUserHandler(users *UserService, cache Cache) *UserHandler {
    return &UserHandler{users: users, cache: cache}
}
```

### El cambio de mentalidad

| En Laravel piensas... | En Go piensas... |
|-----------------------|------------------|
| "¿Qué paquete resuelve esto?" | "¿Qué interfaz necesito definir?" |
| "¿Qué Service Provider lo registra?" | "¿Dónde construyo este valor y quién lo necesita?" |
| "¿Qué Facade lo expone?" | "¿Qué función/struct exporta esta funcionalidad?" |
| El framework inyecta dependencias | Tú pasas dependencias como argumentos |
| El framework orquesta el lifecycle | Tú controlas el flujo en `main()` |
| Convenciones ocultas (nombres de tablas, rutas automáticas) | Todo explícito (conexión DB, registro de rutas, handlers) |

## Comparativa: Migración de patrones

| Patrón Laravel | Patrón Go (stdlib) |
|----------------|-------------------|
| `php artisan make:controller` | Escribes un struct y sus métodos manualmente |
| `Route::resource()` | Registras rutas una por una con `mux.HandleFunc` |
| `User::find(1)` | `db.QueryRow("SELECT * FROM users WHERE id = $1", 1)` |
| `Cache::remember('key', fn)` | `cache.Get("key")` + `cache.Set("key", value)` |
| `Mail::to($user)->send($mailable)` | Construyes el email con `net/smtp`, llamas `SendMail` |
| `Event::dispatch(new UserRegistered($user))` | Envías un `UserRegistered` por un canal |
| `Queue::push(new Job)` | Lanzas una gorutina: `go processJob(job)` |
| `Log::info('mensaje')` | `slog.Info("mensaje")` |
| Provider bootstrapping | `init()` + funciones de setup en `main()` |

## Errores comunes

1. **Buscar un ORM como Eloquent** — `database/sql` no es tan cómodo, pero te da control total. Si necesitas un ORM, usa GORM (sección 07) con la conciencia de que sacrificas control.
2. **Querer un Artisan** — Go no necesita un CLI de framework. Usa `go run`, `go build`, `go test`. Para tareas de proyecto, scripts bash o `make`.
3. **Pensar que todo debe ser un paquete** — En Go, los paquetes son para organizar. No necesitas un paquete externo para cada cosa. Muchas veces la stdlib es suficiente.

## Buenas prácticas

- Empieza con solo stdlib. Agrega dependencias externas solo cuando la stdlib no pueda resolver el problema.
- Usa `database/sql` directamente antes de saltar a GORM o sqlc. Así entiendes qué resuelve cada herramienta.
- Abraza el boilerplate explícito. Cada línea que escribes es una línea que será fácil de depurar.

## Ejercicio sugerido

> Toma una funcionalidad simple de Laravel (ej: `Log::info('User registered')`) y replícala en Go usando `log/slog`. Luego intenta hacer lo mismo sin `slog`, usando solo `fmt.Printf` con timestamp manual. Nota cómo incluso la stdlib te da opciones crecientes de abstracción.

## Siguientes pasos

- [Cómo contribuir a Go std](/prologue/contribuir-a-go-std/)
- [Instalación y setup](/getting-started/instalacion-y-setup/)
