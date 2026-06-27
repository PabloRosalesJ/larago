---
title: "Seed data"
description: "Puebla tu base de datos con datos de prueba en Go usando SQL directo o golang-migrate"
order: 5
section: "06-database"
laravel_url: "https://laravel.com/docs/13.x/seeding"
go_packages: ["database/sql", "fmt", "log"]
---

# Seed data

**TL;DR** — Laravel tiene `DatabaseSeeder` y factories. En Go escribes funciones `SeedXxx(db)` que ejecutan inserts SQL o usas un paquete como `go-faker`.

---

## En Laravel

```php
// database/seeders/DatabaseSeeder.php
$this->call([
    UserSeeder::class,
    PostSeeder::class,
]);

// php artisan db:seed
```

## En Go

### Seed simple con SQL

```go
package seeds

import (
    "database/sql"
    "fmt"
    "log"
)

func SeedUsers(db *sql.DB) error {
    users := []struct {
        Name  string
        Email string
    }{
        {"Admin", "admin@go.dev"},
        {"Juan", "juan@go.dev"},
        {"María", "maria@go.dev"},
    }

    for _, u := range users {
        _, err := db.Exec(
            `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
             ON CONFLICT (email) DO NOTHING`,
            u.Name, u.Email,
            "$2a$12$xxxxxxxxxxxxxxxxxxxxxxxxxx", // hash pre-generado
        )
        if err != nil {
            return fmt.Errorf("seed user %s: %w", u.Email, err)
        }
    }

    log.Printf("Seeded %d users", len(users))
    return nil
}
```

### Usando go-faker para datos realistas

```bash
go get github.com/go-faker/faker/v4
```

```go
import "github.com/go-faker/faker/v4"

type UserSeed struct {
    Name  string
    Email string
}

func GenerateUsers(n int) []UserSeed {
    var users []UserSeed
    for i := 0; i < n; i++ {
        users = append(users, UserSeed{
            Name:  faker.Name(),
            Email: faker.Email(),
        })
    }
    return users
}

func SeedUsersFaker(db *sql.DB, count int) error {
    users := GenerateUsers(count)
    for _, u := range users {
        _, err := db.Exec(
            `INSERT INTO users (name, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            u.Name, u.Email,
        )
        if err != nil {
            return err
        }
    }
    return nil
}
```

### Seed con relaciones

```go
func SeedPosts(db *sql.DB) error {
    // Obtener IDs de usuarios existentes
    rows, err := db.Query("SELECT id FROM users")
    if err != nil {
        return err
    }
    defer rows.Close()

    var userIDs []int
    for rows.Next() {
        var id int
        rows.Scan(&id)
        userIDs = append(userIDs, id)
    }

    titles := []string{
        "Introducción a Go",
        "Concurrencia en Go",
        "HTTP Servers con stdlib",
        "Testing en Go",
        "Patrones de diseño",
    }

    for _, uid := range userIDs {
        for _, title := range titles {
            _, err = db.Exec(
                `INSERT INTO posts (user_id, title, content)
                 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                uid, title, faker.Paragraph(),
            )
            if err != nil {
                return err
            }
        }
    }

    return nil
}
```

### Orquestador de seeds

```go
func RunAllSeeds(db *sql.DB) {
    seeds := []struct {
        Name string
        Fn   func(*sql.DB) error
    }{
        {"users", SeedUsers},
        {"posts", SeedPosts},
        {"comments", SeedComments},
    }

    for _, s := range seeds {
        log.Printf("Ejecutando seed: %s", s.Name)
        if err := s.Fn(db); err != nil {
            log.Fatalf("Seed %s falló: %v", s.Name, err)
        }
    }

    log.Println("Todos los seeds ejecutados exitosamente")
}
```

## Comparativa: Seed

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Ejecución** | `php artisan db:seed` | Función `RunAllSeeds(db)` |
| **Datos falsos** | Factory + Faker | `go-faker/faker` |
| **Relaciones** | Factory states | Consulta IDs existentes + loop |
| **Orden** | `$this->call([...])` | Array ordenado de seeds |
| **Repetible** | `truncate()` + seed | `ON CONFLICT DO NOTHING` |
| **CLI** | Artisan | `go run cmd/seed/main.go` |

## Errores comunes

1. **Seeds no idempotentes** — Ejecutar el seed dos veces no debe duplicar datos. Usa `ON CONFLICT DO NOTHING` o TRUNCATE antes de insertar.
2. **Datos sensibles en seeds** — No pongas emails/passwords reales. Usa datos de prueba.
3. **Seeds que dependen de orden** — Si PostSeed necesita UserSeed, asegura el orden explícitamente.

## Buenas prácticas

- Los seeds deben ser idempotentes (ejecutables múltiples veces sin duplicar).
- Usa `go-faker` para generar datos realistas.
- Separa seeds de desarrollo de seeds de prueba.
- Los seeds de desarrollo pueden tener datos extensos (+100 registros).
- Crea un comando separado `cmd/seed/main.go` para ejecutar seeds desde CLI.

## Ejercicio sugerido

> Crea un paquete `seeds` con `SeedUsers(db, count)` y `SeedPosts(db, count)`. Los posts deben asignarse aleatoriamente a usuarios existentes. Ejecuta los seeds desde `cmd/seed/main.go`. Verifica que sea idempotente.

## Siguientes pasos

- [GORM: Instalación y Setup](/gorm/instalacion-y-setup/)
