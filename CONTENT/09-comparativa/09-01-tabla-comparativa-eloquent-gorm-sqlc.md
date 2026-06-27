---
title: "Tabla comparativa: Eloquent vs GORM vs sqlc"
description: "Compara operaciones CRUD entre Eloquent ORM, GORM y sqlc, con árbol de decisión y stack recomendado"
order: 1
section: "09-comparativa"
laravel_url: "https://laravel.com/docs/13.x/eloquent"
go_packages: ["gorm.io/gorm", "github.com/sqlc-dev/sqlc"]
---

# Tabla comparativa: Eloquent vs GORM vs sqlc

**TL;DR** — Eloquent es un ORM completo con Active Record. GORM es su equivalente directo en Go. sqlc genera código Go desde SQL puro. La pregunta no es "cuál es mejor" sino "cuándo usar cada uno".

---

## Tabla: Eloquent → GORM → sqlc

| Operación | Eloquent (Laravel) | GORM | sqlc (SQL + código generado) |
|-----------|--------------------|------|------------------------|
| **Crear** | `User::create([...])` | `db.Create(&user)` | `queries.CreateUser(ctx, params)` |
| **Leer todos** | `User::all()` | `db.Find(&users)` | `queries.ListUsers(ctx)` |
| **Leer por ID** | `User::find($id)` | `db.First(&user, id)` | `queries.GetUser(ctx, id)` |
| **Where** | `User::where('age', '>', 18)->get()` | `db.Where("age > ?", 18).Find(&users)` | `queries.ListAdults(ctx, 18)` |
| **Primero** | `User::where('email', $e)->first()` | `db.Where("email = ?", e).First(&user)` | `queries.GetUserByEmail(ctx, e)` |
| **Actualizar** | `$user->update(['name' => 'x'])` | `db.Model(&user).Update("name", "x")` | `queries.UpdateUserName(ctx, params)` |
| **Eliminar** | `$user->delete()` | `db.Delete(&user)` | `queries.DeleteUser(ctx, id)` |
| **Relación 1:N** | `$user->posts` | `db.Preload("Posts").Find(&user)` | JOIN manual, struct anidada |
| **Relación N:M** | `$user->roles` | `db.Preload("Roles").Find(&user)` | JOIN + tabla pivote manual |
| **Agregación** | `User::avg('age')` | `db.Model(&User{}).Select("AVG(age)").Scan(&avg)` | `SELECT AVG(age) FROM users` |
| **Paginación** | `User::paginate(15)` | `db.Scopes(Paginate(page, 15)).Find(&users)` | `LIMIT $1 OFFSET $2` manual |
| **Transacciones** | `DB::transaction(fn)` | `db.Transaction(func(tx) error { ... })` | `tx, _ := db.BeginTx()` |
| **Migraciones** | `Schema::create(...)` | `db.AutoMigrate(&User{})` | Manual (golang-migrate, goose) |
| **Factory/Seed** | `User::factory()->count(10)->create()` | — (librería externa como `go-faker`) | INSERT manual en seed SQL |
| **Soft deletes** | `SoftDeletes` trait | `gorm.DeletedAt` | `WHERE deleted_at IS NULL` manual |
| **Timestamps** | Automático | `CreatedAt`, `UpdatedAt` | `created_at TIMESTAMP` manual |
| **Validación** | `$request->validate([...])` | Tags `gorm:"not null"` + `validator` | CHECK constraints + código |

## Árbol de decisión

```
¿El proyecto usa SQL puro y tipado?
│
├── SÍ → ¿Necesitas migrations automáticas?
│       ├── SÍ → sqlc + golang-migrate
│       └── NO → sqlc (solo queries)
│
└── NO → ¿El equipo viene de Laravel y quiere ORM?
        ├── SÍ → GORM (Active Record familiar)
        └── NO → sqlc (control total del SQL)

¿Proyecto pequeño (CRUD básico)?
├── SÍ → GORM (rápido de prototipar)
└── NO → sqlc (mantenible a escala)

¿Rendimiento crítico?
├── SÍ → sqlc (sin reflection, SQL directo)
└── NO → GORM (suficiente para 99% de casos)
```

## ¿Se pueden mezclar?

Sí. No es raro ver GORM para CRUD básico y sqlc para queries complejas:

```go
// GORM para operaciones estándar
db.Create(&user)
db.First(&product, id)

// sqlc para reportes pesados con window functions
rows, _ := queries.GetMonthlyReport(ctx, month)
```

Ventajas del híbrido:
- Prototipado rápido con GORM
- Queries críticas con sqlc (optimizadas, tipadas, sin sorpresas)
- Sin acoplamiento forzado a un solo enfoque

Desventajas:
- Dos generadores de schema (migrations de GORM + sqlc queries)
- Curva de aprendizaje doble para el equipo

## Stack recomendado para ex-Laravel devs

### Perfil "Quiero sentirme como en casa"

```
GORM        → ORM (Eloquent feel)
golang-migrate → Migraciones
go-faker    → Seed data
validator   → Validación de structs
```

### Perfil "Quiero SQL explícito y tipado"

```
sqlc        → Queries generadas
golang-migrate → Migraciones
pgx         → Driver PostgreSQL nativo
jet         → (alternativa a sqlc con type-safe query builder)
```

### Perfil híbrido (recomendado)

```
GORM        → CRUD estándar (80% del código)
sqlc        → Reportes, agregaciones, queries complejas (20%)
golang-migrate → Migraciones (único source of truth)
```

## Errores comunes al migrar

1. **Usar GORM como si fuera Eloquent** — GORM no tiene `lazy loading` automático. Si accedes a `user.Posts` sin `Preload("Posts")`, obtienes un slice vacío, no error.
2. **Asumir que sqlc reemplaza GORM** — sqlc solo genera funciones para queries que escribes. No te ayuda con asociaciones dinámicas, scopes, ni hooks de ciclo de vida.
3. **No definir índices** — GORM no crea índices automáticos (salvo PK). En sqlc, los índices van en el schema SQL. Sin índices, los JOIN y WHERE son lentos.
4. **Saltar migraciones con GORM** — `AutoMigrate()` modifica la tabla en producción. En Laravel estás acostumbrado a migraciones versionadas. Usa `golang-migrate` incluso con GORM.

## Buenas prácticas

- Elige un enfoque principal (GORM o sqlc) y usa el otro solo para casos específicos.
- Versiona las migraciones. No uses `AutoMigrate()` en producción.
- En sqlc, una query por función. No hagas una función que haga JOIN de 10 tablas.
- En GORM, usa `Session` con `PrepareStmt` para caché de sentencias preparadas.

## Ejercicio sugerido

> Toma una consulta SQL que hayas escrito en Laravel (un JOIN con WHERE + ORDER BY + LIMIT). Escríbela como query GORM con `Preload` y como query sqlc. Compara la claridad de cada versión.

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
