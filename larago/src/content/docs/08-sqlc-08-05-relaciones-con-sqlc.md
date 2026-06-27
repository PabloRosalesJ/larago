---
title: "Relaciones con sqlc"
description: "De $user->posts a JOINs explícitos y composición manual en Go"
order: 5
section: "08-sqlc"
laravel_url: "https://laravel.com/docs/13.x/eloquent-relationships"
go_packages: ["context", "github.com/jackc/pgx/v5/pgxpool"]
---

# Relaciones con sqlc

**TL;DR** — En Laravel definís `$user->hasMany(Post::class)` y accedés a `$user->posts`. En sqlc no hay relaciones automáticas. Escribís JOINs en SQL y componés las estructuras en Go. Ganas control total y pierdes la magia.

---

## En Laravel

```php
class User extends Model {
    public function posts() {
        return $this->hasMany(Post::class);
    }
}

// Lazy loading (N+1):
foreach ($users as $user) {
    echo $user->posts->count();  // 1 query por usuario
}

// Eager loading:
$users = User::with('posts')->get();  // 2 queries totales
```

Laravel abstrae los JOINs. El problema: es fácil caer en N+1 sin darte cuenta.

## En Go (sqlc)

No hay eager loading ni lazy loading. Hay tres estrategias, y todas son explícitas.

### Estrategia 1: JOIN + struct plano

La más simple. Escribís un JOIN y sqlc genera un struct plano con todos los campos.

```sql
-- queries/post.sql
-- name: ListPostsWithAuthor :many
SELECT
    p.id AS post_id,
    p.title,
    p.body,
    p.created_at AS post_created_at,
    u.id AS author_id,
    u.name AS author_name,
    u.email AS author_email
FROM posts p
INNER JOIN users u ON u.id = p.user_id
ORDER BY p.created_at DESC;
```

```go
type ListPostsWithAuthorRow struct {
    PostID        int64            `json:"post_id"`
    Title         string           `json:"title"`
    Body          string           `json:"body"`
    PostCreatedAt pgtype.Timestamptz `json:"post_created_at"`
    AuthorID      int64            `json:"author_id"`
    AuthorName    string           `json:"author_name"`
    AuthorEmail   string           `json:"author_email"`
}
```

Ventaja: una sola query, una sola iteración. Desventaja: datos del autor repetidos si hay muchos posts del mismo autor.

### Estrategia 2: Dos queries + composición en Go

Para evitar duplicación, hacés dos queries y componés manualmente.

```sql
-- queries/user.sql
-- name: ListUsers :many
SELECT id, name, email FROM users ORDER BY name;

-- queries/post.sql
-- name: ListPostsByUserIDs :many
SELECT id, user_id, title, body, created_at
FROM posts
WHERE user_id = ANY($1::bigint[])
ORDER BY created_at DESC;
```

```go
type UserWithPosts struct {
    User
    Posts []Post
}

func GetUsersWithPosts(ctx context.Context, q *Queries) ([]UserWithPosts, error) {
    users, err := q.ListUsers(ctx)
    if err != nil {
        return nil, err
    }

    ids := make([]int64, len(users))
    for i, u := range users {
        ids[i] = u.ID
    }

    posts, err := q.ListPostsByUserIDs(ctx, ids)
    if err != nil {
        return nil, err
    }

    // Armar mapa userID → posts
    postsByUser := make(map[int64][]Post)
    for _, p := range posts {
        postsByUser[p.UserID] = append(postsByUser[p.UserID], p)
    }

    result := make([]UserWithPosts, len(users))
    for i, u := range users {
        result[i] = UserWithPosts{
            User:  u,
            Posts: postsByUser[u.ID],
        }
    }
    return result, nil
}
```

Ventaja: sin datos duplicados, estructura limpia. Desventaja: dos viajes redondos a la BD.

### Estrategia 3: N+1 controlado

A veces querés N+1 deliberadamente (ej: dashboard con pocos datos).

```go
func ListUsersWithPostCount(ctx context.Context, q *Queries) ([]UserWithCount, error) {
    users, err := q.ListUsers(ctx)
    if err != nil {
        return nil, err
    }

    result := make([]UserWithCount, len(users))
    for i, u := range users {
        count, err := q.CountPostsByUser(ctx, u.ID)
        if err != nil {
            return nil, err
        }
        result[i] = UserWithCount{User: u, PostCount: count}
    }
    return result, nil
}
```

Clave: hacelo explícito. Sabés exactamente cuántas queries se ejecutan.

### Componiendo structs genéricos

Si tenés muchas relaciones, creá helpers:

```go
type Author struct {
    ID    int64  `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

type PostWithAuthor struct {
    Post
    Author Author
}

func MapPostWithAuthor(row ListPostsWithAuthorRow) PostWithAuthor {
    return PostWithAuthor{
        Post: Post{
            ID:        row.PostID,
            Title:     row.Title,
            Body:      row.Body,
            CreatedAt: row.PostCreatedAt,
        },
        Author: Author{
            ID:    row.AuthorID,
            Name:  row.AuthorName,
            Email: row.AuthorEmail,
        },
    }
}

// Uso
rows, _ := queries.ListPostsWithAuthor(ctx)
posts := make([]PostWithAuthor, len(rows))
for i, r := range rows {
    posts[i] = MapPostWithAuthor(r)
}
```

## Comparativa: Relaciones

| Aspecto | Laravel | Go + sqlc |
|---------|---------|-----------|
| Definir relación | Método `hasMany()` en modelo | JOIN en SQL |
| Cargar relación | `$user->posts` (lazy) | Dos queries manuales |
| Evitar N+1 | `->with('posts')` | Planificar queries |
| Struct anidado | Automático | Composición manual |
| Muchos a muchos | `belongsToMany` | JOIN + tabla pivote |

## Errores comunes al migrar

1. **Error**: Hacer N+1 inconscientemente (for loop con query adentro).  
   **Solución**: Identificá el patrón y reemplazalo con `WHERE x = ANY($1)` o JOIN.

2. **Error**: Esperar que sqlc genere structs anidados automágicamente.  
   **Solución**: sqlc genera structs planos. Anidar es responsabilidad tuya en Go.

3. **Error**: Repetir el mismo JOIN en múltiples queries.  
   **Solución**: Creá funciones helper de composición (como `MapPostWithAuthor`) y reutilizalas.

## Buenas prácticas

- Para listados grandes (>100 items): JOIN plano con datos repetidos es mejor que dos queries.
- Para dashboards: dos queries separadas + composición en Go es más limpio.
- Nunca iteres sobre usuarios y hagas una query por cada uno. Usá `ANY($1::bigint[])`.
- Cuando anidés structs manualmente, mantené la responsabilidad en funciones dedicadas, no en el handler HTTP.

## Ejercicio sugerido

> Tené las tablas `users` y `posts`. Implementá tres formas de obtener usuarios con sus posts: (1) JOIN plano, (2) dos queries con `ANY($1)`, (3) N+1 explícito. Medí cuántas queries ejecuta cada una.

## Siguientes pasos

- [08-04: Mutaciones](/sqlc/mutaciones/)
- [08-06: Transacciones](/sqlc/transacciones/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
