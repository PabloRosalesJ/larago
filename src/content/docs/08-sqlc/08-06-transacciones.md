---
title: "Transacciones con sqlc"
description: "De DB::transaction() a sql.Tx y queries generadas"
order: 6
section: "08-sqlc"
laravel_url: "https://laravel.com/docs/13.x/database#database-transactions"
go_packages: ["context", "github.com/jackc/pgx/v5", "github.com/jackc/pgx/v5/pgxpool"]
---

# Transacciones con sqlc

**TL;DR** — En Laravel envolvés operaciones en `DB::transaction(function() { ... })`. En sqlc generás queries que reciben `DBTX` (interfaz que cubre `*pgxpool.Pool` y `pgx.Tx`), y ejecutás todo dentro de una transacción explícita.

---

## En Laravel

```php
DB::transaction(function () {
    $user = User::create([...]);
    $post = $user->posts()->create([...]);

    // Si algo falla, todo se revierte automáticamente
});
```

Laravel maneja el commit/rollback automáticamente. Si la función lanza una excepción, rollback. Si no, commit.

## En Go (sqlc)

No hay closures mágicas. Controlás la transacción de forma explícita con `Begin`, `Commit` y `Rollback`.

### 1. La interfaz DBTX

Cuando generás sqlc con `emit_interface: true`, obtenés:

```go
// db/querier.go (generado)
type Querier interface {
    CreateUser(ctx context.Context, arg CreateUserParams) (User, error)
    CreatePost(ctx context.Context, arg CreatePostParams) (Post, error)
    // ...
}

// db/db.go (generado)
type DBTX interface {
    Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
    Query(context.Context, string, ...interface{}) (pgx.Rows, error)
    QueryRow(context.Context, string, ...interface{}) pgx.Row
    // CopyFrom y otros según config
}
```

Tanto `*pgxpool.Pool` como `pgx.Tx` implementan `DBTX`. Esto significa que podés usar el mismo `Queries` struct con una conexión directa o con una transacción.

### 2. Patrón de transacción

```go
type Service struct {
    q *db.Queries
    pool *pgxpool.Pool
}

func (s *Service) CreateUserWithPost(ctx context.Context, req CreateUserWithPostRequest) error {
    tx, err := s.pool.Begin(ctx)
    if err != nil {
        return fmt.Errorf("begin tx: %w", err)
    }
    // Importante: rollback si panic o error
    defer tx.Rollback(ctx)

    qtx := s.q.WithTx(tx)

    user, err := qtx.CreateUser(ctx, db.CreateUserParams{
        Name:         req.UserName,
        Email:        req.UserEmail,
        PasswordHash: req.PasswordHash,
    })
    if err != nil {
        return fmt.Errorf("create user: %w", err)
    }

    _, err = qtx.CreatePost(ctx, db.CreatePostParams{
        UserID: user.ID,
        Title:  req.PostTitle,
        Body:   req.PostBody,
    })
    if err != nil {
        return fmt.Errorf("create post: %w", err)
    }

    return tx.Commit(ctx)
}
```

**Atención**: `defer tx.Rollback(ctx)` es clave. Si hacés `Commit` exitoso, el `Rollback` es un no-op (no hace nada). Si hay un error antes del `Commit`, el `Rollback` libera la conexión.

### 3. Helper para transacciones

Podés encapsular el patrón para evitar repetir boilerplate:

```go
func WithTx(ctx context.Context, pool *pgxpool.Pool, fn func(q *db.Queries) error) error {
    tx, err := pool.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx)

    qtx := db.New(tx) // o s.q.WithTx(tx)
    if err := fn(qtx); err != nil {
        return err
    }

    return tx.Commit(ctx)
}

// Uso
err := WithTx(ctx, pool, func(q *db.Queries) error {
    user, err := q.CreateUser(ctx, ...)
    if err != nil {
        return err
    }
    _, err = q.CreatePost(ctx, ...)
    return err
})
```

### 4. Aislamiento y locks

Podés setear el nivel de aislamiento al comenzar la transacción:

```go
tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{
    IsoLevel:   pgx.Serializable,  // Serializable, RepeatableRead, ReadCommitted
    AccessMode: pgx.ReadWrite,
})
```

### 5. Queries dentro de transacciones

Todas las queries generadas por sqlc funcionan igual dentro o fuera de una transacción. La única diferencia es la conexión:

```go
// Sin transacción (auto-commit por fila)
user, err := queries.CreateUser(ctx, params)

// Con transacción (commit al final)
qtx := queries.WithTx(tx)
user, err := qtx.CreateUser(ctx, params)
```

### 6. Savepoints (PostgreSQL)

Para sub-transacciones:

```go
tx, _ := pool.Begin(ctx)
tx.Exec(ctx, "SAVEPOINT sp1")

// Si algo falla acá:
tx.Exec(ctx, "ROLLBACK TO SAVEPOINT sp1")
// Podés seguir usando la misma tx

tx.Commit(ctx)
```

## Comparativa: Transacciones

| Aspecto | Laravel | Go + sqlc |
|---------|---------|-----------|
| Iniciar | `DB::transaction(fn)` | `pool.Begin(ctx)` |
| Closure automático | Sí (commit/rollback) | No (manual) |
| Rollback | Automático en excepción | `defer tx.Rollback(ctx)` |
| Queries dentro | Mismo DB facade | `qtx := queries.WithTx(tx)` |
| Savepoints | No nativo | SQL manual |
| Aislamiento | Config en conexión | `TxOptions` explícito |

## Errores comunes al migrar

1. **Error**: Olvidar el `defer tx.Rollback(ctx)`.  
   **Solución**: Si no hacés rollback y hay un error, la transacción queda abierta y la conexión no se libera. Poné `defer` inmediatamente después de `Begin`.

2. **Error**: Usar `queries` (sin tx) dentro de una transacción.  
   **Solución**: Usá `qtx := queries.WithTx(tx)` y pasá `qtx` a todas las operaciones.

3. **Error**: Esperar que `Commit` falle silenciosamente.  
   **Solución**: `tx.Commit(ctx)` retorna error. Verificálo siempre. Un commit puede fallar por conflictos de serialización o desconexiones.

## Buenas prácticas

- Creá un helper `WithTx` para evitar el boilerplate de begin/defer/commit.
- Mantené las transacciones cortas. Una tx abierta retiene una conexión del pool.
- No mezcles `queries` y `qtx` en la misma transacción — todo debe pasar por el mismo `Queries` con tx.
- Usá `pgx.Serializable` solo cuando sea necesario; `ReadCommitted` es suficiente para el 90% de los casos.

## Ejercicio sugerido

> Implementá una función que cree un usuario y un post en una transacción. Si la creación del post falla (ej: título vacío), el usuario no debe persistir. Verificá con un test que el rollback funciona.

## Siguientes pasos

- [08-05: Relaciones con sqlc](/sqlc/relaciones-con-sqlc/)
- [08-07: Integración continua](/sqlc/integracion-continua/)

---

*¿Algo no claro? [Abrí un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
