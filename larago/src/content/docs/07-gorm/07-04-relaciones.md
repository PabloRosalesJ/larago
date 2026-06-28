---
title: "Relaciones en GORM"
description: "HasMany, BelongsTo, ManyToMany, Preload (eager loading) y polimorfismo en GORM"
order: 4
section: "07-gorm"
laravel_url: "https://laravel.com/docs/13.x/eloquent-relationships"
go_packages: ["gorm.io/gorm"]
---

# Relaciones en GORM

**TL;DR** — Eloquent define relaciones con métodos como `hasMany()`, `belongsTo()`, `belongsToMany()`. GORM usa campos struct con tags (`foreignKey`, `references`) y `Preload` para eager loading.

---

## En Laravel

```php
class User extends Model {
    public function posts() {
        return $this->hasMany(Post::class);
    }
    public function roles() {
        return $this->belongsToMany(Role::class);
    }
}

class Post extends Model {
    public function user() {
        return $this->belongsTo(User::class);
    }
}

// Uso
$user = User::with('posts', 'roles')->find(1);
foreach ($user->posts as $post) { ... }
```

## En Go (GORM)

```go
package main

import (
	"fmt"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// =========================================
// MODELOS
// =========================================

type User struct {
	ID    uint   `gorm:"primaryKey"`
	Name  string `gorm:"not null"`
	Email string `gorm:"uniqueIndex"`

	// HasMany: User tiene muchos Posts
	Posts []Post `gorm:"foreignKey:UserID"`

	// ManyToMany: User tiene muchos Roles (y viceversa)
	Roles []Role `gorm:"many2many:user_roles;"`
}

type Post struct {
	ID      uint   `gorm:"primaryKey"`
	UserID  uint   `gorm:"index;not null"`       // FK explícita
	Title   string `gorm:"not null"`
	Body    string `gorm:"type:text"`

	// BelongsTo: Post pertenece a un User
	User   User   `gorm:"foreignKey:UserID"`     // campo de relación (no columna)
}

type Role struct {
	ID    uint   `gorm:"primaryKey"`
	Name  string `gorm:"unique;not null"`

	// Inversa de ManyToMany (opcional)
	Users []User `gorm:"many2many:user_roles;"`
}

func main() {
	db, err := gorm.Open(sqlite.Open("relations.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	db.AutoMigrate(&User{}, &Post{}, &Role{})

	// =========================================
	// HasMany + BelongsTo: crear datos
	// =========================================

	user := User{Name: "Alice", Email: "alice@example.com"}
	db.Create(&user)

	post1 := Post{Title: "Post 1", Body: "Body 1", UserID: user.ID}
	post2 := Post{Title: "Post 2", Body: "Body 2", UserID: user.ID}
	db.Create(&post1)
	db.Create(&post2)

	// =========================================
	// EAGER LOADING (Preload)
	// Equivalente a User::with('posts')->find(1)
	// =========================================

	var loaded User
	db.Preload("Posts").First(&loaded, user.ID)
	fmt.Printf("User: %s, Posts: %d\n", loaded.Name, len(loaded.Posts))
	for _, p := range loaded.Posts {
		fmt.Printf("  - %s\n", p.Title)
	}

	// Preload anidado: User con Posts, y cada Post con su User
	// db.Preload("Posts.User").First(&loaded, 1)

	// Preload condicional (WHERE en la relación)
	db.Preload("Posts", "title LIKE ?", "Post%").First(&loaded, user.ID)

	// =========================================
	// BelongsTo: cargar el User de un Post
	// =========================================

	var post Post
	db.Preload("User").First(&post, post1.ID)
	fmt.Printf("Post: %s, Autor: %s\n", post.Title, post.User.Name)

	// =========================================
	// ManyToMany
	// =========================================

	admin := Role{Name: "admin"}
	editor := Role{Name: "editor"}
	db.Create(&admin)
	db.Create(&editor)

	// Asignar roles al usuario (GORM maneja la tabla pivote)
	db.Model(&user).Association("Roles").Append(&admin, &editor)

	// Leer usuario con roles
	var uWithRoles User
	db.Preload("Roles").First(&uWithRoles, user.ID)
	fmt.Printf("User: %s, Roles: %d\n", uWithRoles.Name, len(uWithRoles.Roles))
	for _, r := range uWithRoles.Roles {
		fmt.Printf("  - %s\n", r.Name)
	}

	// Reemplazar roles
	db.Model(&user).Association("Roles").Replace(&admin)

	// Quitar un rol
	db.Model(&user).Association("Roles").Delete(&editor)

	// Contar roles
	count := db.Model(&user).Association("Roles").Count()
	fmt.Printf("Roles count: %d\n", count)

	// Limpiar todos los roles
	db.Model(&user).Association("Roles").Clear()

	// =========================================
	// SIN EAGER LOADING (N+1 — evítalo)
	// =========================================

	// Esto genera N+1 queries:
	var users []User
	db.Find(&users)
	for _, u := range users {
		var posts []Post
		db.Where("user_id = ?", u.ID).Find(&posts) // 1 query por usuario
		fmt.Printf("%s: %d posts\n", u.Name, len(posts))
	}
	// Siempre usa Preload() en su lugar.
}

// =========================================
// POLYMORPHISM (equivalente a morphMany/morphTo)
// =========================================

type Comment struct {
	ID        uint   `gorm:"primaryKey"`
	Body      string `gorm:"type:text"`
	CommentableID   uint   `gorm:"index;column:commentable_id"`
	CommentableType string `gorm:"index;column:commentable_type;size:100"`
}

type Article struct {
	ID       uint   `gorm:"primaryKey"`
	Title    string
	Comments []Comment `gorm:"polymorphic:Commentable;"`
}

type Photo struct {
	ID       uint   `gorm:"primaryKey"`
	URL      string
	Comments []Comment `gorm:"polymorphic:Commentable;"`
}

func polymorphicExample(db *gorm.DB) {
	article := Article{Title: "Polymorphism in GORM"}
	db.Create(&article)

	comment := Comment{Body: "Great article!", CommentableID: article.ID, CommentableType: "articles"}
	db.Create(&comment)

	var loaded Article
	db.Preload("Comments").First(&loaded, article.ID)
	fmt.Printf("Article: %s, Comments: %d\n", loaded.Title, len(loaded.Comments))
}
```

