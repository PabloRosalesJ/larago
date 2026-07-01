---
title: "Migraciones sin ORM"
description: "Gestiona esquemas de base de datos en Go con archivos SQL puros y embed, sin ORM"
order: 4
section: "06-database"
laravel_url: "https://laravel.com/docs/13.x/migrations"
go_packages: ["database/sql", "embed", "sort", "strings"]
---

# Migraciones sin ORM

**TL;DR** — Laravel genera migraciones con `php artisan make:migration` y las ejecuta en orden. En Go usas archivos SQL versionados y los ejecutas manualmente con `database/sql` o herramientas como `golang-migrate`.

---

## En Laravel

```php
// database/migrations/2024_01_01_000001_create_users_table.php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->timestamps();
});
```

## En Go

### Estructura de archivos SQL

```
migrations/
├── 001_create_users.up.sql
├── 001_create_users.down.sql
├── 002_create_posts.up.sql
├── 002_create_posts.down.sql
├── 003_add_avatar_to_users.up.sql
└── 003_add_avatar_to_users.down.sql
```

```sql
-- 001_create_users.up.sql
CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

```sql
-- 001_create_users.down.sql
DROP TABLE IF EXISTS users;
```

### Migrator manual

```go
package migrations

import (
    "database/sql"
    "embed"
    "fmt"
    "log"
    "sort"
    "strings"
)

//go:embed *.sql
var migrationFS embed.FS

type Migration struct {
    Version string
    UpSQL   string
    DownSQL string
}

func RunMigrations(db *sql.DB) error {
    // 1. Crear tabla de migraciones si no existe
    _, err := db.Exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            version VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )
    `)
    if err != nil {
        return fmt.Errorf("creando tabla migrations: %w", err)
    }

    // 2. Cargar migraciones desde embed.FS
    migrations, err := loadMigrations()
    if err != nil {
        return err
    }

    // 3. Ejecutar migraciones pendientes
    for _, m := range migrations {
        var applied bool
        db.QueryRow("SELECT EXISTS(SELECT 1 FROM migrations WHERE version = $1)", m.Version).Scan(&applied)
        if applied {
            continue
        }

        log.Printf("Ejecutando migración %s...", m.Version)
        _, err := db.Exec(m.UpSQL)
        if err != nil {
            return fmt.Errorf("migración %s falló: %w", m.Version, err)
        }

        _, err = db.Exec("INSERT INTO migrations (version) VALUES ($1)", m.Version)
        if err != nil {
            return fmt.Errorf("registrando migración %s: %w", m.Version, err)
        }

        log.Printf("Migración %s aplicada", m.Version)
    }

    return nil
}

func loadMigrations() ([]Migration, error) {
    entries, err := migrationFS.ReadDir(".")
    if err != nil {
        return nil, err
    }

    // Agrupar archivos por versión
    groups := make(map[string]Migration)
    for _, entry := range entries {
        name := entry.Name()
        if !strings.HasSuffix(name, ".sql") {
            continue
        }

        parts := strings.Split(name, ".")
        if len(parts) < 3 {
            continue
        }

        version := parts[0]
        direction := parts[1] // "up" o "down"
        data, _ := migrationFS.ReadFile(name)

        m := groups[version]
        m.Version = version
        if direction == "up" {
            m.UpSQL = string(data)
        } else {
            m.DownSQL = string(data)
        }
        groups[version] = m
    }

    // Ordenar por versión
    var versions []string
    for v := range groups {
        versions = append(versions, v)
    }
    sort.Strings(versions)

    var migrations []Migration
    for _, v := range versions {
        migrations = append(migrations, groups[v])
    }

    return migrations, nil
}
```

### Usando golang-migrate (recomendado)

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

migrate create -ext sql -dir migrations -seq create_users
migrate -database "postgres://..." -path migrations up
```

```go
import (
    "github.com/golang-migrate/migrate/v4"
    _ "github.com/golang-migrate/migrate/v4/database/postgres"
    _ "github.com/golang-migrate/migrate/v4/source/file"
)

func runMigrations(databaseURL string) error {
    m, err := migrate.New("file://migrations", databaseURL)
    if err != nil {
        return err
    }
    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return err
    }
    return nil
}
```

## Comparativa: Migraciones

| Aspecto | Laravel | Go (manual) | Go (golang-migrate) |
|---------|---------|-------------|---------------------|
| **Formato** | PHP class | SQL puro | SQL puro |
| **Creación** | `make:migration` | `touch 001_xxx.up.sql` | `migrate create -seq` |
| **Ejecución** | `php artisan migrate` | Función `RunMigrations(db)` | `migrate up` |
| **Rollback** | `migrate:rollback` | Manual (down.sql) | `migrate down` |
| **Status** | `migrate:status` | Consulta tabla `migrations` | `migrate version` |
| **Seed** | `db:seed` | Manual o con goose | No incluido |
| **Dependencia** | Ninguna (incluido) | Ninguna | `golang-migrate` |

## Errores comunes

1. **No tener down migrations** — Siempre escribe la reversión. En producción quizás no la uses, pero en desarrollo es indispensable.
2. **Ejecutar migraciones manualmente** — Las migraciones deben ejecutarse al iniciar la app o en CI/CD, no a mano en producción.
3. **Modificar migraciones ya aplicadas** — Una vez aplicada en producción, una migración es inmutable. Crea una nueva.
4. **No usar transacciones** — Las migraciones deben ejecutarse en una transacción para que sean atómicas.

## Buenas prácticas

- Usa `golang-migrate` o `goose` en lugar de implementar el migrator manualmente.
- Nombra las migraciones con prefijo numérico: `001`, `002`, etc.
- Siempre escribe `up.sql` y `down.sql`.
- Las migraciones se ejecutan al iniciar la aplicación (antes de aceptar requests).
- En producción, usa `migrate up` como paso separado en CI/CD, no al iniciar la app.

## Ejercicio sugerido

> Crea tres migraciones: `001_create_users`, `002_create_posts`, `003_add_indexes`. Usa `golang-migrate` para ejecutarlas. Implementa un `main.go` que ejecute migraciones antes de iniciar el servidor HTTP.

## Siguientes pasos

- [Seed data](/database/seed-data/)
