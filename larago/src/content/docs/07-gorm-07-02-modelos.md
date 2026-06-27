---
title: "Modelos en GORM"
description: "Define modelos en GORM con struct tags, convenciones, primary keys, timestamps y soft deletes"
order: 2
section: "07-gorm"
laravel_url: "https://laravel.com/docs/13.x/eloquent#defining-models"
go_packages: ["gorm.io/gorm", "gorm.io/plugin/soft_delete"]
---

# Modelos en GORM

**TL;DR** — En Eloquent los modelos heredan de `Model` y usan propiedades protegidas (`$table`, `$fillable`). En GORM defines structs de Go con tags `gorm:""` y sin herencia.

---

## En Laravel

```php
class User extends Model
{
    protected $table = 'usuarios';          // Nombre de tabla
    protected $primaryKey = 'user_id';      // PK personalizada
    public $timestamps = true;              // created_at, updated_at
    protected $fillable = ['name', 'email']; // Mass assignment
    protected $hidden = ['password'];        // Ocultar en JSON

    protected $casts = [
        'is_admin' => 'boolean',
        'metadata' => 'array',
    ];
}
```

Eloquent usa convenciones: clase `User` → tabla `users`, PK `id`, timestamps automáticos, etc.

## En Go (GORM)

```go
package model

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/plugin/soft_delete"
)

// User mapea la tabla "usuarios"
type User struct {
	UserID    uint           `gorm:"primaryKey;column:user_id"`
	Name      string         `gorm:"column:name;type:varchar(255);not null"`
	Email     string         `gorm:"column:email;uniqueIndex;not null"`
	Password  string         `gorm:"column:password;type:varchar(255)"`
	IsAdmin   bool           `gorm:"column:is_admin;default:false"`
	Metadata  string         `gorm:"column:metadata;type:jsonb"`
	CreatedAt time.Time      `gorm:"column:created_at"`
	UpdatedAt time.Time      `gorm:"column:updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"column:deleted_at;index"` // Soft delete

	// Relaciones (se ven en 07-04)
	Posts []Post `gorm:"foreignKey:UserID"`
}

// TableName sobreescribe la convención (equivalente a $table)
func (User) TableName() string {
	return "usuarios"
}

// Post es un modelo relacionado
type Post struct {
	ID        uint      `gorm:"primaryKey;column:id"`
	UserID    uint      `gorm:"column:user_id;index;not null"`
	Title     string    `gorm:"column:title;type:varchar(255);not null"`
	Body      string    `gorm:"column:body;type:text"`
	Published bool      `gorm:"column:published;default:false"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}
```

### Convenciones vs explícito

| Concepto | Eloquent (por defecto) | GORM (por defecto) | Cómo cambiarlo en GORM |
|---|---|---|---|
| **Tabla** | `User` → `users` | `User` → `users` (snake_case plural) | `func (User) TableName() string` |
| **PK** | `id` | `ID` o `Id` | Tag `gorm:"primaryKey;column:user_id"` |
| **Timestamps** | `created_at`, `updated_at` | `CreatedAt`, `UpdatedAt` | Campo con ese nombre, o tag |
| **Soft delete** | `deleted_at` (con trait) | `gorm.DeletedAt` | Campo `DeletedAt gorm.DeletedAt` |
| **Fillable** | `$fillable = [...]` | **No hay mass-assignment** | Usas `db.Select()` o struct explícita |
| **Hidden** | `$hidden = [...]` | `json:"-"` tag de Go | `json:"-"` en el campo |

### Tags más usados

```go
type Ejemplo struct {
	ID        uint      `gorm:"primaryKey"`
	Nombre    string    `gorm:"type:varchar(100);not null"`
	Slug      string    `gorm:"uniqueIndex;size:150"`
	Contador  int       `gorm:"default:0"`
	Precio    float64   `gorm:"type:decimal(10,2)"`
	Activo    bool      `gorm:"default:true"`
	JSONData  string    `gorm:"type:jsonb"`
	Ignorado  string    `gorm:"-"`                    // No se mapea a columna
}
```

### `gorm.Model` (embedded)

GORM provee un struct base opcional:

```go
type Model struct {
	ID        uint           `gorm:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// Úsalo embebido:
type User struct {
	gorm.Model
	Name  string
	Email string
}
```

No es obligatorio. Si quieres control total, define tus propios campos.

## Comparativa

| Concepto | Eloquent | GORM |
|---|---|---|
| **Definir modelo** | `class User extends Model` | `type User struct { ... }` |
| **Nombre de tabla** | `protected $table = 'x'` | `func (User) TableName() string` |
| **Primary key** | `protected $primaryKey = 'x'` | Tag `gorm:"primaryKey;column:x"` |
| **Timestamps** | `public $timestamps = true` | Campos `CreatedAt` / `UpdatedAt` |
| **Soft delete** | `use SoftDeletes` | Campo `DeletedAt gorm.DeletedAt` |
| **Mass assignment** | `$fillable` | No existe; pasas struct completa |
| **Cast de tipos** | `$casts = ['x' => 'boolean']` | Tipo Go nativo (`bool`, `float64`) |
| **Ocultar campos** | `$hidden = ['password']` | Tag `json:"-"` |

## Errores comunes

1. **Olvidar `TableName()` para tablas no convencionales** — Si tu tabla se llama `user` (singular) y tu struct `User`, GORM buscará `users`. Implementa `TableName()`.
2. **Confundir `columna` con `column`** — El tag es `gorm:"column:nombre"`, no `columna`.
3. **No usar `gorm.DeletedAt`** — Usar `*time.Time` para soft delete funciona, pero `gorm.DeletedAt` implementa la interfaz correcta. Usa el tipo oficial.
4. **Campos sin tag `json:"-"` para contraseñas** — Si no pones `json:"-"`, la contraseña se serializa en respuestas JSON. Explicítalo.

## Ejercicio sugerido

> Define un modelo `Category` con campos: ID (uint), Name (string, unique), Slug (string, unique index), Description (text, nullable), CreatedAt, UpdatedAt. Implementa `TableName()` para que use la tabla `categorias`. Agrega `json:"-"` a cualquier campo que no deba exponerse.

## Siguientes pasos

- [CRUD básico con GORM](/gorm/crud-basico/)
