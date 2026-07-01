---
title: "Hooks y eventos en GORM"
description: "Ciclo de vida de modelos en GORM: BeforeCreate, AfterFind, BeforeSave y su equivalencia con Eloquent boot()"
order: 5
section: "07-gorm"
laravel_url: "https://laravel.com/docs/13.x/eloquent#events"
go_packages: ["gorm.io/gorm"]
---

# Hooks y eventos en GORM

**TL;DR** — Eloquent dispone de `boot()` y `static::creating()` para interceptar el ciclo de vida. GORM usa métodos con nombre fijo (`BeforeCreate`, `AfterFind`) implementados directamente en el modelo.

---

## En Laravel

```php
class User extends Model
{
    protected static function booted()
    {
        // Antes de crear
        static::creating(function ($user) {
            $user->uuid = (string) Str::uuid();
        });

        // Después de crear
        static::created(function ($user) {
            Log::info("Usuario creado: {$user->email}");
        });
    }

    // O直接在 el modelo:
    public static function boot()
    {
        parent::boot();
        static::saving(function ($user) {
            $user->name = ucfirst($user->name);
        });
    }
}
```

Eloquent eventos: `retrieved`, `creating`, `created`, `updating`, `updated`, `saving`, `saved`, `deleting`, `deleted`.

## En Go (GORM)

GORM usa interfaces implícitas. Tu modelo implementa métodos con nombre fijo y GORM los llama automáticamente:

```go
package model

import (
	"log"
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID        uint   `gorm:"primaryKey"`
	UUID      string `gorm:"uniqueIndex;size:36"`
	Name      string
	Email     string `gorm:"uniqueIndex"`
	Status    string `gorm:"default:pending"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// =========================================
// HOOKS — GORM llama estos métodos automáticamente
// =========================================

// BeforeCreate — Equivalente a static::creating()
func (u *User) BeforeCreate(tx *gorm.DB) error {
	// Generar UUID si no existe
	if u.UUID == "" {
		u.UUID = generateUUID() // tu función de UUID
	}
	// Normalizar email a minúsculas
	u.Email = lower(u.Email)
	// No permitir usuarios duplicados por lógica de negocio
	var count int64
	tx.Model(&User{}).Where("email = ?", u.Email).Count(&count)
	if count > 0 {
		return gorm.ErrDuplicatedKey
	}
	return nil
}

// BeforeSave — Equivalente a static::saving() (se ejecuta en Create y Update)
func (u *User) BeforeSave(tx *gorm.DB) error {
	// Capitalizar nombre
	if len(u.Name) > 0 {
		u.Name = capitalize(u.Name)
	}
	return nil
}

// AfterCreate — Equivalente a static::created()
func (u *User) AfterCreate(tx *gorm.DB) error {
	log.Printf("Usuario creado: %s (%s)", u.Name, u.Email)

	// Ejemplo: crear registro de auditoría
	audit := AuditLog{
		Action:     "user_created",
		EntityType: "users",
		EntityID:   u.ID,
	}
	return tx.Create(&audit).Error
}

// AfterFind — Equivalente a retrieved
func (u *User) AfterFind(tx *gorm.DB) error {
	// Transformar datos después de leer
	u.Email = obfuscateEmail(u.Email) // ofuscar para logs
	return nil
}

// BeforeUpdate — Equivalente a static::updating()
func (u *User) BeforeUpdate(tx *gorm.DB) error {
	if u.Status == "banned" && u.ID == 1 {
		return gorm.ErrCheckConstraintViolation // no permitir banear al admin
	}
	return nil
}

// BeforeDelete — Equivalente a static::deleting()
func (u *User) BeforeDelete(tx *gorm.DB) error {
	if u.Status == "admin" {
		return gorm.ErrCheckConstraintViolation
	}
	return nil
}

// AfterDelete — Equivalente a static::deleted()
func (u *User) AfterDelete(tx *gorm.DB) error {
	log.Printf("Usuario eliminado ID=%d", u.ID)
	return nil
}

// =========================================
// HELPERS (simulados)
// =========================================

