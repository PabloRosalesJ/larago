---
title: "Testing con base de datos"
description: "Prueba operaciones de base de datos en Go con SQLite en memoria, t.Cleanup y migraciones programáticas"
order: 3
section: "11-testing"
laravel_url: "https://laravel.com/docs/13.x/database-testing"
go_packages: ["testing", "database/sql", "github.com/mattn/go-sqlite3"]
---

# Testing con base de datos

**TL;DR** — Laravel usa `RefreshDatabase` y `DatabaseMigrations`. En Go abres una base de datos en memoria (SQLite), ejecutas migraciones en `t.Cleanup()` y creas los datos que necesitas en cada test.

---

## En Laravel

```php
class UserTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_count(): void
    {
        User::factory()->count(3)->create();
        $this->assertCount(3, User::all());
    }
}
```

## En Go

No hay `RefreshDatabase` mágico. Cada test es responsable de su propio setup y cleanup.

### SQLite en memoria (tests unitarios rápidos)

```go
package main

import (
    "database/sql"
    "testing"

    _ "github.com/mattn/go-sqlite3"
)

// setupTestDB abre SQLite en memoria y ejecuta migraciones
func setupTestDB(t *testing.T) *sql.DB {
    t.Helper()

    db, err := sql.Open("sqlite3", ":memory:")
    if err != nil {
        t.Fatal(err)
    }

    // Migraciones programáticas
    _, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)
    if err != nil {
        t.Fatal(err)
    }

    // Cleanup automático al terminar el test
    t.Cleanup(func() {
        db.Close()
    })

    return db
}
```

### Insertar datos y probar

```go
func TestCountUsers(t *testing.T) {
    db := setupTestDB(t)

    // Seed data
    _, err := db.Exec(`INSERT INTO users (name, email) VALUES (?, ?)`, "Alice", "alice@example.com")
    if err != nil {
        t.Fatal(err)
    }
    _, err = db.Exec(`INSERT INTO users (name, email) VALUES (?, ?)`, "Bob", "bob@example.com")
    if err != nil {
        t.Fatal(err)
    }

    var count int
    err = db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
    if err != nil {
        t.Fatal(err)
    }

    if count != 2 {
        t.Errorf("count = %d, want 2", count)
    }
}
```

### Test de integración con Docker (PostgreSQL/MySQL)

Para tests que necesitan el mismo motor que producción, levanta un contenedor con `testcontainers-go`:

```go
import (
    "context"
    "testing"

    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/wait"
)

func setupPostgresTestDB(t *testing.T) *sql.DB {
    t.Helper()

    ctx := context.Background()

    req := testcontainers.ContainerRequest{
        Image:        "postgres:16-alpine",
        ExposedPorts: []string{"5432/tcp"},
        Env: map[string]string{
            "POSTGRES_USER":     "test",
            "POSTGRES_PASSWORD": "test",
            "POSTGRES_DB":       "testdb",
        },
        WaitingFor: wait.ForLog("database system is ready to accept connections"),
    }

    container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: req,
        Started:          true,
    })
    if err != nil {
        t.Fatal(err)
    }

    t.Cleanup(func() {
        container.Terminate(ctx)
    })

    host, _ := container.Host(ctx)
    port, _ := container.MappedPort(ctx, "5432")

    dsn := "postgres://test:test@" + host + ":" + port.Port() + "/testdb?sslmode=disable"
    db, err := sql.Open("postgres", dsn)
    if err != nil {
        t.Fatal(err)
    }

    // Ejecutar migraciones (usando archivo SQL o golang-migrate)
    runMigrations(t, db)

    return db
}
```

### `t.Cleanup()` como teardown

A diferencia de `defer`, `t.Cleanup()` se ejecuta aunque el test falle con `t.Fatal()`. Es el equivalente de `tearDown()` en PHPUnit.

```go
func TestWithCleanup(t *testing.T) {
    db := setupTestDB(t)
    // db.Close() se ejecuta automáticamente al final
    // aunque falle un t.Fatal() antes
}
```

### Marcar tests de integración con build tags

Separa tests unitarios de integración:

```go
// file: db_test.go

//go:build integration

package main

import "testing"

func TestPostgresIntegration(t *testing.T) {
    t.Skip("integration test")
}
```

```bash
go test -tags=integration ./...
```

Usa `t.Skip()` + `-short` como alternativa liviana:

```go
func TestWithDB(t *testing.T) {
    if testing.Short() {
        t.Skip("saltando test de integración")
    }
    // ...
}
```

```bash
go test -short ./...       # salta tests de integración
go test ./...              # corre todo
```

## Comparativa: Database Testing

| Concepto | Laravel | Go |
|----------|---------|----|
| **Setup DB** | `RefreshDatabase` trait | `setupTestDB(t)` manual |
| **Migraciones** | `DatabaseMigrations` | `db.Exec("CREATE TABLE ...")` |
| **Seeders** | `DatabaseSeeder` | INSERT manual en cada test |
| **Factories** | `User::factory()->create()` | Helper functions |
| **Teardown** | Automático (transaction rollback) | `t.Cleanup()` o `defer` |
| **DB temporal** | SQLite o transacción | `:memory:` SQLite |
| **DB real** | `.env.testing` | Testcontainers |
| **Separar tests** | Directorio `tests/` | Build tags o `-short` |

## Errores comunes al migrar

1. **Compartir DB entre tests** — Cada test debe tener su propia DB (o al menos su propia transacción). Si compartes, los tests se afectan entre sí.
2. **No cerrar la DB** — Siempre `t.Cleanup(func() { db.Close() })`. Nunca `defer db.Close()` porque `t.Fatal()` no ejecuta `defer`.
3. **Usar SQLite en memoria para probar queries de PostgreSQL** — SQLite no soporta window functions, `ARRAY_AGG`, etc. Usa testcontainers si dependes de features del motor.

## Buenas prácticas

- Cada test crea sus propios datos. No asumas que otro test los dejó.
- Usa helpers de factories (funciones que crean registros) para no repetir INSERTs.
- Los tests de integración van en archivos con build tag `integration`.
- Corre `go test -short` en CI para unitarios; `go test -tags=integration` en pipelines separados.

## Ejercicio sugerido

> Crea una función `CreateUser(db, name, email)` que inserte y devuelva el ID. Escribe un test que: (1) cree SQLite en memoria, (2) ejecute migraciones, (3) inserte 3 usuarios, (4) verifique que `COUNT(*)` sea 3.

## Siguientes pasos

- [Mocks](/testing/mocks/)
- [GORM CRUD básico](/gorm/crud-basico/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
