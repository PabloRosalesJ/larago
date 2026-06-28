---
title: "Bootstrapping explícito"
description: "Inicializa tu aplicacion Go con funciones init y composicion manual, sin Service Providers"
order: 3
section: "03-architecture"
laravel_url: "https://laravel.com/docs/13.x/providers"
go_packages: []
---

# Bootstrapping explícito

**TL;DR** — En Laravel los Service Providers registran servicios en el contenedor automáticamente. En Go tienes `init()` para registrar cosas (drivers, formatos, etc.) y el `main()` para construir explícitamente la aplicación.

---

## En Laravel

```php
// Laravel: Service Provider
class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, function ($app) {
            return new StripeGateway($app->make(Logger::class));
        });
    }

    public function boot(): void
    {
        RateLimiter::for('api', fn () => Limit::perMinute(60));
    }
}
```

Cada Provider se registra en `config/app.php` y Laravel los ejecuta en orden. No ves dónde ni cuándo se llaman.

## En Go

En Go tienes dos mecanismos:

1. **`init()`**: Se ejecuta automáticamente al importar un paquete. Ideal para registrar cosas globales (drivers de DB, formatos de tiempo, parsers).
2. **`main()` manual**: Construcción explícita de dependencias.

```go
// gob.go - init() para registrar cosas que deben existir globalmente
package gob

import "encoding/gob"

func init() {
    // Registrar tipos que necesitan ser serializados con encoding/gob
    gob.Register(User{})
    gob.Register(Order{})
}

type User struct {
    ID   int
    Name string
}
```

```go
// main.go - bootstrap explícito
package main

import (
    "database/sql"
    "log"
    "net/http"
    "os"
    "time"

    _ "github.com/lib/pq" // init() de postgres registra el driver
)

func main() {
    // Bootstrapping explícito, paso a paso
    cfg := loadConfig()
    db  := connectDB(cfg)
    mux := setupRouter(db)
    srv := startServer(cfg.Port, mux)
    waitForShutdown(srv)
}

func loadConfig() Config {
    return Config{
        Port: os.Getenv("PORT"),
        DB:   os.Getenv("DATABASE_URL"),
    }
}

func connectDB(cfg Config) *sql.DB {
    db, err := sql.Open("postgres", cfg.DB)
    if err != nil {
        log.Fatalf("Error conectando a DB: %v", err)
    }
    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(5 * time.Minute)
    return db
}

func setupRouter(db *sql.DB) *http.ServeMux {
    repo := &UserRepository{db: db}
    svc  := &UserService{repo: repo}
    h    := &UserHandler{svc: svc}

    mux := http.NewServeMux()
    mux.HandleFunc("GET /users", h.List)
    mux.HandleFunc("POST /users", h.Create)
    return mux
}

func startServer(port string, handler http.Handler) *http.Server {
    srv := &http.Server{Addr: ":" + port, Handler: handler}
    go func() {
        log.Printf("Servidor iniciado en puerto %s", port)
        if err := srv.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatal(err)
        }
    }()
    return srv
}
```

### Cuándo usar `init()` vs `main()`

| Situación | Usa |
|-----------|-----|
| Registrar driver de DB (postgres, mysql) | `init()` del driver |
| Registrar tipos en `gob` o `json` | `init()` |
| Inicializar variables de paquete | `init()` |
| Construir handlers | `main()` |
| Conectar DB, abrir archivos | `main()` |
| Registrar rutas | `main()` |

## Comparativa: Bootstrapping

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Entry point** | `public/index.php` (invisible al dev) | `main()` (tú lo escribes) |
| **Registro de servicios** | `ServiceProvider::register()` | Parámetros explícitos en `main()` |
| **Post-registro** | `ServiceProvider::boot()` | Inicialización manual post-construcción |
| **Orden** | Configurable en `config/app.php` | El orden que escribas en `main()` |
| **Diferido** | `defer: true` en Provider | Las dependencias se construyen cuando se necesitan |
| **Driver DB** | Provider de paquete | `init()` en el driver importado |
| **Visibilidad** | Oculta (framework decide cuándo ejecuta) | Total (tú ves cada paso) |

## Errores comunes

1. **Poner lógica de negocio en `init()`** — `init()` es para configuración, no para iniciar servicios. La conexión a BD, archivos, etc. van en `main()`.
2. **Depender del orden de `init()` entre paquetes** — Go ejecuta `init()` en orden de importación, pero no debes depender de esto para lógica crítica.
3. **Replicar Service Providers como structs separados** — En Go no necesitas una capa de Providers. Las funciones `connectDB()`, `setupRouter()` ya son tus "providers".

## Buenas prácticas

- Usa `init()` solo para registrar cosas que deben estar disponibles globalmente (drivers, formatos).
- Mantén el `main()` limpio: delega en funciones con nombres descriptivos (`setupDB`, `setupRouter`, `setupLogger`).
- Si un paquete necesita configuración, expón una función `NewXxx(cfg Config) (*Xxx, error)` en lugar de usar `init()`.
- No crees una capa de Service Providers. Go no lo necesita.

## Ejercicio sugerido

> Crea un paquete `database` con un `init()` que registre el driver de postgres. Crea otro paquete `app` con una función `NewApp(cfg) *App` que construya todo. En `main()`, llama solo dos funciones: `cfg := loadConfig()`, `app := app.NewApp(cfg)`.

## Siguientes pasos

- [Por qué Go no necesita fachadas](/architecture/por-que-go-no-necesita-fachadas/)
