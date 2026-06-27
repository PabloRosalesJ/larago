---
title: "Routing con stdlib"
description: "Enruta peticiones HTTP con el ServeMux de Go 1.22+, que soporta metodos y parametros de ruta nativamente"
order: 1
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/routing"
go_packages: ["net/http", "fmt", "log"]
---

# Routing con stdlib

**TL;DR** — Laravel usa `Route::get('/users', ...)` con su Router dedicado. Go 1.22+ tiene `http.ServeMux` con soporte nativo de métodos HTTP y parámetros de ruta. No necesitas gorilla/mux ni chi.

---

## En Laravel

```php
// Laravel: router declarativo con grupos y prefijos
Route::get('/users', [UserController::class, 'index']);
Route::post('/users', [UserController::class, 'store']);
Route::get('/users/{id}', [UserController::class, 'show']);

Route::prefix('admin')->middleware('auth')->group(function () {
    Route::resource('users', AdminUserController::class);
});
```

## En Go

Desde Go 1.22, `http.ServeMux` soporta:

```go
package main

import (
    "fmt"
    "log"
    "net/http"
)

func main() {
    mux := http.NewServeMux()

    // Rutas con método HTTP explícito (Go 1.22+)
    mux.HandleFunc("GET /users", listUsers)
    mux.HandleFunc("POST /users", createUser)
    mux.HandleFunc("GET /users/{id}", showUser)     // {id} es wildcard
    mux.HandleFunc("PUT /users/{id}", updateUser)
    mux.HandleFunc("DELETE /users/{id}", deleteUser)

    // Ruta raíz
    mux.HandleFunc("GET /{$}", home)

    // Subruta (todo /posts/ y /posts/{id})
    mux.HandleFunc("GET /posts/{id}", showPost)

    log.Fatal(http.ListenAndServe(":8080", mux))
}

func home(w http.ResponseWriter, r *http.Request) {
    fmt.Fprint(w, "Página principal")
}

func listUsers(w http.ResponseWriter, r *http.Request) {
    fmt.Fprint(w, "Lista de usuarios")
}

func showUser(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")  // Acceder al parámetro {id}
    fmt.Fprintf(w, "Usuario %s", id)
}
```

### Parámetros de ruta

```go
// /users/42 → id = "42"
// /users/juan → id = "juan"
mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")
    user, err := findUserByID(id)
    if err != nil {
        http.Error(w, "Usuario no encontrado", 404)
        return
    }
    fmt.Fprintf(w, "Usuario: %s", user.Name)
})
```

### Querystring

```go
// /users?role=admin&page=2
mux.HandleFunc("GET /users", func(w http.ResponseWriter, r *http.Request) {
    role := r.URL.Query().Get("role")   // "admin"
    page := r.URL.Query().Get("page")   // "2"
    // ...
})
```

### Rutas con prefijo (agrupación manual)

```go
// Como `Route::prefix('admin')->group(...)` pero explícito
func adminRoutes() http.Handler {
    admin := http.NewServeMux()
    admin.HandleFunc("GET /dashboard", adminDashboard)
    admin.HandleFunc("GET /users", adminUsers)
    return admin
}

// Luego en main():
mux.Handle("GET /admin/", http.StripPrefix("/admin", adminRoutes()))
```

## Comparativa: Routing

| Concepto | Laravel | Go (ServeMux 1.22+) |
|----------|---------|---------------------|
| **Ruta GET** | `Route::get('/users', ...)` | `mux.HandleFunc("GET /users", fn)` |
| **Parámetro** | `{id}` | `{id}` (r.PathValue("id")) |
| **Querystring** | `$request->query('page')` | `r.URL.Query().Get("page")` |
| **Grupos** | `Route::prefix('admin')->group(...)` | Submux + `http.StripPrefix` |
| **Middleware** | En el grupo | Wrapping del handler |
| **Named routes** | `route('users.show')` | No nativo (build tu propio map) |
| **Resource** | `Route::resource(...)` | No nativo (registra cada método) |
| **Rate limiting** | `RateLimiter::for(...)` | Middleware manual |

## Errores comunes

1. **Usar gorilla/mux o chi sin necesidad** — Desde Go 1.22, `http.ServeMux` es suficiente para el 90% de los casos. No agregues dependencias innecesarias.
2. **Olvidar el método HTTP** — Si omites el método (`mux.HandleFunc("/users", fn)`), el mux responde a TODOS los métodos. Siempre especifica GET, POST, etc.
3. **No usar `{$}` para la raíz** — `mux.HandleFunc("GET /", fn)` captura TODAS las rutas que empiezan con `/`. Usa `GET /{$}` para capturar solo `/`.

## Buenas prácticas

- Especifica siempre el método HTTP en las rutas.
- Agrupa rutas relacionadas en submux.
- Extrae los handlers a archivos separados o paquetes.
- Usa `r.PathValue("param")` en lugar de parsear la URL manualmente.

## Ejercicio sugerido

> Crea un mux con rutas para: `GET /products`, `POST /products`, `GET /products/{id}`, `GET /products/{id}/reviews`. Usa submux para agrupar las rutas de products.

## Siguientes pasos

- [Middleware pattern](/the-basics/middleware/)
