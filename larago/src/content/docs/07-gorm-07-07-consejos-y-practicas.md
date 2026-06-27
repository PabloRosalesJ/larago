---
title: "Consejos y prácticas con GORM"
description: "N+1, transacciones, performance, Raw SQL, y buenas prácticas para usar GORM en producción"
order: 7
section: "07-gorm"
laravel_url: "https://laravel.com/docs/13.x/eloquent"
go_packages: ["gorm.io/gorm"]
---

# Consejos y prácticas con GORM

**TL;DR** — GORM es productivo pero puede esconder N+1, transacciones mal manejadas y queries lentas. Aplica estas prácticas para llevar GORM a producción con confianza.

---

## En Laravel

```php
// N+1: Eloquent lo previene con ->with()
$users = User::with('posts')->get();

// Transacciones
DB::transaction(function () {
    User::create([...]);
    Post::create([...]);
});

// Raw SQL
DB::select('SELECT * FROM users WHERE id = ?', [1]);
```

## En Go (GORM)

### 1. Prevenir N+1

Siempre usa `Preload` cuando sepas que vas a necesitar relaciones:

```go
// MAL — N+1: 1 query para usuarios + N queries para posts
var users []User
db.Find(&users)
for i := range users {
    db.Model(&users[i]).Association("Posts").Find(&users[i].Posts)
}

// BIEN — 2 queries totales (1 users + 1 posts WHERE user_id IN (...))
var users []User
db.Preload("Posts").Find(&users)

// MEJOR — Joins para relaciones simples (1 query)
type UserWithPostCount struct {
    User
    PostCount int
}
var results []UserWithPostCount
db.Model(&User{}).
    Select("users.*, COUNT(posts.id) as post_count").
    Joins("LEFT JOIN posts ON posts.user_id = users.id").
    Group("users.id").
    Scan(&results)
```

### 2. Transacciones

```go
// Transacción explícita (equivalente a DB::transaction())
err := db.Transaction(func(tx *gorm.DB) error {
    if err := tx.Create(&user).Error; err != nil {
        return err // rollback automático
    }
    if err := tx.Create(&post).Error; err != nil {
        return err // rollback
    }
    return nil // commit
})
if err != nil {
    log.Fatal(err)
}

// Transacción manual (más control)
tx := db.Begin()
user := User{Name: "Alice", Email: "alice@example.com"}
if err := tx.Create(&user).Error; err != nil {
    tx.Rollback()
    return
}
post := Post{Title: "Post 1", UserID: user.ID}
if err := tx.Create(&post).Error; err != nil {
    tx.Rollback()
    return
}
tx.Commit()
```

### 3. Performance: cuándo usar Raw SQL

GORM traduce todo a SQL, pero para consultas complejas el overhead no vale la pena:

```go
// USAR GORM para CRUD simple
db.Where("email = ?", email).First(&user)
db.Model(&user).Update("name", "New Name")

// USAR RAW SQL para:
// - Joins complejos con agregaciones
// - CTEs (WITH ... AS)
// - Queries con muchas condiciones dinámicas
// - Ventanas (ROW_NUMBER, RANK)
// - Bulk updates/inserts masivos

type DashboardRow struct {
    UserID     uint
    UserName   string
    TotalPosts int64
    LastPostAt *time.Time
}

var dashboard []DashboardRow
db.Raw(`
    SELECT
        u.id AS user_id,
        u.name AS user_name,
        COUNT(p.id) AS total_posts,
        MAX(p.created_at) AS last_post_at
    FROM users u
    LEFT JOIN posts p ON p.user_id = u.id
    WHERE u.active = ?
    GROUP BY u.id, u.name
    HAVING COUNT(p.id) > ?
    ORDER BY total_posts DESC
`, true, 5).Scan(&dashboard)

// Bulk insert (1000 registros)
users := make([]User, 1000)
// ... llenar slice ...
db.CreateInBatches(&users, 100) // inserts de 100 en 100
```

### 4. Configuración de sesión

```go
// Desactivar logger ruidoso en producción
db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
    Logger: logger.Default.LogMode(logger.Warn), // solo warnings y errores
    SkipDefaultTransaction: true,  // evita transacción innecesaria en Create/Save
    PrepareStmt: true,              // cachea prepared statements
})
```

### 5. Scopes reutilizables