func generateUUID() string {
	return "550e8400-e29b-41d4-a716-446655440000" // placeholder
}

func lower(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'A' && c <= 'Z' {
			b[i] = c + 32
		}
	}
	return string(b)
}

func capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	b := []byte(s)
	if b[0] >= 'a' && b[0] <= 'z' {
		b[0] = b[0] - 32
	}
	return string(b)
}

func obfuscateEmail(email string) string {
	if len(email) < 3 {
		return email
	}
	return email[:1] + "***@" + email[emailIndex(email)+1:]
}

func emailIndex(s string) int {
	for i, c := range s {
		if c == '@' {
			return i
		}
	}
	return -1
}

// =========================================
// AUDIT LOG
// =========================================

type AuditLog struct {
	ID         uint   `gorm:"primaryKey"`
	Action     string `gorm:"not null"`
	EntityType string `gorm:"not null"`
	EntityID   uint   `gorm:"not null"`
}
```

### Todos los hooks disponibles

| Hook | Momento | Equivalente Eloquent |
|---|---|---|
| `BeforeSave` | Antes de INSERT o UPDATE | `saving` |
| `AfterSave` | Después de INSERT o UPDATE | `saved` |
| `BeforeCreate` | Antes de INSERT | `creating` |
| `AfterCreate` | Después de INSERT | `created` |
| `BeforeUpdate` | Antes de UPDATE | `updating` |
| `AfterUpdate` | Después de UPDATE | `updated` |
| `BeforeDelete` | Antes de DELETE | `deleting` |
| `AfterDelete` | Después de DELETE | `deleted` |
| `AfterFind` | Después de SELECT | `retrieved` |

### Hook global (para todos los modelos)

GORM también permite hooks a nivel de sesión:

```go
// Se ejecuta en cada consulta
db.Callback().Create().Before("gorm:create").Register("before_create_hook", func(db *gorm.DB) {
	log.Printf("Creando registro en tabla: %s", db.Statement.Table)
})
```

## Comparativa

| Concepto | Eloquent | GORM |
|---|---|---|
| **Antes de crear** | `static::creating(...)` | `func (u *User) BeforeCreate(tx *gorm.DB) error` |
| **Después de crear** | `static::created(...)` | `func (u *User) AfterCreate(tx *gorm.DB) error` |
| **Antes de guardar** | `static::saving(...)` | `func (u *User) BeforeSave(tx *gorm.DB) error` |
| **Después de leer** | `static::retrieved(...)` | `func (u *User) AfterFind(tx *gorm.DB) error` |
| **Antes de eliminar** | `static::deleting(...)` | `func (u *User) BeforeDelete(tx *gorm.DB) error` |
| **Detener operación** | `return false` en el callback | `return error` (gorm.ErrX) |
| **Hook global** | `Provider::register()` en `AppServiceProvider` | `db.Callback().Create().Before(...)` |
| **Registro** | Con closures en `booted()` | Métodos en el struct (sin registro explícito) |

## Errores comunes

1. **Devolver `nil` cuando hay error** — Si `BeforeCreate` devuelve `nil`, la operación continúa. Devuelve un error para abortarla.
2. **Hook no se ejecuta en batch** — `BeforeCreate` no se ejecuta en `db.Create(&users)` con slice si no se usa `CreateInBatches`. Verifica la documentación.
3. **Olvidar el puntero receptor** — Los hooks deben tener receptor puntero (`*User`), no valor (`User`). GORM ignora hooks con receptor por valor.
4. **Hooks que modifican `tx` esperando cambios en DB** — Los hooks reciben la transacción actual. Si haces consultas dentro de un hook, usa el `tx` recibido para participar en la misma transacción.

## Ejercicio sugerido

> Agrega un hook `BeforeCreate` al modelo `Product` que: genere un `Slug` a partir del `Name`, convierta a minúsculas y reemplace espacios por guiones. Impide la creación si el slug ya existe. Agrega un `AfterCreate` que registre en un log "Producto creado: <slug>".

## Siguientes pasos

- [Migraciones con GORM](/gorm/migraciones-gorm/)
