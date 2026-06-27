---
title: "Instalación y setup de GORM"
description: "Instala GORM en Go, conecta a PostgreSQL/MySQL/SQLite y crea tu primer modelo"
order: 1
section: "07-gorm"
laravel_url: "https://laravel.com/docs/13.x/eloquent"
go_packages: ["gorm.io/gorm", "gorm.io/driver/postgres", "gorm.io/driver/mysql", "gorm.io/driver/sqlite"]
---

# Instalación y setup de GORM

**TL;DR** — En Laravel Eloquent viene integrado con `config/database.php`. En Go instalas GORM con `go get`, configuras la conexión con DSN directo y llamas a `gorm.Open()`.

---

## En Laravel

```php
// .env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=mydb
DB_USERNAME=user
DB_PASSWORD=secret

// config/database.php
'connections' => [
    'pgsql' => [
        'driver' => 'pgsql',
        'host' => env('DB_HOST'),
        'database' => env('DB_DATABASE'),
        'username' => env('DB_USERNAME'),
        'password' => env('DB_PASSWORD'),
    ],
],

// Un modelo se crea con artisan
// php artisan make:model User
class User extends Model
{
    protected $table = 'users';
}
```

Eloquent está preinstalado. Solo configuras el `.env` y empiezas.

## En Go (GORM)

```go
// 1. Instalar GORM y el driver correspondiente
// go get gorm.io/gorm
// go get gorm.io/driver/postgres    // PostgreSQL
// go get gorm.io/driver/mysql       // MySQL / MariaDB
// go get gorm.io/driver/sqlite      // SQLite

package main

import (
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type User struct {
	ID        uint   `gorm:"primaryKey"`
	Name      string
	Email     string `gorm:"uniqueIndex;not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=secret dbname=mydb port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info), // SQL en consola
	})
	if err != nil {
		log.Fatalf("Error conectando a DB: %v", err)
	}

	// AutoMigrate crea la tabla si no existe
	db.AutoMigrate(&User{})

	// Primer registro
	user := User{Name: "Alice", Email: "alice@example.com"}
	result := db.Create(&user)
	if result.Error != nil {
		log.Fatalf("Error creando usuario: %v", result.Error)
	}

	log.Printf("Creado usuario ID=%d", user.ID)

	// Leerlo de vuelta
	var read User
	db.First(&read, user.ID)
	log.Printf("Leído: %+v", read)
}
```

### DSN para cada driver

```go
// PostgreSQL
postgres.Open("host=localhost user=postgres password=secret dbname=mydb port=5432 sslmode=disable TimeZone=UTC")

// MySQL
mysql.Open("user:password@tcp(localhost:3306)/mydb?charset=utf8mb4&parseTime=True&loc=Local")

// SQLite
sqlite.Open("test.db") // archivo local, sin servidor
```

### Pool de conexiones

GORM expone el `sql.DB` subyacente para configurar el pool:

```go
sqlDB, err := db.DB()
if err != nil {
	log.Fatal(err)
}
sqlDB.SetMaxOpenConns(25)
sqlDB.SetMaxIdleConns(5)
sqlDB.SetConnMaxLifetime(5 * time.Minute)
```

## Comparativa

| Aspecto | Laravel / Eloquent | GORM |
|---|---|---|
| **Instalación** | Incluido en Laravel | `go get gorm.io/gorm` + driver |
| **Conexión** | `.env` + `config/database.php` | `gorm.Open(driver.Open(dsn), &gorm.Config{})` |
| **DSN** | Generado automáticamente | String explícito por driver |
| **Driver** | Automático según `DB_CONNECTION` | Import explícito: `gorm.io/driver/postgres` |
| **Log de queries** | `DB::enableQueryLog()` | `logger.Default.LogMode(logger.Info)` |
| **Pool** | Automático (PHP-FPM) | `sqlDB.SetMaxOpenConns(n)` |
| **Primer modelo** | `php artisan make:model` | Struct Go con tags `gorm:""` |
| **AutoMigrate** | `php artisan migrate` | `db.AutoMigrate(&Model{})` |

## Errores comunes

1. **Olvidar instalar el driver** — `gorm.Open` no compila si falta el driver. Siempre corre `go get gorm.io/driver/<motor>`.
2. **DSN incorrecto en PostgreSQL** — El formato es `host=... user=... dbname=...`, no URL. Para URL usa `postgres.Open(dsn)` con `postgres://user:pass@localhost/db`.
3. **No cerrar `sqlDB`** — La instancia de `*sql.DB` obtenida con `db.DB()` debe cerrarse con `defer sqlDB.Close()`.
4. **Confiar en defaults del pool** — Por defecto GORM no limita conexiones. Siempre configura `SetMaxOpenConns` y `SetMaxIdleConns`.

## Ejercicio sugerido

> Crea un nuevo módulo Go, instala GORM con driver SQLite, define un modelo `Product` (ID, Name, Price, CreatedAt), ejecuta `AutoMigrate`, inserta 3 productos y luego listalos con `db.Find()`.

## Siguientes pasos

- [Modelos en GORM](/gorm/modelos/)