```go
// Scopes: como query scopes en Eloquent
func ActiveUser(db *gorm.DB) *gorm.DB {
    return db.Where("active = ?", true)
}

func RecentUsers(days int) func(db *gorm.DB) *gorm.DB {
    return func(db *gorm.DB) *gorm.DB {
        return db.Where("created_at > ?", time.Now().AddDate(0, 0, -days))
    }
}

// Uso
var users []User
db.Scopes(ActiveUser, RecentUsers(7)).Find(&users)
```

### 6. Conexiones separadas para lecturas (Read Replica)

```go
db, err := gorm.Open(postgres.New(postgres.Config{
    DSN: "host=primary-db ...",
}), &gorm.Config{})

// Registrar réplica para lecturas
replica, err := gorm.Open(postgres.New(postgres.Config{
    DSN: "host=replica-db ...",
}), &gorm.Config{})

db = db.Session(&gorm.Session{})
// Asignar réplica
db.Callback().Query().Before("gorm:query").Register("use_replica", func(d *gorm.DB) {
    d.Statement.ConnPool = replica.ConnPool
})
```

### 7. Serialización correcta

```go
type User struct {
    ID       uint   `gorm:"primaryKey"`
    Name     string `gorm:"not null"`
    Password string `gorm:"not null" json:"-"` // NUNCA en JSON
    Posts    []Post `gorm:"foreignKey:UserID" json:"posts,omitempty"`
}

// Usa DTOs para respuestas API (no expongas modelos directamente)
type UserResponse struct {
    ID   uint   `json:"id"`
    Name string `json:"name"`
}

func ToUserResponse(u *User) UserResponse {
    return UserResponse{ID: u.ID, Name: u.Name}
}
```

## Comparativa

| Práctica | Laravel / Eloquent | GORM |
|---|---|---|
| **Eager loading** | `->with('posts')` | `.Preload("Posts")` |
| **Transacciones** | `DB::transaction(function() {...})` | `db.Transaction(func(tx *gorm.DB) error {...})` |
| **Query scopes** | `scopeActive()` en modelo | `db.Scopes(ActiveUser)` |
| **Raw SQL** | `DB::select('...', [$params])` | `db.Raw('...', params).Scan(&result)` |
| **Bulk insert** | `insert()` con array | `db.CreateInBatches(&items, 100)` |
| **Read replicas** | Config en `database.php` | `Callback().Query().Before(...)` manual |
| **DTOs** | `API Resource` / `$hidden` | Struct separado + `json:"-"` |
| **Prepared stmts** | Automático (PDO) | `PrepareStmt: true` en config |
| **Logger** | `DB::enableQueryLog()` | `logger.Default.LogMode(logger.Info)` |

## Errores comunes

1. **No usar `Preload` en listados** — El error más común. Siempre que devuelvas una lista de modelos con relaciones, usa `Preload` para evitar N+1.
2. **Abusar de GORM para consultas complejas** — Si tu query tiene 3 joins, subqueries y agregaciones, escribe Raw SQL. GORM no mejora la legibilidad ahí.
3. **No cerrar `sqlDB` al terminar** — `sqlDB, _ := db.DB()` y olvidar `defer sqlDB.Close()` causa leaks de conexiones.
4. **Serializar modelos directamente a JSON** — Expones contraseñas, hashes, y metadatos internos. Siempre usa DTOs.
5. **No usar transacciones en operaciones multi-tabla** — Si creas un User y un Post relacionado sin transacción, un fallo a medio camino deja datos huérfanos.

## Buenas prácticas

- Usa `Preload` por defecto, `Joins` cuando necesites una sola query, Raw SQL para reportes complejos.
- Define DTOs separados para respuestas API. No serialices modelos directamente.
- Configura `SkipDefaultTransaction: true` y `PrepareStmt: true` en producción.
- Envuelve operaciones multi-tabla en `db.Transaction()`.
- Usa `db.Scopes()` para condiciones reutilizables (active, recent, etc.).
- No uses `AutoMigrate` en producción; usa migraciones versionadas con `golang-migrate`.
- Mide el rendimiento con `SlowThreshold` en el logger para detectar queries lentas.

## Ejercicio sugerido

> Toma el modelo `Order` con relación `OrderItem`. Implementa un endpoint que: 1) cree una orden con 3 items dentro de una transacción, 2) use `Preload` para devolver la orden con sus items, 3) exponga solo los campos necesarios mediante un DTO `OrderResponse`. Si algún item falla al crearse, la transacción debe revertir toda la orden.

## Siguientes pasos

- [sqlc: alternativa a Query Builder](/sqlc/instalacion-y-setup/)
- [Comparativa Eloquent ↔ GORM ↔ sqlc](/comparativa/tabla-comparativa-eloquent-gorm-sqlc/)
