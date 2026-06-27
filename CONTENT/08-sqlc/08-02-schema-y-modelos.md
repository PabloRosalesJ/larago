---
title: "Schema y modelos generados"
description: "De Eloquent models a structs Go generados desde SQL puro"
order: 2
section: "08-sqlc"
laravel_url: "https://laravel.com/docs/13.x/eloquent"
go_packages: ["database/sql", "github.com/jackc/pgx/v5/pgtype"]
---

# Schema y modelos generados

**TL;DR** — En Laravel defines un modelo PHP con `protected $fillable` y Eloquent infiere el schema de la BD. En sqlc escribes `CREATE TABLE` y obtienes structs Go con tipos exactos, sin reflexión ni magia.

---

## En Laravel

```php
class User extends Model
{
    protected $fillable = ['name', 'email', 'password'];
    protected $hidden = ['password'];
    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_admin' => 'boolean',
    ];
}
```

Eloquent usa **reflexión de la BD en runtime**: lee las columnas de la tabla y las mapea al modelo. Los casts y hidden son decorativos.

## En Go (sqlc)

No hay modelos "inteligentes". sqlc lee tu `CREATE TABLE` y genera un struct plano. Cada columna se convierte en un campo Go con el tipo correspondiente.

### 1. Schema SQL → Structs Go

```sql
-- migrations/000001_create_users.up.sql
CREATE TABLE users (
    id                BIGSERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    email             TEXT NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,
    is_admin          BOOLEAN NOT NULL DEFAULT false,
    email_verified_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Después de `sqlc generate`:

```go
// db/models.go (generado)
type User struct {
    ID              int64            `json:"id"`
    Name            string           `json:"name"`
    Email           string           `json:"email"`
    PasswordHash    string           `json:"password_hash"`
    IsAdmin         bool             `json:"is_admin"`
    EmailVerifiedAt pgtype.Timestamptz `json:"email_verified_at"`
    CreatedAt       pgtype.Timestamptz `json:"created_at"`
    UpdatedAt       pgtype.Timestamptz `json:"updated_at"`
}
```

### 2. Tipos nullable

sqlc maneja nulables de forma estricta, no hay "magia":

| SQL | Go (pgx) | Go (database/sql) |
|-----|----------|-------------------|
| `TEXT NOT NULL` | `string` | `string` |
| `TEXT` (nullable) | `*string` | `sql.NullString` |
| `INTEGER NOT NULL` | `int32` | `int32` |
| `INTEGER` (nullable) | `*int32` | `sql.NullInt32` |
| `BOOLEAN NOT NULL` | `bool` | `bool` |
| `BOOLEAN` (nullable) | `*bool` | `sql.NullBool` |
| `TIMESTAMPTZ NOT NULL` | `pgtype.Timestamptz` | `sql.NullTime` |
| `TIMESTAMPTZ` (nullable) | `pgtype.Timestamptz` | `sql.NullTime` |

**Regla de oro**: si la columna es `NOT NULL`, el campo Go no es nullable. Si es nullable, sqlc usa puntero o `pgtype.*`. No hay "ocultamiento": sabes exactamente qué puede ser `nil`.

### 3. Tags JSON

Con `emit_json_tags: true` en `sqlc.yaml`, los structs incluyen `json:"..."` tags. Puedes controlar el nombre con comentarios en el `CREATE TABLE`:

```sql
CREATE TABLE users (
    id           BIGSERIAL PRIMARY KEY,
    display_name TEXT NOT NULL  -- json: "displayName"
);
```

Esto genera:

```go
DisplayName string `json:"displayName"`
```

### 4. Sobrescribir nombres de structs

Si el nombre de la tabla no te gusta como nombre de struct, usa `sqlc.rename` en `sqlc.yaml`:

```yaml
gen:
  go:
    rename:
      user: "Usuario"
```

Aunque en la práctica: usa nombres en inglés y mantén consistencia. Los structs reflejan las tablas 1:1.

### 5. Structs anidados (no existen)

sqlc genera structs planos. Si haces un JOIN, obtienes un struct plano con todos los campos. Para estructuras anidadas, las armas manualmente en Go (lo cubre 08-05).

## Comparativa: Modelos

| Aspecto | Laravel (Eloquent) | Go + sqlc |
|---------|--------------------|-----------|
| Definición | Clase PHP extiende Model | Struct Go generado |
| Columnas | Inferidas de la BD | Definidas en `CREATE TABLE` |
| Nullables | Atributo `$casts` | `*T`, `sql.Null*`, `pgtype.*` |
| JSON | `$hidden`, `$appends` | Tags JSON en struct |
| Mutadores | `getXAttribute()` | No existe (usar funciones helpers) |
| Runtime | Reflexión en cada request | Compilado, cero overhead |

## Errores comunes al migrar

1. **Error**: Esperar que sqlc "adivine" relaciones o foreign keys como Eloquent.  
   **Solución**: sqlc no sabe nada de relaciones. Escribe JOINs explícitos en SQL.

2. **Error**: Usar `database/sql` con PostgreSQL y esperar `pgtype` features.  
   **Solución**: Configura `sql_package: pgx/v5` si usas PostgreSQL. Si usas `database/sql`, los tipos son `sql.NullString`, no `*string`.

3. **Error**: Poner `DEFAULT` en SQL y esperar que Go lo maneje.  
   **Solución**: El struct generado no tiene valores por defecto. Si haces `INSERT` sin la columna, la BD aplica el DEFAULT. Si la incluyes en el struct, debes setear el valor desde Go.

## Buenas prácticas

- Prefiere `NOT NULL` siempre que sea posible. Los nulables complican el código Go.
- Usa `pgtype` con pgx — maneja timestamps, numeric, UUIDs mejor que `database/sql`.
- No luches contra los nombres: las columnas `snake_case` generan campos `CamelCase`. Aceptalo.
- Versiona `models.go` en git — es código generado pero necesario para compilar.

## Ejercicio sugerido

> Define una tabla `posts` con columnas nullable (`title TEXT NOT NULL`, `body TEXT`, `published_at TIMESTAMPTZ`). Ejecuta `sqlc generate` y escribe un programa que imprima los tipos de cada campo del struct generado.

## Siguientes pasos

- [08-01: Instalación y setup](/sqlc/instalacion-y-setup/)
- [08-03: Queries SELECT](/sqlc/queries-select/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
