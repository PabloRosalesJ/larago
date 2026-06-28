---
title: "Mutaciones: INSERT, UPDATE, DELETE"
description: "De Model::create() y Model::update() a :exec y :execrows en sqlc"
order: 4
section: "08-sqlc"
laravel_url: "https://laravel.com/docs/13.x/eloquent#inserting-and-updating-models"
go_packages: ["context", "github.com/jackc/pgx/v5"]
---

# Mutaciones: INSERT, UPDATE, DELETE

**TL;DR** — En Laravel mutas con `User::create([...])`; en sqlc escribes `INSERT INTO users (...) VALUES ($1, $2) RETURNING *`. La diferencia: control total del SQL vs magia del ORM.

---

## En Laravel

```php
$user = User::create([
    'name' => 'John',
    'email' => 'john@example.com',
    'password' => bcrypt('secret'),
]);

$user->update(['name' => 'Jane']);
$user->delete();
```

Eloquent decide el SQL: columnas `$fillable`, timestamps automáticos, soft deletes implícitos. Cómodo, pero no sabes exactamente qué SQL se ejecuta.

## En Go (sqlc)

Cada mutación es una query explícita con una annotación de retorno.

### 1. INSERT con :exec

```sql
-- queries/user.sql
-- name: CreateUser :exec
INSERT INTO users (name, email, password_hash)
VALUES ($1, $2, $3);
```

```go
// Generado:
func (q *Queries) CreateUser(ctx context.Context, arg CreateUserParams) error {
    _, err := q.db.Exec(ctx, createUser, arg.Name, arg.Email, arg.PasswordHash)
    return err
}
```

### 2. INSERT con :one + RETURNING (PostgreSQL)

```sql
-- name: CreateUserAndReturn :one
INSERT INTO users (name, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, name, email, is_admin, created_at, updated_at;
```

```go
// Generado: retorna User completo
func (q *Queries) CreateUserAndReturn(ctx context.Context, arg CreateUserAndReturnParams) (User, error) {
    row := q.db.QueryRow(ctx, createUserAndReturn, arg.Name, arg.Email, arg.PasswordHash)
    var i User
    err := row.Scan(&i.ID, &i.Name, &i.Email, &i.IsAdmin, &i.CreatedAt, &i.UpdatedAt)
    return i, err
}
```

**Recomendado**: usa `INSERT ... RETURNING` siempre que puedas. Evitas un SELECT adicional para obtener el ID generado.

### 3. :exec vs :execrows vs :one

| Anotación | Retorna | Caso de uso |
|-----------|---------|-------------|
| `:exec` | `error` | INSERT, DELETE sin interés en filas afectadas |
| `:execrows` | `(int64, error)` | Cuando necesitás saber cuántas filas cambiaron |
| `:one` | struct + error | Cuando necesitás datos de vuelta (RETURNING) |

```sql
-- name: DeleteOldPosts :execrows
DELETE FROM posts
WHERE created_at < $1;

-- name: UpdateUserEmail :exec
UPDATE users
SET email = $2, updated_at = NOW()
WHERE id = $1;
```

### 4. Batch inserts

sqlc no tiene un generador de batch inserts, pero podés escribirlos manualmente:

```sql
-- name: CreateUsers :copyfrom
INSERT INTO users (name, email, password_hash)
VALUES ($1, $2, $3);
```

Con `:copyfrom`, sqlc genera código que usa `CopyFrom` de pgx (copia masiva, mucho más rápida que INSERTs individuales):

```go
func (q *Queries) CreateUsers(ctx context.Context, users []CreateUsersParams) (int64, error) {
    // Usa pgx.CopyFrom internamente
}
```

Para batch sin copyfrom (MySQL, SQLite), usá un solo INSERT con múltiples VALUES:

```sql
-- name: CreateUsersBatch :exec
INSERT INTO users (name, email, password_hash)
VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9);
```

O mejor: generá el SQL dinámicamente con `fmt.Sprintf` y `pgx.Batch`.

### 5. UPDATE con RETURNING

```sql
-- name: UpdateUserEmail :one
UPDATE users
SET email = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, name, email, updated_at;
```

### 6. DELETE condicional

```sql
-- name: SoftDeleteUser :exec
UPDATE users
SET deleted_at = NOW()
WHERE id = $1;

-- name: HardDeleteUser :exec
DELETE FROM users
WHERE id = $1;
```

No hay "soft delete" automático. Si querés soft delete, lo implementás vos: agregá `deleted_at` a la tabla y filtrá en cada SELECT.

## Comparativa: Mutaciones

| Operación | Laravel | Go + sqlc |
|-----------|---------|-----------|
| Crear | `User::create([...])` | `queries.CreateUser(ctx, params)` |
| Crear y obtener ID | automático | `INSERT ... RETURNING id` |
| Actualizar | `$user->update([...])` | `queries.UpdateUser(ctx, params)` |
| Eliminar | `$user->delete()` | `queries.DeleteUser(ctx, id)` |
| Batch insert | `User::insert([...])` | `:copyfrom` (pgx) o SQL dinámico |
| Filas afectadas | `$user->wasChanged()` | `:execrows` retorna `int64` |
| Soft delete | `SoftDeletes` trait | Manual: `UPDATE SET deleted_at = NOW()` |

## Errores comunes al migrar

1. **Error**: Esperar que `:exec` retorne el ID insertado.  
   **Solución**: Usá `:one` con `RETURNING id`. En MySQL usá `lastInsertId()` (requiere `database/sql`).

2. **Error**: Hacer INSERT sin `RETURNING` y luego un SELECT para obtener el registro.  
   **Solución**: Siempre que necesites el registro de vuelta, usa `RETURNING *`. Es un viaje redondo menos.

3. **Error**: No manejar errores de unicidad (duplicated email).  
   **Solución**: Revisá `pgErr, ok := err.(*pgconn.PgError)` y verificá `pgErr.Code == "23505"` (unique violation).

## Buenas prácticas

- Preferí `:one` con `RETURNING *` para INSERTs — obtenés el registro completo con defaults de la BD.
- Usá `:execrows` en UPDATEs para verificar que se actualizó exactamente 1 fila.
- En batches grandes (>100 filas), usá `:copyfrom` con pgx; es 10x más rápido que INSERTs individuales.
- Nunca confíes en que un UPDATE/DELETE afectó filas — siempre chequeá el error o `RowsAffected`.

## Ejercicio sugerido

> Escribe queries para crear un usuario, actualizar su email, y eliminarlo. Usá `RETURNING` en el INSERT y el UPDATE. Implementá un "soft delete" manual con `deleted_at` y una query `ListActiveUsers` que filtre los no eliminados.

## Siguientes pasos

- [08-03: Queries SELECT](/sqlc/queries-select/)
- [08-05: Relaciones con sqlc](/sqlc/relaciones-con-sqlc/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
