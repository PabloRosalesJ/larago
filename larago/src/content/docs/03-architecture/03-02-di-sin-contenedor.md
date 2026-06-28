---
title: "DI sin contenedor mágico"
description: "Inyeccion de dependencias manual en Go sin contenedor magico ni reflexion"
order: 2
section: "03-architecture"
laravel_url: "https://laravel.com/docs/13.x/container"
go_packages: []
---

# DI sin contenedor mágico

**TL;DR** — Laravel resuelve dependencias automáticamente con su contenedor y reflexión. En Go pasas las dependencias a mano en el `main()`. No hay magia, no hay singletons, no hay `app()->make()`.

---

## En Laravel

```php
// Laravel: el contenedor resuelve las dependencias automáticamente
class UserController extends Controller
{
    public function __construct(
        private UserService $users,  // Laravel inyecta esto automáticamente
    ) {}

    public function index()
    {
        return $this->users->list();
    }
}

// Service Provider registra bindings
$this->app->bind(UserService::class, function ($app) {
    return new UserService($app->make(UserRepository::class));
});
```

En Laravel, nunca llamas `new UserController(...)`. El contenedor lo hace por ti.

## En Go

En Go, construyes el grafo de dependencias en el `main()` y pasas todo explícitamente:

```go
package main

import (
    "database/sql"
    "log"
    "net/http"
)

// main es TU contenedor de dependencias
func main() {
    // 1. Abrir conexión a DB
    db, err := sql.Open("postgres", "postgres://...")
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    // 2. Construir dependencias (wire up)
    userRepo := &UserRepository{db: db}
    userSvc := &UserService{repo: userRepo}
    userHandler := &UserHandler{svc: userSvc}

    // 3. Registrar rutas
    mux := http.NewServeMux()
    mux.HandleFunc("GET /users", userHandler.List)

    // 4. Iniciar servidor
    log.Fatal(http.ListenAndServe(":8080", mux))
}

// Sin reflexión, sin magia, sin contenedor
type UserService struct {
    repo *UserRepository
}

func (s *UserService) List() ([]User, error) {
    return s.repo.FindAll()
}

type UserHandler struct {
    svc *UserService
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
    users, err := h.svc.List()
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    // render users...
}
```

### Patrón: Constructor explícito

```go
// Cada struct recibe sus dependencias en el constructor
type UserHandler struct {
    svc     *UserService
    logger  *log.Logger
    timeout time.Duration
}

// NewUserHandler es el constructor explícito (como inyectar en Laravel)
func NewUserHandler(svc *UserService, logger *log.Logger, timeout time.Duration) *UserHandler {
    return &UserHandler{
        svc:     svc,
        logger:  logger,
        timeout: timeout,
    }
}
```

### Wire (inyección semiautomática)

Si el grafo de dependencias se vuelve grande, usa `wire` de Google:

```go
// wire.go
//+build wireinject

func InitializeUserHandler(db *sql.DB) *UserHandler {
    wire.Build(
        NewUserRepository,
        NewUserService,
        NewUserHandler,
    )
    return nil
}
```

```bash
go install github.com/google/wire/cmd/wire@latest
wire
# Genera el código de inicialización automáticamente
```

## Comparativa: DI

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Resolución** | Automática (reflexión) | Manual (en main()) |
| **Binding** | `$app->bind(Contract, Implementation)` | Asignación directa: `svc := &Service{repo: repo}` |
| **Singleton** | `$app->singleton()` | Variable global (evitar) o pasas la misma instancia |
| **Autowiring** | Sí, por type hints | No existe (usa wire si lo necesitas) |
| **Contenedor** | Centralizado | Distribuido en main() |
| **Test** | `$this->app->instance(Class, $mock)` | Pasas mock directamente: `NewHandler(mockService)` |
| **Curva** | Baja (automático) | Media (explícito) |

## Errores comunes

1. **Buscar un contenedor DI** — Go no lo necesita. El `main()` es tu contenedor. Si crece mucho, refactoriza en funciones `initDependencies()`.
2. **Usar variables globales para dependencias** — Si haces `var db *sql.DB` global, estás replicando el singleton de Laravel. Pásalo explícitamente.
3. **No usar interfaces para testear** — En Go, defines interfaces pequeñas donde las necesitas, no donde las implementas.

```go
// Define la interfaz donde la USAS, no donde la implementas
type UserRepository interface {
    FindByID(id int) (*User, error)
}

// El handler usa la interfaz, no la implementación concreta
type UserHandler struct {
    repo UserRepository  // <- intercambiable para tests
}
```

## Buenas prácticas

- Construye todo en `main()` o en funciones de inicialización explícitas.
- Usa interfaces para las dependencias que necesites mockear en tests.
- No crees un "contenedor DI" genérico. Go no está diseñado para eso.
- Si el grafo es muy grande, considera wire o divide en paquetes más pequeños.

## Ejercicio sugerido

> Crea un handler que dependa de un `Greeter` (interfaz con método `Greet(name string) string`). Implementa `EnglishGreeter` y `SpanishGreeter`. En main(), inyecta uno u otro según una variable de entorno. Observa que no usaste ningún contenedor.

## Siguientes pasos

- [Bootstrapping explícito](/architecture/bootstrapping-explicito/)
