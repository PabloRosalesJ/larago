---
title: "Instalación y setup de sqlc"
description: "De artisan migrate a sqlc generate: configura tu generación de código SQL"
order: 1
section: "08-sqlc"
laravel_url: "https://laravel.com/docs/13.x/migrations"
go_packages: ["github.com/sqlc-dev/sqlc", "github.com/golang-migrate/migrate"]
---

# Instalación y setup de sqlc

**TL;DR** — sqlc reemplaza el ORM (Eloquent) y el Query Builder de Laravel. En lugar de generar migraciones PHP, escribes SQL puro y sqlc genera structs y funciones Go tipadas. Es como tener `php artisan make:model` + `make:migration` pero sin ORM.

---

## En Laravel

Laravel usa migraciones PHP para definir el schema:

```php
// database/migrations/xxxx_create_users_table.php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->timestamps();
});
```

Luego ejecutas `php artisan migrate` y Eloquent te da modelos con `User::find()`, `User::where()`, etc. Todo es runtime: no hay generación de código, hay reflexión de la base de datos en caliente.

## En Go (sqlc)

sqlc lee archivos `.sql` (schema + queries) y genera código Go **en tiempo de compilación**. No hay reflexión, no hay runtime magic. Lo que escribes en SQL es exactamente lo que se ejecuta.

### 1. Instalar sqlc

```bash
# macOS
brew install sqlc

# Go install (cualquier SO)
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest

# Linux (binary)
curl -L https://github.com/sqlc-dev/sqlc/releases/download/v1.28.0/sqlc_1.28.0_linux_amd64.tar.gz | tar xz
```

### 2. Estructura de directorios

```
project/
├── sqlc.yaml                  # Configuración de sqlc
├── migrations/                # Migraciones (golang-migrate)
│   └── 000001_create_users.up.sql
├── queries/                   # Queries .sql que lee sqlc
│   └── user.sql
└── db/                        # Código generado por sqlc
    ├── models.go
    └── query.sql.go
```

### 3. Configurar `sqlc.yaml`

```yaml
version: "2"
sql:
  - engine: "postgresql"        # o "mysql", "sqlite"
    schema: "migrations/"       # o "schema/"
    queries: "queries/"
    gen:
      go:
        package: "db"
        out: "db"
        sql_package: "pgx/v5"   # usa pgx en vez de database/sql
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: true    # genera interfaz Querier
```

### 4. Migraciones con golang-migrate

No uses el sistema de migraciones de sqlc (no lo tiene). Usa **golang-migrate** o **goose**.

```bash
# Instalar golang-migrate CLI
brew install golang-migrate

# Crear migración
migrate create -ext sql -dir migrations -seq create_users
```

Esto genera `migrations/000001_create_users.up.sql` y `000001_create_users.down.sql`.

```sql
-- migrations/000001_create_users.up.sql
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrations/000001_create_users.down.sql
DROP TABLE IF EXISTS users;
```

### 5. `sqlc generate` — el "artisan migrate" de sqlc

```bash
# Generar código Go desde los archivos .sql
sqlc generate

# Verificar que las queries son válidas
sqlc vet
```

Cada vez que cambies una migración o una query, ejecutás `sqlc generate`. El output es Go compilable y tipado. No hay "runtime migration check": si el SQL es válido, el código generado es correcto.

### 6. Primer archivo de queries

```sql
-- queries/user.sql
-- name: GetUserByID :one
SELECT id, name, email, created_at, updated_at
FROM users
WHERE id = $1;
```

Después de `sqlc generate`, tendrás:

```go
// db/user.sql.go (generado automáticamente)
func (q *Queries) GetUserByID(ctx context.Context, id int64) (User, error) {
    row := q.db.QueryRow(ctx, getUserByID, id)
    var i User
    err := row.Scan(&i.ID, &i.Name, &i.Email, &i.CreatedAt, &i.UpdatedAt)
    return i, err
}
```

## Comparativa: Migraciones / Setup

| Aspecto | Laravel (PHP) | Go + sqlc |
|---------|---------------|-----------|
| Definir schema | `Schema::create()` en PHP | `CREATE TABLE` en SQL puro |
| Migraciones | `php artisan migrate` | `migrate up` (golang-migrate) |
| Generar modelos | `php artisan make:model` | `sqlc generate` |
| Lenguaje de queries | Query Builder / Eloquent | SQL puro |
| Tiempo de generación | Runtime (cada request) | Compilación |
| Validación | Pruebas HTTP / errores 500 | `sqlc vet` en CI |

## Errores comunes al migrar

1. **Error**: Escribir queries con `?` en vez de `$1`, `$2` (PostgreSQL).  
   **Solución**: sqlc usa `$1`, `$2` para parámetros posicionales. En MySQL se usa `?` (con `sql_package: database/sql`).

2. **Error**: Olvidar ejecutar `sqlc generate` después de cambiar el schema.  
   **Solución**: Agrega `sqlc generate` a tu script de build o usa `watchexec` en dev.

3. **Error**: Poner todas las queries en un solo archivo SQL gigante.  
   **Solución**: Separa por dominio: `user.sql`, `post.sql`, `comment.sql`. sqlc las procesa igual.

## Buenas prácticas

- Usa `emit_interface: true` en sqlc.yaml para poder mockear el Querier en tests.
- Nombra las queries con prefijo del dominio: `GetUserByEmail`, `ListPostsByAuthor`.
- Versiona siempre las migraciones con `migrate create -seq`.
- Mantén `migrations/` y `queries/` separados — sqlc lee ambos directorios.

## Ejercicio sugerido

> Crea un proyecto nuevo, instala sqlc, define una tabla `posts` con columnas `id`, `title`, `body`, `user_id`, `created_at`. Escribe una migración y una query `ListPosts`. Ejecuta `sqlc generate` y revisa el struct generado.

## Siguientes pasos

- [08-02: Schema y modelos](/sqlc/schema-y-modelos/)
- [08-03: Queries SELECT](/sqlc/queries-select/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
