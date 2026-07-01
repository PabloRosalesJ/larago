---
title: "Handlers y organización"
description: "Organiza tus handlers HTTP en Go usando structs en lugar de controladores con herencia"
order: 4
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/controllers"
go_packages: ["net/http", "encoding/json", "fmt"]
---

# Handlers y organización

**TL;DR** — En Laravel los controladores son clases que extienden `Controller`. En Go son funciones o métodos de struct. No hay herencia, solo composición.

---

## En Laravel

```php
// Laravel: controlador como clase con herencia
class UserController extends Controller
{
    public function index()
    {
        return User::all();
    }

    public function show($id)
    {
        return User::findOrFail($id);
    }
}
```

## En Go

En Go, un handler es cualquier cosa que implemente `http.Handler`:

```go
type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}
```

### Función simple

```go
// Handler como función (para casos simples)
func healthCheck(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"ok"}`))
}

// Registro
mux.HandleFunc("GET /health", healthCheck)
```

### Struct como handler

```go
// Handler como struct con dependencias
type UserHandler struct {
    svc  *UserService
    logger *log.Logger
}

// Constructor
func NewUserHandler(svc *UserService, logger *log.Logger) *UserHandler {
    return &UserHandler{svc: svc, logger: logger}
}

// Métodos que manejan rutas específicas
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
    users, err := h.svc.ListUsers()
    if err != nil {
        h.logger.Error("error listing users", "err", err)
        http.Error(w, "Internal error", 500)
        return
    }
    writeJSON(w, users)
}

func (h *UserHandler) Show(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")
    user, err := h.svc.GetUser(id)
    if err != nil {
        http.Error(w, "User not found", 404)
        return
    }
    writeJSON(w, user)
}

// Helper: escribir JSON
func writeJSON(w http.ResponseWriter, data any) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(data)
}
```

### Registro de rutas en handler

```go
// El handler puede registrar sus propias rutas
func (h *UserHandler) RegisterRoutes(mux *http.ServeMux) {
    mux.HandleFunc("GET /users", h.List)
    mux.HandleFunc("POST /users", h.Create)
    mux.HandleFunc("GET /users/{id}", h.Show)
    mux.HandleFunc("PUT /users/{id}", h.Update)
    mux.HandleFunc("DELETE /users/{id}", h.Delete)
}
```

### Organización por paquete

```go
// internal/users/handler.go
package users

type Handler struct {
    svc *Service
}

func NewHandler(svc *Service) *Handler {
    return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
    mux.HandleFunc("GET /users", h.List)
    mux.HandleFunc("POST /users", h.Create)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) { /* ... */ }
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) { /* ... */ }
```

```go
// cmd/server/main.go
func main() {
    db := connectDB()
    userRepo := users.NewRepository(db)
    userSvc := users.NewService(userRepo)
    userHandler := users.NewHandler(userSvc)

    mux := http.NewServeMux()
    userHandler.RegisterRoutes(mux)

    log.Fatal(http.ListenAndServe(":8080", mux))
}
```

## Comparativa: Handlers

| Aspecto | Laravel (Controller) | Go (Handler) |
|---------|----------------------|--------------|
| **Naturaleza** | Clase que extiende Controller | Función o método de struct |
| **Dependencias** | Inyectadas por contenedor | Pasadas en constructor |
| **Respuesta** | `return response()->json(...)` | `json.NewEncoder(w).Encode(...)` |
| **Parámetros**| `$request`, `$id` como argumentos | `w http.ResponseWriter, r *http.Request` |
| **Auto-resource** | `Route::resource()` | No existe (registra cada ruta manual) |
| **Validación** | FormRequest | Manual en el handler |
| **Organización** | app/Http/Controllers/ | Por paquete (internal/users/handler.go) |

## Errores comunes

1. **Hacer handlers inline en el `main.go`** — Para prototipos está bien, pero en proyectos reales extrae los handlers a structs en paquetes separados.
2. **Crear una jerarquía de controladores** — Go no tiene herencia. No intentes crear un `BaseController` con métodos compartidos. Usa helpers o composición.
3. **Meter toda la lógica en el handler** — El handler solo debe parsear request, llamar al service, y escribir response. La lógica de negocio va en `service/`.
4. **No tipar las respuestas JSON** — Define structs para las respuestas, no uses `map[string]any`.

## Buenas prácticas

- Cada handler struct vive en su propio paquete (ej: `internal/users/`, `internal/orders/`).
- El handler solo se ocupa de HTTP. La lógica va en services.
- Usa un método `RegisterRoutes(mux)` en cada handler para mantener organizado el registro de rutas.
- Si un handler crece demasiado, divídelo (ej: `UserReadHandler`, `UserWriteHandler`).

## Ejercicio sugerido

> Crea un paquete `internal/products` con un `Handler` struct que tenga métodos `List`, `Show`, `Create`, `Update`, `Delete`. Implementa `RegisterRoutes`. Desde `main()`, construye las dependencias y registra las rutas.

## Siguientes pasos

- [Leyendo requests](/the-basics/leyendo-requests/)
