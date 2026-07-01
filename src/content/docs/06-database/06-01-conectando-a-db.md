---
title: "Conectando a DB"
description: "Conecta Go a bases de datos SQL con database/sql, la capa de abstraccion oficial de Go"
order: 1
section: "06-database"
laravel_url: "https://laravel.com/docs/13.x/database"
go_packages: ["database/sql", "github.com/lib/pq", "github.com/go-sql-driver/mysql"]
---

# Conectando a DB

**TL;DR** — Laravel configura DB en `.env` con múltiples drivers. Go usa `database/sql` como interfaz universal y drivers específicos para cada motor.

---

## En Laravel

```php
// config/database.php
'connections' => [
    'pgsql' => [
        'driver'   => 'pgsql',
        'host'     => env('DB_HOST'),
        'database' => env('DB_DATABASE'),
        'username' => env('DB_USERNAME'),
        'password' => env('DB_PASSWORD'),
    ],
],
```

## En Go

```go
package main

import (
    "database/sql"
    "fmt"
    "log"
    "os"
    "time"

    _ "github.com/lib/pq" // Driver PostgreSQL
    // _ "github.com/go-sql-driver/mysql" // Driver MySQL
    // _ "github.com/mattn/go-sqlite3" // Driver SQLite
)

func main() {
    // Connection string (como .env pero explícito)
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" {
        dsn = "postgres://user:pass@localhost:5432/mydb?sslmode=disable"
    }

    // Abrir conexión
    db, err := sql.Open("postgres", dsn)
    if err != nil {
        log.Fatalf("Error abriendo DB: %v", err)
    }
    defer db.Close()

    // Configurar pool de conexiones
    db.SetMaxOpenConns(25)               // Máximo de conexiones abiertas
    db.SetMaxIdleConns(5)                // Máximo de conexiones inactivas
    db.SetConnMaxLifetime(5 * time.Minute) // Tiempo máximo de vida de una conexión
    db.SetConnMaxIdleTime(1 * time.Minute) // Tiempo máximo de inactividad

    // Verificar conexión
    if err := db.Ping(); err != nil {
        log.Fatalf("Error conectando a DB: %v", err)
    }
    log.Println("Conectado a la base de datos")
}
```

### Función helper reusable

```go
// internal/database/postgres.go
package database

import (
    "database/sql"
    "fmt"
    "time"
    _ "github.com/lib/pq"
)

type Config struct {
    Host     string
    Port     int
    User     string
    Password string
    DBName   string
    SSLMode  string
}

func (c Config) DSN() string {
    return fmt.Sprintf(
        "postgres://%s:%s@%s:%d/%s?sslmode=%s",
        c.User, c.Password, c.Host, c.Port, c.DBName, c.SSLMode,
    )
}

func ConnectPostgres(cfg Config) (*sql.DB, error) {
    db, err := sql.Open("postgres", cfg.DSN())
    if err != nil {
        return nil, fmt.Errorf("error abriendo DB: %w", err)
    }

    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(5 * time.Minute)

    if err := db.Ping(); err != nil {
        return nil, fmt.Errorf("error ping DB: %w", err)
    }

    return db, nil
}
```

### Consulta simple

```go
type User struct {
    ID    int
    Name  string
    Email string
}

func getUser(db *sql.DB, id int) (*User, error) {
    user := &User{}
    err := db.QueryRow(
        "SELECT id, name, email FROM users WHERE id = $1", id,
    ).Scan(&user.ID, &user.Name, &user.Email)
    if err != nil {
        return nil, err
    }
    return user, nil
}
```

## Comparativa: Conexión a DB

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Abstracción** | Eloquent / Query Builder | `database/sql` |
| **Driver** | Automático según .env | Import explícito: `_ "github.com/lib/pq"` |
| **Pool** | Automático (PHP-FPM) | `SetMaxOpenConns`, `SetMaxIdleConns` |
| **DSN** | En `.env` | Variable de entorno o struct Config |
| **Ping** | `php artisan db:monitor` | `db.Ping()` |
| **Migration** | `php artisan migrate` | Tú controlas (`embed` + SQL) |
| **Logging** | Automático (slow queries) | Manual con middleware |

## Errores comunes

1. **Olvidar importar el driver** — `sql.Open()` no falla si el driver no está importado. El error aparece en `db.Ping()`. Siempre importa el driver con `_ "github.com/lib/pq"`.
2. **No cerrar filas** — `db.Query()` devuelve `*sql.Rows` que debe cerrarse. Usa `defer rows.Close()`.
3. **Pool de conexiones incorrecto** — `SetMaxOpenConns` muy bajo = contienda, muy alto = saturación de DB. Empieza con 25.
4. **No verificar errores en `Scan`** — `Scan` devuelve error si el tipo no coincide o hay NULL. Siempre revisa.

## Buenas prácticas

- Pon la configuración de DB en un struct `Config` con valores por defecto.
- Configura el pool de conexiones explícitamente (no confíes en defaults).
- Usa `defer rows.Close()` siempre que hagas queries con múltiples filas.
- Wrapea `database/sql` en un paquete `repository` para tests.
- Usa `$1`, `$2` (PostgreSQL) o `?` (MySQL) para placeholders, nunca concatenes strings.

## Ejercicio sugerido

> Configura una conexión PostgreSQL usando variables de entorno. Crea una tabla `users` (id, name, email). Implementa una función `GetUserByID(db, id)` que devuelva el usuario. Verifica la conexión con `Ping()`.

## Siguientes pasos

- [Queries con stdlib](/database/queries-con-stdlib/)
