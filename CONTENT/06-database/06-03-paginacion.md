---
title: "Paginación"
description: "Implementa paginacion de resultados en Go con LIMIT/OFFSET de SQL puro"
order: 3
section: "06-database"
laravel_url: "https://laravel.com/docs/13.x/pagination"
go_packages: ["database/sql", "math", "fmt"]
---

# Paginación

**TL;DR** — Laravel tiene `paginate(15)` que devuelve un objeto con links, meta y resultados. En Go implementas paginación con `LIMIT $1 OFFSET $2` y un conteo total separado.

---

## En Laravel

```php
$users = User::paginate(15);
// $users->items(), $users->total(), $users->links()
```

## En Go

```go
package repository

import (
    "database/sql"
    "math"
)

type PaginationParams struct {
    Page     int
    PerPage  int
}

type PaginationMeta struct {
    Page      int `json:"page"`
    PerPage   int `json:"per_page"`
    Total     int `json:"total"`
    LastPage  int `json:"last_page"`
}

type PaginatedResult[T any] struct {
    Data []T            `json:"data"`
    Meta PaginationMeta `json:"meta"`
}

func NewPaginationParams(page, perPage int) PaginationParams {
    if page < 1 {
        page = 1
    }
    if perPage < 1 || perPage > 100 {
        perPage = 15
    }
    return PaginationParams{Page: page, PerPage: perPage}
}

func (p PaginationParams) Offset() int {
    return (p.Page - 1) * p.PerPage
}

func (p PaginationParams) Limit() int {
    return p.PerPage
}
```

### Repositorio con paginación

```go
type UserRepository struct {
    db *sql.DB
}

func (r *UserRepository) ListPaginated(params PaginationParams) (*PaginatedResult[User], error) {
    // 1. Contar total
    var total int
    err := r.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&total)
    if err != nil {
        return nil, err
    }

    // 2. Obtener página actual
    rows, err := r.db.Query(
        `SELECT id, name, email, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        params.Limit(), params.Offset(),
    )
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var users []User
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt); err != nil {
            return nil, err
        }
        users = append(users, u)
    }
    if err := rows.Err(); err != nil {
        return nil, err
    }

    lastPage := int(math.Ceil(float64(total) / float64(params.PerPage)))

    return &PaginatedResult[User]{
        Data: users,
        Meta: PaginationMeta{
            Page:     params.Page,
            PerPage:  params.PerPage,
            Total:    total,
            LastPage: lastPage,
        },
    }, nil
}
```

### Handler con paginación

```go
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
    page, _ := strconv.Atoi(r.URL.Query().Get("page"))
    perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))

    params := repository.NewPaginationParams(page, perPage)
    result, err := h.repo.ListPaginated(params)
    if err != nil {
        h.log.Error("error listing users", "err", err)
        http.Error(w, "Error interno", 500)
        return
    }

    writeJSON(w, 200, result)
}
```

### Response JSON

```json
GET /users?page=2&per_page=10

{
    "data": [
        { "id": 11, "name": "Juan", "email": "juan@go.dev" },
        { "id": 12, "name": "María", "email": "maria@go.dev" }
    ],
    "meta": {
        "page": 2,
        "per_page": 10,
        "total": 50,
        "last_page": 5
    }
}
```

### Paginación con filtros

```go
func (r *UserRepository) ListByRolePaginated(role string, params PaginationParams) (*PaginatedResult[User], error) {
    var total int
    r.db.QueryRow("SELECT COUNT(*) FROM users WHERE role = $1", role).Scan(&total)

    rows, err := r.db.Query(
        `SELECT id, name, email, created_at
         FROM users WHERE role = $1
         ORDER BY name
         LIMIT $2 OFFSET $3`,
        role, params.Limit(), params.Offset(),
    )
    // ... mismo patrón
}
```

## Comparativa: Paginación

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Método** | `Model::paginate(15)` | `LIMIT $1 OFFSET $2` |
| **Conteo total** | Automático | `SELECT COUNT(*)` separado |
| **Objeto resultado** | `LengthAwarePaginator` | Struct `PaginatedResult[T]` |
| **Links** | `$results->links()` (Blade) | Tú generas en frontend |
| **Query params** | `appends(['filter' => 'value'])` | Tú mantienes en frontend |
| **Cursor pagination** | `cursorPaginate()` | `WHERE id > $1 LIMIT $2` (más eficiente) |

## Errores comunes

1. **OFFSET grande = lento** — Para páginas profundas (page 1000), OFFSET escanea todas las filas anteriores. Usa cursor pagination (`WHERE id > $1 LIMIT $2`) para grandes datasets.
2. **No validar page/per_page** — Usuario puede enviar page=-1 o per_page=99999. Valida siempre.
3. **COUNT(*) en cada request** — Si la tabla es enorme, COUNT(*) es lento. Considera cachear el total o usar estimaciones.
4. **No devolver last_page** — El frontend necesita saber cuántas páginas hay para mostrar el paginador.

## Buenas prácticas

- Per_page máximo: establece un límite (ej: 100) para prevenir abusos.
- Para APIs públicas, usa cursor pagination en lugar de page/offset.
- Usa generics (`PaginatedResult[T]`) con Go 1.18+ para no duplicar structs.
- Devuelve siempre los metadatos: page, per_page, total, last_page.

## Ejercicio sugerido

> Implementa un endpoint `GET /products` con paginación. Acepta `page` y `per_page`. Devuelve `data` + `meta`. Si no se especifica page, usa default 1. Si per_page > 100, limita a 100. Agrega un filtro opcional `category`.

## Siguientes pasos

- [Migraciones sin ORM](/database/migraciones/)
