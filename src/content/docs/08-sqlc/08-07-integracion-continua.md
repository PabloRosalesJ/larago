---
title: "sqlc en integración continua"
description: "De artisan migrate --force a sqlc generate, vet y diff en CI/CD"
order: 7
section: "08-sqlc"
laravel_url: "https://laravel.com/docs/13.x/deployment"
go_packages: ["github.com/sqlc-dev/sqlc"]
---

# sqlc en integración continua

**TL;DR** — En Laravel ejecutás `php artisan migrate --force` en deploy. Con sqlc no ejecutás nada en producción; todo se genera y valida en CI. El pipeline es: `sqlc vet` → `sqlc generate` → commit → deploy binario.

---

## En Laravel

```bash
# En deploy de Laravel:
php artisan migrate --force
php artisan optimize
```

Las migraciones se ejecutan contra la BD en producción. Si hay un error de sintaxis SQL, te enterás en producción.

## En Go (sqlc)

El código sqlc se genera en **tiempo de compilación**, no en runtime. El pipeline típico:

1. Developer escribe SQL → `sqlc generate` → compila y prueba localmente
2. CI: `sqlc vet` → `sqlc diff` → tests → build
3. Deploy: solo el binario compilado (no se genera nada)

### 1. sqlc vet — validación de queries

```bash
sqlc vet
```

`sqlc vet` analiza tus queries y detecta:

- **Errores de sintaxis** SQL
- **Parámetros faltantes** o mal tipados
- **Columnas incorrectas** (nombre o tipo no coinciden con el schema)
- **Queries no usadas** (opcional)

Ejemplo de error que `vet` detecta:

```sql
-- name: GetUser :one
SELECT id, name, email
FROM users
WHERE id = $1;
```

Si la columna `email` se renombró a `email_address` en el schema, `sqlc vet` falla con:

```
# queries/user.sql:2:17: column "email" not found in table "users"
```

### 2. sqlc diff — detección de cambios

```bash
sqlc diff
```

Compara el código generado actual con lo que se generaría ahora. Si hay diferencias, el comando falla con exit code distinto de cero. Útil para asegurar que el código generado está actualizado en el repo.

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  sqlc:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install sqlc
        uses: sqlc-dev/setup-sqlc@v4
        with:
          version: "latest"

      - name: Validate schema and queries
        run: |
          sqlc vet
          sqlc diff

      - name: Run migrations (test DB)
        run: |
          migrate -path migrations -database "$TEST_DATABASE_URL" up

      - name: Run Go tests
        run: go test ./...
```

### 3. sqlc generate en CI

Siempre generá desde cero en CI para asegurar consistencia:

```yaml
- name: Generate code
  run: sqlc generate

- name: Ensure generated code is committed
  run: |
    if [ -n "$(git status --porcelain db/)" ]; then
      echo "ERROR: sqlc generate produced uncommitted changes"
      git diff db/
      exit 1
    fi
```

Este paso verifica que el desarrollador ejecutó `sqlc generate` y commiteó los archivos generados. Si no, el CI falla.

### 4. Makefile para comandos comunes

```makefile
.PHONY: sqlc-gen sqlc-vet sqlc-diff sqlc-all

sqlc-gen:
	sqlc generate

sqlc-vet:
	sqlc vet

sqlc-diff:
	sqlc diff

sqlc-all: sqlc-vet sqlc-diff sqlc-gen

# CI usa esto:
ci: sqlc-all migrate-up test
```

### 5. Docker multi-stage (producción)

```dockerfile
# Dockerfile
FROM golang:1.23 AS builder

WORKDIR /app
COPY . .

# En build: generamos y compilamos
RUN go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest && \
    sqlc generate && \
    go build -o app .

FROM debian:bookworm-slim

COPY --from=builder /app/app /app
# No hay sqlc, no hay migraciones, no hay generación

CMD ["/app"]
```

**No ejecutes `sqlc generate` en producción.** El binario ya incluye el código generado compilado.

### 6. Migraciones en deploy

Las migraciones (golang-migrate) se ejecutan como paso separado en el deploy:

```yaml
# deploy.yml (simplificado)
- name: Run database migrations
  run: |
    migrate -path migrations \
            -database "$DATABASE_URL" \
            up
```

O mejor: usá un init container en Kubernetes:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: migrate/migrate
          command:
            - migrate
            - -path=/migrations
            - -database=$(DATABASE_URL)
            - up
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-url
```

### 7. Pre-commit hook

Para evitar commits sin `sqlc generate`:

```bash
#!/bin/sh
# .git/hooks/pre-commit

if ! sqlc vet; then
    echo "sqlc vet failed. Fix SQL errors before committing."
    exit 1
fi

sqlc generate
git add db/
```

## Comparativa: CI/CD

| Aspecto | Laravel | Go + sqlc |
|---------|---------|-----------|
| Validación SQL | Solo en runtime | `sqlc vet` en CI |
| Generación código | No aplica | `sqlc generate` en build |
| Migraciones prod | `php artisan migrate` | `migrate up` como paso separado |
| Archivos generados | No existen | Se versionan en git |
| Error en prod | Posible (migración falla) | Imposible (código ya compilado) |
| Herramienta CI | artisan commands | sqlc CLI + golang-migrate |

## Errores comunes al migrar

1. **Error**: No versionar los archivos generados (`db/*.go`).  
   **Solución**: Versionálos. El equipo necesita ver los cambios en code review. Agregá un check en CI con `sqlc diff`.

2. **Error**: Ejecutar `sqlc generate` en producción.  
   **Solución**: Generá en build time, no en runtime. El contenedor de producción solo lleva el binario compilado.

3. **Error**: Olvidar ejecutar migraciones antes del deploy.  
   **Solución**: Separá el paso de migraciones del paso de deploy. Usá un init container o un job separado.

4. **Error**: Ignorar `sqlc vet` warnings.  
   **Solución**: Hacé que `sqlc vet` falle el CI. No es solo "linter", es un contrato entre tu SQL y tu código Go.

## Buenas prácticas

- Ejecutá `sqlc vet` antes de cada commit (hook) y en CI.
- Usá `sqlc diff` en CI para asegurar que los archivos generados están actualizados.
- Mantené `sqlc.yaml` en el root del repo, no en subdirectorios.
- Las migraciones van en un job separado del deploy del código. Nunca en el mismo paso.
- Configurá `emit_interface: true` para poder mockear el Querier en tests unitarios.

## Ejercicio sugerido

> Creá un workflow de GitHub Actions para tu proyecto sqlc que ejecute: `sqlc vet`, `sqlc diff`, `sqlc generate`, verifique que no hay cambios sin commit, ejecute migraciones contra una BD de test, y corra `go test ./...`.

## Siguientes pasos

- [08-06: Transacciones](/sqlc/transacciones/)
- [09-01: Comparativa Eloquent vs GORM vs sqlc](/comparativa/tabla-comparativa-eloquent-gorm-sqlc/)

---

*¿Algo no claro? [Abrí un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
