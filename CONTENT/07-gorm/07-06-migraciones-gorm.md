---
title: "Migraciones con GORM"
description: "AutoMigrate en GORM, limitaciones, y cuándo usar migraciones SQL tradicionales en lugar de AutoMigrate"
order: 6
section: "07-gorm"
laravel_url: "https://laravel.com/docs/13.x/migrations"
go_packages: ["gorm.io/gorm", "golang-migrate/migrate/v4"]
---

# Migraciones con GORM

**TL;DR** — Laravel usa archivos PHP con `Schema::create()` y `Schema::table()`. GORM ofrece `AutoMigrate` para sincronizar modelos con la DB automáticamente, pero con limitaciones importantes.

---

## En Laravel

```php
// database/migrations/xxxx_create_users_table.php
class CreateUsersTable extends Migration
{
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down()
    {
        Schema::dropIfExists('users');
    }
}

// Ejecutar: php artisan migrate
// Revertir: php artisan migrate:rollback
```

## En Go (GORM)

### AutoMigrate — el "artisan migrate" automático

```go
package main

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type User struct {
	ID        uint   `gorm:"primaryKey"`
	Name      string `gorm:"type:varchar(255);not null"`
	Email     string `gorm:"uniqueIndex;not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

type Post struct {
	ID     uint   `gorm:"primaryKey"`
	UserID uint   `gorm:"index;not null"`
	Title  string `gorm:"type:varchar(255);not null"`
	Body   string `gorm:"type:text"`
}

func main() {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	// EQUIVALENTE a: php artisan migrate
	// Crea tablas, columnas, Índices, FKs — todo en una línea
	err = db.AutoMigrate(&User{}, &Post{})
	if err != nil {
		log.Fatal(err)
	}
	log.Println("Migraciones ejecutadas")
}
```

### Lo que AutoMigrate SÍ hace

| Operación | AutoMigrate |
|---|---|
| Crear tablas nuevas | ✅ |
| Agregar columnas nuevas | ✅ |
| Agregar índices | ✅ |
| Agregar FKs | ✅ |
| Modificar tipo de columna existente | ❌ |
| Renombrar columnas | ❌ |
| Eliminar columnas | ❌ |
| Eliminar tablas | ❌ |
| Rollback (down) | ❌ |
| Seed data | ❌ |

### Migraciones manuales (cuando AutoMigrate no es suficiente)

Cuando necesitas migraciones versionadas con rollback, usa `golang-migrate/migrate`:

```go
// go get github.com/golang-migrate/migrate/v4
// go get github.com/golang-migrate/migrate/v4/database/postgres
// go get github.com/golang-migrate/migrate/v4/source/file

package migrations

import (
	"embed"
	"log"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed sql/*.sql
var migrationsFS embed.FS

func RunMigrations(databaseURL string) error {
	source, err := iofs.New(migrationsFS, "sql")
	if err != nil {
		return err
	}

	m, err := migrate.NewWithSourceInstance("iofs", source, databaseURL)
	if err != nil {
		return err
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	log.Println("Migraciones ejecutadas")
	return nil
}
```

Con archivos SQL en `migrations/sql/`:

```sql
-- migrations/sql/001_create_users_table.up.sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- migrations/sql/001_create_users_table.down.sql
DROP TABLE IF EXISTS users;
```

### Estrategia híbrida: AutoMigrate + migraciones manuales

```go
// 1. AutoMigrate para desarrollo rápido
if os.Getenv("APP_ENV") == "development" {
    db.AutoMigrate(&User{}, &Post{})
}

// 2. Migraciones versionadas para producción
//    (ejecutadas como paso separado en CI/CD)
// $ migrate -source file://migrations/sql -database $DATABASE_URL up
```

### Seed data

```go
func Seed(db *gorm.DB) {
	// Evitar duplicados en ejecuciones consecutivas
	if db.Migrator().HasTable(&User{}) {
		var count int64
		db.Model(&User{}).Count(&count)
		if count > 0 {
			log.Println("Seed ya ejecutado")
			return
		}
	}

	users := []User{
		{Name: "Admin", Email: "admin@example.com"},
		{Name: "User", Email: "user@example.com"},
	}
	db.Create(&users)
}
```

## Comparativa

| Aspecto | Laravel Migrations | GORM AutoMigrate | golang-migrate |
|---|---|---|---|
| **Crear tabla** | `Schema::create()` | ✅ `db.AutoMigrate()` | SQL `CREATE TABLE` |
| **Modificar columna** | `Schema::table()` + `->change()` | ❌ | SQL `ALTER TABLE` |
| **Eliminar columna** | `->dropColumn()` | ❌ | SQL `ALTER TABLE DROP` |
| **Rollback** | `migrate:rollback` | ❌ | `migrate down` |
| **Versionado** | Nombres con timestamp | ❌ | Archivos `001_*.sql` |
| **Seed** | `DatabaseSeeder` | Manual (`db.Create`) | Manual |
| **Paralelismo seguro** | ✅ (con bloqueos) | ⚠️ (no para prod) | ✅ |
| **Ideal para** | Producción | Desarrollo / prototipos | Producción |

## Errores comunes

1. **Usar AutoMigrate en producción** — `AutoMigrate` no elimina columnas ni renombra campos. Si cambias el nombre de un campo en Go, la columna vieja queda huérfana. En producción, usa migraciones versionadas.
2. **Asumir que AutoMigrate maneja cambios destructivos** — No elimina tablas ni columnas. Si necesitas borrar algo, hazlo manual con `db.Migrator().DropColumn()`.
3. **No versionar las migraciones SQL** — Sin números secuenciales, no sabes qué migraciones se han ejecutado. Usa `golang-migrate` con archivos `001_`, `002_`, etc.
4. **Olvidar el `down.sql`** — Siempre escribe la migración inversa. Te salvará en rollbacks de producción.

## Ejercicio sugerido

> Crea dos modelos: `Author` y `Book` con una relación HasMany/BelongsTo. Ejecuta `AutoMigrate`. Luego agrega un campo `ISBN` a `Book` y vuelve a ejecutar `AutoMigrate`. Verifica que la columna se agregó. Finalmente, escribe una migración SQL manual que agregue una columna `pages INT` y su correspondiente `down.sql`.

## Siguientes pasos

- [Consejos y prácticas con GORM](/gorm/consejos-y-practicas/)
