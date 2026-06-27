---
title: "Autorización explícita"
description: "Implementa autorizacion y control de acceso en Go con middleware y roles, sin gates ni policies magicas"
order: 2
section: "05-security"
laravel_url: "https://laravel.com/docs/13.x/authorization"
go_packages: ["net/http", "context"]
---

# Autorización explícita

**TL;DR** — Laravel tiene Gates y Policies para autorización declarativa. En Go implementas autorización con middleware que verifica roles o permisos explícitamente.

---

## En Laravel

```php
// Laravel: Gates y Policies
Gate::define('update-post', fn ($user, $post) => $user->id === $post->user_id);

class PostPolicy {
    public function update(User $user, Post $post): bool {
        return $user->id === $post->user_id;
    }
}

// En el controller:
$this->authorize('update', $post);
```

## En Go

```go
package main

import (
    "context"
    "net/http"
)

// Definición de roles
const (
    RoleAdmin = "admin"
    RoleUser  = "user"
    RoleGuest = "guest"
)

// Middleware de autorización por rol
func RequireRole(roles ...string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            role := r.Context().Value("role").(string)
            for _, allowed := range roles {
                if role == allowed {
                    next.ServeHTTP(w, r)
                    return
                }
            }
            http.Error(w, "No autorizado", http.StatusForbidden)
        })
    }
}

// Middleware de autorización por permiso específico
func RequirePermission(permission string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            perms := r.Context().Value("permissions").([]string)
            for _, p := range perms {
                if p == permission {
                    next.ServeHTTP(w, r)
                    return
                }
            }
            http.Error(w, "No tienes permiso para esta acción", http.StatusForbidden)
        })
    }
}

// Uso en rutas
func main() {
    mux := http.NewServeMux()

    // Admin only
    mux.Handle("GET /admin/dashboard", RequireRole(RoleAdmin)(http.HandlerFunc(adminDashboard)))

    // Usuario autenticado (cualquier rol)
    mux.Handle("GET /profile", RequireRole(RoleUser, RoleAdmin)(http.HandlerFunc(profile)))

    // Verificación de ownership (como Policy de Laravel)
    mux.Handle("PUT /posts/{id}", ownershipCheck(http.HandlerFunc(updatePost)))
}
```

### Ownership check (Policy equivalente)

```go
func ownershipCheck(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        postID := r.PathValue("id")
        userID := r.Context().Value("user_id").(int)

        // Verificar que el post pertenece al usuario
        var ownerID int
        db.QueryRow("SELECT user_id FROM posts WHERE id = $1", postID).Scan(&ownerID)

        if userID != ownerID {
            http.Error(w, "No tienes permiso para modificar este recurso", 403)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

### RBAC con tabla de permisos

```go
// Permisos por rol
var rolePermissions = map[string][]string{
    "admin": {"posts.create", "posts.read", "posts.update", "posts.delete", "users.manage"},
    "editor": {"posts.create", "posts.read", "posts.update"},
    "user":   {"posts.read"},
}

// Middleware de permisos
func PermissionMiddleware(required string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            role := r.Context().Value("role").(string)
            perms, ok := rolePermissions[role]
            if !ok {
                http.Error(w, "Rol no válido", 403)
                return
            }

            for _, p := range perms {
                if p == required {
                    next.ServeHTTP(w, r)
                    return
                }
            }

            http.Error(w, "Permiso denegado", 403)
        })
    }
}

// Uso
mux.Handle("POST /posts", PermissionMiddleware("posts.create")(http.HandlerFunc(createPost)))
mux.Handle("DELETE /posts/{id}", PermissionMiddleware("posts.delete")(http.HandlerFunc(deletePost)))
```

## Comparativa: Autorización

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Mecanismo** | Gates, Policies | Middleware con roles/permisos |
| **Definición** | `$gate->define('action', fn)` | Mapa `role → []string` |
| **Verificación** | `$this->authorize('action', $model)` | `RequireRole("admin")`, `RequirePermission("post.delete")` |
| **Ownership** | Policy: `$user->id === $post->user_id` | Middleware: query a DB + comparación |
| **Registro** | En `AuthServiceProvider` | En `main()` al registrar rutas |
| **Roles** | Paquete externo (Spatie) | Manual o paquete externo |

## Errores comunes

1. **Autorización en el handler y no en middleware** — Separa la autorización en middleware para que sea reutilizable y testeable.
2. **No verificar ownership** — Solo verificar rol no es suficiente. Un usuario normal no debería poder modificar posts de otros usuarios.
3. **Hardcodear roles** — Al principio está bien tener roles fijos en código. Cuando crezca, pásalos a DB.
4. **Devolver 401 vs 403** — 401 es "no autenticado", 403 es "no autorizado". Úsalos correctamente.

## Buenas prácticas

- Separa autenticación (¿quién eres?) de autorización (¿qué puedes hacer?).
- Usa middleware específico para cada permiso.
- Si el sistema de roles es simple, usa un mapa en memoria. Si es complejo, usa una tabla de permisos en DB.
- Combina middleware de rol + ownership para control granular.

## Ejercicio sugerido

> Implementa tres roles: admin, editor, user. Crea middleware `RequireRole` y `RequirePermission`. Registra rutas: solo admin puede borrar posts, editor y admin pueden crearlos, todos pueden leerlos.

## Siguientes pasos

- [Encriptación](/security/encriptacion/)