### Resumen de tags de relación

| Relación | Tag en GORM | Ejemplo |
|---|---|---|
| **HasMany** | `gorm:"foreignKey:UserID"` | `Posts []Post gorm:"foreignKey:UserID"` |
| **BelongsTo** | `gorm:"foreignKey:UserID"` | `User User gorm:"foreignKey:UserID"` |
| **ManyToMany** | `gorm:"many2many:table_name;"` | `Roles []Role gorm:"many2many:user_roles;"` |
| **Polymorphic** | `gorm:"polymorphic:Commentable;"` | `Comments []Comment gorm:"polymorphic:Commentable;"` |

## Comparativa

| Concepto | Eloquent | GORM |
|---|---|---|
| **HasMany** | `$this->hasMany(Post::class)` | Campo `[]Post` + `gorm:"foreignKey:UserID"` |
| **BelongsTo** | `$this->belongsTo(User::class)` | Campo `User` + `gorm:"foreignKey:UserID"` |
| **ManyToMany** | `$this->belongsToMany(Role::class)` | Campo `[]Role` + `gorm:"many2many:user_roles;"` |
| **FK implícita** | `user_id` (convención) | `UserID` (convención) o tag explícito |
| **Eager loading** | `->with('posts')` | `.Preload("Posts")` |
| **Eager anidado** | `->with('posts.user')` | `.Preload("Posts.User")` |
| **Condición en relación** | `->with(['posts' => fn($q) => ...])` | `.Preload("Posts", "title LIKE ?", ...)` |
| **Polymorphic** | `morphMany()` | Tag `polymorphic:"Commentable"` |
| **Tabla pivote** | Automática (`role_user`) | Tag `many2many:user_roles` |

## Errores comunes

1. **Olvidar la FK en el modelo "hijo"** — En BelongsTo, la FK (`UserID`) debe existir como campo en el struct `Post`. Sin ella, GORM no sabe cómo unir las tablas.
2. **Preload sin puntero en el slice** — `db.Preload("Posts").Find(&users)` requiere `var users []User`. Sin `&`, falla silenciosamente.
3. **Muchos a muchos sin tag `many2many:`** — Si no especificas el nombre de la tabla pivote, GORM usará la convención, pero es mejor ser explícito.
4. **No usar `Preload` en listados** — Hacer `db.Find(&users)` y luego `db.Where("user_id = ?", u.ID).Find(&posts)` en un bucle es el clásico N+1. Siempre usa `Preload`.

## Ejercicio sugerido

> Define los modelos `Category` (HasMany → Products) y `Product` (BelongsTo → Category). Agrega una relación ManyToMany entre `Product` y `Tag`. Inserta datos de ejemplo y usa `Preload` para obtener un Category con todos sus Products y Tags en una sola consulta.

## Siguientes pasos

- [Hooks y eventos en GORM](/gorm/hooks-y-eventos/)
