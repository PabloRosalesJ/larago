---
title: "Queries con stdlib"
description: "Escribe consultas SQL en Go con database/sql, usando queries preparadas y mapeo manual a structs"
order: 2
section: "06-database"
laravel_url: "https://laravel.com/docs/13.x/queries"
go_packages: ["database/sql", "fmt", "log"]
---

# Queries con stdlib

**TL;DR** — Laravel tiene Query Builder con `DB::table('users')->where('active', true)->get()`. Go usa SQL puro con `database/sql`: `db.Query("SELECT * FROM users WHERE active = $1", true)`.

---

## En Laravel

```php
// Query Builder: fluido, constructor de queries
$users = DB::table('users')
    ->where('active', true)
    ->where('age', '>', 18)
    ->orderBy('name')
    ->get();
```

## En Go

### SELECT (una fila)

```go
type User struct {
    ID        int
    Name      string
    Email     string
    Active    bool
    CreatedAt time.Time
}

func GetUserByID(db *sql.DB, id int) (*User, error) {
    user := &User{}
    err := db.QueryRow(
        `SELECT id, name, email, active, created_at
         FROM users WHERE id = $1`, id,
    ).Scan(&user.ID, &user.Name, &user.Email, &user.Active, &user.CreatedAt)
    if err == sql.ErrNoRows {
        return nil, fmt.Errorf("usuario %d no encontrado", id)
    }
    return user, err
}
```

### SELECT (múltiples filas)

```go
func ListActiveUsers(db *sql.DB) ([]User, error) {
    rows, err := db.Query(
        `SELECT id, name, email, active, created_at
         FROM users WHERE active = $1 ORDER BY name`, true,
    )
    if err != nil {
        return nil, err
    }
    defer rows.Close() // ← siempre cerrar rows

    var users []User
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Active, &u.CreatedAt); err != nil {
            return nil, err
        }
        users = append(users, u)
    }
    return users, rows.Err() // ← revisar error del último Next()
}
```

### INSERT

```go
func CreateUser(db *sql.DB, name, email string) (int, error) {
    var id int
    err := db.QueryRow(
        `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
        name, email,
    ).Scan(&id)
    return id, err
}
```

### UPDATE

```go
func UpdateUser(db *sql.DB, id int, name string) error {
    result, err := db.Exec(
        `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2`,
        name, id,
    )
    if err != nil {
        return err
    }
    rows, _ := result.RowsAffected()
    if rows == 0 {
        return fmt.Errorf("usuario %d no encontrado", id)
    }
    return nil
}
```

### DELETE

```go
func DeleteUser(db *sql.DB, id int) error {
    result, err := db.Exec(`DELETE FROM users WHERE id = $1`, id)
    if err != nil {
        return err
    }
    rows, _ := result.RowsAffected()
    if rows == 0 {
        return fmt.Errorf("usuario %d no encontrado", id)
    }
    return nil
}
```

### Con JOIN

```go
type UserWithPosts struct {
    User
    PostTitle string
}

func GetUserWithPosts(db *sql.DB, userID int) ([]UserWithPosts, error) {
    rows, err := db.Query(
        `SELECT u.id, u.name, u.email, p.title
         FROM users u
         LEFT JOIN posts p ON p.user_id = u.id
         WHERE u.id = $1
         ORDER BY p.created_at DESC`, userID,
    )
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var results []UserWithPosts
    for rows.Next() {
        var r UserWithPosts
        if err := rows.Scan(&r.ID, &r.Name, &r.Email, &r.PostTitle); err != nil {
            return nil, err
        }
        results = append(results, r)
    }
    return results, rows.Err()
}
```

## Comparativa: Queries

| Operación | Laravel (Query Builder) | Go (database/sql) |
|-----------|------------------------|-------------------|
| **SELECT one** | `DB::table('users')->find($id)` | `db.QueryRow("SELECT ... WHERE id = $1", id).Scan(&u)` |
| **SELECT all** | `DB::table('users')->get()` | `db.Query("SELECT ...")` + `rows.Next()` |
| **WHERE** | `->where('active', true)` | `WHERE active = $1` (SQL puro) |
| **JOIN** | `->join('posts', 'users.id', '=', 'posts.user_id')` | `SELECT ... JOIN ... ON ...` (SQL puro) |
| **ORDER BY** | `->orderBy('name')` | `ORDER BY name` (SQL puro) |
| **LIMIT** | `->take(10)` | `LIMIT 10` (SQL puro) |
| **INSERT** | `DB::table('users')->insert([...])` | `db.Exec("INSERT ...", ...)` |
| **UPDATE** | `DB::table('users')->where('id', 1)->update([...])` | `db.Exec("UPDATE ... WHERE id = $1", ...)` |
| **DELETE** | `DB::table('users')->where('id', 1)->delete()` | `db.Exec("DELETE FROM users WHERE id = $1", id)` |

## Errores comunes

1. **No cerrar `rows`** — `db.Query()` devuelve `*sql.Rows`. Si no haces `defer rows.Close()`, las conexiones al pool no se liberan.
2. **Olvidar `rows.Err()`** — Después del loop, revisa `rows.Err()`. Podría haber un error parcial.
3. **NULL en columnas** — Si una columna puede ser NULL, usa `sql.NullString`, `sql.NullInt64`, etc.
4. **SQL injection** — Siempre usa `$1`, `$2` placeholders. Nunca concatenes strings en SQL.

### Valores NULL

```go
type User struct {
    ID        int
    Name      string
    Email     sql.NullString // puede ser NULL
    AvatarURL sql.NullString // puede ser NULL
}

// rows.Scan(&u.Email) donde Email puede ser NULL
// Si es NULL, Email.Valid = false
if u.Email.Valid {
    fmt.Println(u.Email.String)
}
```

## Buenas prácticas

- Pon todas las queries en funciones tipadas en el paquete `repository`.
- Usa `sql.Null*` para columnas opcionales.
- Prepara queries frecuentes con `db.Prepare()` para reutilizar planes de ejecución.
- Siempre usa placeholders (`$1`, `$2`) — nunca concatenes strings en SQL.
- En proyectos grandes, considera sqlc (sección 08) para generar código desde SQL.

## Ejercicio sugerido

> Crea un paquete `internal/repository/user.go` con las funciones: `Create`, `GetByID`, `List`, `Update`, `Delete`. Cada función recibe `*sql.DB` como primer parámetro. Prueba todas desde un `main.go`.

## Siguientes pasos

- [Paginación](/database/paginacion/)
