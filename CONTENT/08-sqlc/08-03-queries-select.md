---
title: "Queries SELECT con sqlc"
description: "De User::where() a queries SQL tipadas con :one y :many"
order: 3
section: "08-sqlc"
laravel_url: "https://laravel.com/docs/13.x/queries"
go_packages: ["context", "github.com/jackc/pgx/v5/pgxpool"]
---

# Queries SELECT con sqlc

**TL;DR** — En Laravel escribes `User::where('email', $email)->first()`. En sqlc escribes SQL puro con `WHERE email = $1` y obtienes una función Go tipada. Nada de N+1 oculto, nada de lazy loading.

---

## En Laravel

```php
$user = User::where('email', $email)->first();
$posts = Post::where('user_id', $user->id)
    ->where('published', true)
    ->orderBy('created_at', 'desc')
    ->get();

// Lazy loading (peligroso):
$user->posts;  // Otra query automática
```

Laravel oculta el SQL. Es cómodo hasta que tienes N+1, queries lentas, o joins inesperados.

## En Go (sqlc)

Cada query debe escribirse explícitamente en un archivo `.sql`. Nada se genera mágicamente.

### 1. Archivos de queries

```sql
-- queries/user.sql
-- name: GetUserByEmail :one
SELECT id, name, email, is_admin, created_at
FROM users
WHERE email = $1
LIMIT 1;

-- name: ListUsers :many
SELECT id, name, email, is_admin, created_at
FROM users
ORDER BY created_at DESC;
```

Anotaciones clave:

- `-- name: GetUserByEmail :one` → genera una función que retorna un struct (o error si no encuentra).
- `-- name: ListUsers :many` → genera una función que retorna `[]User` (slice vacío si no hay resultados).
- `$1`, `$2` → parámetros posicionales (PostgreSQL).

### 2. Código generado

```go
// db/user.sql.go (generado)
type GetUserByEmailParams struct {
    Email string `json:"email"`
}

func (q *Queries) GetUserByEmail(ctx context.Context, arg GetUserByEmailParams) (User, error) {
    row := q.db.QueryRow(ctx, getUserByEmail, arg.Email)
    var i User
    err := row.Scan(&i.ID, &i.Name, &i.Email, &i.IsAdmin, &i.CreatedAt)
    return i, err
}

func (q *Queries) ListUsers(ctx context.Context) ([]User, error) {
    rows, err := q.db.Query(ctx, listUsers)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var items []User
    for rows.Next() {
        var i User
        if err := rows.Scan(&i.ID, &i.Name, &i.Email, &i.IsAdmin, &i.CreatedAt); err != nil {
            return nil, err
        }
        items = append(items, i)
    }
    return items, rows.Err()
}
```

### 3. WHERE, JOIN, GROUP BY, ORDER BY

```sql
-- queries/post.sql
-- name: ListPostsWithAuthor :many
SELECT
    p.id,
    p.title,
    p.body,
    p.created_at,
    u.id as author_id,
    u.name as author_name,
    u.email as author_email
FROM posts p
INNER JOIN users u ON u.id = p.user_id
WHERE p.published_at IS NOT NULL
  AND ($1 = '' OR p.title ILIKE '%' || $1 || '%')
ORDER BY p.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPostsByUser :many
SELECT
    u.id,
    u.name,
    COUNT(p.id)::int as post_count
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
GROUP BY u.id, u.name
ORDER BY post_count DESC;
```

sqlc no se inmuta por la complejidad del SQL. Siempre que sea SQL válido para tu engine, genera el código correspondiente.

### 4. Parámetros con nombres

Para queries con muchos parámetros, sqlc genera un struct con nombres:

```sql
-- name: SearchPosts :many
SELECT id, title, body, created_at
FROM posts
WHERE title ILIKE '%' || @search_term || '%'
  AND (@author_id = 0 OR user_id = @author_id)
  AND (@published_only = false OR published_at IS NOT NULL)
ORDER BY created_at DESC;
```

```go
type SearchPostsParams struct {
    SearchTerm     string `json:"search_term"`
    AuthorID       int64  `json:"author_id"`
    PublishedOnly  bool   `json:"published_only"`
}

func (q *Queries) SearchPosts(ctx context.Context, arg SearchPostsParams) ([]Post, error) {
    // ...
}
```

Usa `@param_name` en SQL o `sqlc.narg` para parámetros opcionales (se convierten en `*T`).

### 5. Uso desde el main

```go
package main

import (
    "context"
    "log"
    "os"

    "github.com/jackc/pgx/v5/pgxpool"
    "project/db"
)

func main() {
    ctx := context.Background()

    pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
    if err != nil {
        log.Fatal(err)
    }
    defer pool.Close()

    queries := db.New(pool)

    // :one → struct o error
    user, err := queries.GetUserByEmail(ctx, db.GetUserByEmailParams{
        Email: "user@example.com",
    })
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("User: %s (%s)", user.Name, user.Email)

    // :many → slice
    posts, err := queries.ListPostsWithAuthor(ctx, db.ListPostsWithAuthorParams{
        Column1: "",   // search term
        Column2: 10,   // limit
        Column3: 0,    // offset
    })
    if err != nil {
        log.Fatal(err)
    }
    for _, p := range posts {
        log.Printf("Post %d by %s", p.ID, p.AuthorName)
    }
}
```

## Comparativa: SELECT

| Aspecto | Laravel | Go + sqlc |
|---------|---------|-----------|
| Query simple | `User::find($id)` | `queries.GetUserByID(ctx, id)` |
| Filtros | `->where('x', $v)` | `WHERE x = $1` en SQL |
| Joins | `->with('relation')` | `JOIN ... ON` explícito |
| Lazy loading | `$user->posts` (automático) | No existe — escribes otro query |
| Paginación | `->paginate(15)` | `LIMIT $1 OFFSET $2` manual |
| Parámetros | Array asociativo | Struct tipado generado |

## Errores comunes al migrar

1. **Error**: `:one` cuando el SQL puede retornar cero filas — esperar `nil` struct.  
   **Solución**: `:one` retorna error `sql.ErrNoRows` si no hay filas. Usá `:many` y revisá len==0, o manejá `ErrNoRows` explícitamente.

2. **Error**: No pasar `ctx` a las queries.  
   **Solución**: Todas las funciones generadas reciben `ctx` como primer parámetro. Pasa `context.Background()` en scripts, `r.Context()` en handlers HTTP.

3. **Error**: Esperar que `ListPostsWithAuthor` retorne structs anidados.  
   **Solución**: sqlc retorna structs planos. Para anidar, lo armas manualmente (ver 08-05).

## Buenas prácticas

- Usá `:one` solo cuando esperás exactamente 0 o 1 filas y querés error si hay más.
- Nombrá los parámetros con `@nombre` si tenés más de 3 parámetros — mejora legibilidad.
- Poné `LIMIT` y `OFFSET` siempre en listados. No hay "paginación automática".
- Definí las columnas explícitamente en cada SELECT; no uses `SELECT *`.

## Ejercicio sugerido

> Escribe una query con JOIN entre `users` y `posts` que retorne posts con nombre de autor. Usá `ILIKE` para búsqueda por título y `LIMIT/OFFSET` para paginación. Generá el código y llamá a la función desde un `main`.

## Siguientes pasos

- [08-04: Mutaciones (INSERT, UPDATE, DELETE)](/sqlc/mutaciones/)
- [08-05: Relaciones con sqlc](/sqlc/relaciones-con-sqlc/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
