---
title: "CRUD básico con GORM"
description: "Create, Read, Update y Delete con GORM: First, Find, Where, Updates, Delete y soft delete"
order: 3
section: "07-gorm"
laravel_url: "https://laravel.com/docs/13.x/eloquent#inserting-and-updating-models"
go_packages: ["gorm.io/gorm"]
---

# CRUD básico con GORM

**TL;DR** — Eloquent usa `User::create()`, `User::find()`, `$user->update()`, `$user->delete()`. GORM usa `db.Create()`, `db.First()`, `db.Model().Update()`, `db.Delete()`.

---

## En Laravel

```php
// CREATE
$user = User::create(['name' => 'Alice', 'email' => 'alice@example.com']);

// READ
$user = User::find(1);
$user = User::where('email', 'alice@example.com')->first();
$users = User::where('active', true)->get();
$users = User::paginate(15);

// UPDATE
$user = User::find(1);
$user->update(['name' => 'Bob']);

User::where('active', false)->update(['active' => true]);

// DELETE
$user = User::find(1);
$user->delete();            // Soft delete si tiene SoftDeletes
User::find(1)->forceDelete(); // Hard delete
```

## En Go (GORM)

```go
package main

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type User struct {
	ID        uint      `gorm:"primaryKey"`
	Name      string    `gorm:"not null"`
	Email     string    `gorm:"uniqueIndex;not null"`
	Active    bool      `gorm:"default:true"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

func main() {
	db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	db.AutoMigrate(&User{})

	// =========================================
	// CREATE
	// =========================================

	// Create individual
	user := User{Name: "Alice", Email: "alice@example.com"}
	result := db.Create(&user)
	if result.Error != nil {
		log.Fatal(result.Error)
	}
	fmt.Printf("Creado ID=%d, filas afectadas=%d\n", user.ID, result.RowsAffected)

	// Create con campos específicos (como $fillable)
	db.Select("Name", "Email").Create(&User{Name: "Bob", Email: "bob@example.com", Active: false})

	// Batch insert
	users := []User{
		{Name: "Charlie", Email: "charlie@example.com"},
		{Name: "Diana", Email: "diana@example.com"},
	}
	db.Create(&users)

	// =========================================
	// READ
	// =========================================

	var read User

	// Por ID (equivalente a User::find(1))
	db.First(&read, 1)
	fmt.Printf("First by ID: %+v\n", read)

	// Primero que cumple condición (equivalente a ->where()->first())
	db.Where("email = ?", "alice@example.com").First(&read)
	fmt.Printf("First by email: %+v\n", read)

	// Múltiples condiciones
	db.Where("active = ? AND name LIKE ?", true, "A%").First(&read)

	// Todos los registros (equivalente a User::all())
	var allUsers []User
	db.Find(&allUsers)
	fmt.Printf("Total usuarios: %d\n", len(allUsers))

	// Where con slice
	var activeUsers []User
	db.Where("active = ?", true).Find(&activeUsers)

	// Paginación (equivalente a ->paginate(10))
	var page []User
	db.Scopes(Paginate(1, 10)).Find(&page)
	fmt.Printf("Página 1: %d usuarios\n", len(page))

	// Ordenar y limitar
	db.Order("created_at desc").Limit(5).Find(&page)

	// =========================================
	// UPDATE
	// =========================================

	// Update campos individuales (equivalente a $user->update())
	db.Model(&read).Update("name", "Alice Updated")

	// Update múltiples campos
	db.Model(&read).Updates(User{Name: "Alice v2", Active: true})

	// Update con mapa (útil para campos dinámicos)
	db.Model(&read).Updates(map[string]interface{}{
		"name":   "Alice v3",
		"active": false,
	})

	// Update condicional (equivalente a User::where(...)->update(...))
	db.Model(&User{}).Where("active = ?", false).Update("active", true)

	// Save: guarda todos los campos (equivalente a $user->save())
	read.Name = "Alice Save"
	db.Save(&read)

	// =========================================
	// DELETE
	// =========================================

	// Soft delete (si el modelo tiene DeletedAt)
	db.Delete(&read, 1)

	// Hard delete (equivalente a forceDelete())
	db.Unscoped().Delete(&read, 1)

	// Delete condicional
	db.Where("active = ?", false).Delete(&User{})
}

// Helper de paginación
func Paginate(page, pageSize int) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if page < 1 {
			page = 1
		}
		if pageSize < 1 {
			pageSize = 10
		}
		offset := (page - 1) * pageSize
		return db.Offset(offset).Limit(pageSize)
	}
}
```

### Manejo de errores

GORM no lanza panic. Todas las operaciones devuelven `*gorm.DB` con `Error` y `RowsAffected`:

```go
result := db.Where("email = ?", "noexiste@example.com").First(&user)
if result.Error != nil {
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		// No encontrado — no es necesariamente error
	} else {
		// Error real de DB
		log.Fatal(result.Error)
	}
}
```

## Comparativa

| Operación | Eloquent | GORM |
|---|---|---|
| **Create** | `User::create([...])` | `db.Create(&user)` |
| **Create selectivo** | `$fillable` automático | `db.Select("Name","Email").Create(...)` |
| **Find por ID** | `User::find(1)` | `db.First(&user, 1)` |
| **First where** | `User::where(...)->first()` | `db.Where(...).First(&user)` |
| **Get all** | `User::all()` | `db.Find(&users)` |
| **Where** | `User::where('x', $val)->get()` | `db.Where("x = ?", val).Find(&users)` |
| **Paginación** | `User::paginate(15)` | `db.Scopes(Paginate(p, s)).Find(&users)` |
| **Update** | `$user->update([...])` | `db.Model(&user).Updates(...)` |
| **Update condicional** | `User::where(...)->update([...])` | `db.Model(&User{}).Where(...).Update(...)` |
| **Save full** | `$user->save()` | `db.Save(&user)` |
| **Delete** | `$user->delete()` | `db.Delete(&user)` |
| **Hard delete** | `$user->forceDelete()` | `db.Unscoped().Delete(&user)` |
| **Verificar existencia** | `User::find(1) ?? null` | `errors.Is(result.Error, gorm.ErrRecordNotFound)` |
| **Filas afectadas** | No expuesto directamente | `result.RowsAffected` |

## Errores comunes

1. **No verificar `gorm.ErrRecordNotFound`** — `First()` devuelve error si no encuentra. No es fallo de DB, es "no hay registro". Distingue con `errors.Is(result.Error, gorm.ErrRecordNotFound)`.
2. **Usar `Save()` cuando quieres `Updates()`** — `Save()` escribe **todos** los campos, incluyendo cero-valores. `Updates()` solo escribe los campos no-cero del struct.
3. **Olvidar `&` en Create/Find** — `db.Create(user)` sin `&` no modifica el struct original. Siempre pasa puntero.
4. **Actualizar con struct incluye cero-valores** — `db.Model(&u).Updates(User{Name: ""})` no actualizará Name porque es cero-valor. Usa `map[string]interface{}` cuando necesites setear a cero.

## Ejercicio sugerido

> Implementa un CRUD completo para `Product` (ID, Name, Price, Stock, CategoryID). Escribe funciones: `CreateProduct`, `GetProduct`, `ListProducts` (con paginación), `UpdatePrice`, `DeleteProduct` (soft delete). Verifica `ErrRecordNotFound` en `GetProduct`.

## Siguientes pasos

- [Relaciones en GORM](/gorm/relaciones/)
