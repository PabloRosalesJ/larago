---
title: "Cliente HTTP"
description: "Realiza peticiones HTTP externas con net/http.Client, timeout y contexto, equivalente a Http::get de Laravel"
order: 4
section: "10-digging-deeper"
laravel_url: "https://laravel.com/docs/13.x/http-client"
go_packages: ["net/http", "context", "io", "time"]
---

# Cliente HTTP

**TL;DR** — Laravel tiene `Http::get('https://api.example.com')` con fachada fluida. Go usa `net/http.Client` con control explícito de conexiones, timeouts, y contexto.

---

## En Laravel

```php
// Laravel: HTTP Client fluido
$response = Http::withHeaders([
    'Authorization' => 'Bearer '.$token,
])->timeout(10)->get('https://api.example.com/users');

$body = $response->json();
$status = $response->status();
```

Laravel envuelve cURL con una API fluida. Soporta headers, retry, fake para tests, y múltiples conexiones.

## En Go

Go incluye un cliente HTTP completo en `net/http`. No necesitas `axios`, `curl` wrapper, ni nada extra.

### GET básico

```go
package main

import (
    "fmt"
    "io"
    "net/http"
)

func main() {
    resp, err := http.Get("https://api.github.com/users/octocat")
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
    fmt.Println("Status:", resp.StatusCode)
}
```

### GET con headers y timeout

```go
func fetchUser(id int) (*User, error) {
    client := &http.Client{
        Timeout: 10 * time.Second,
    }

    req, _ := http.NewRequest("GET",
        fmt.Sprintf("https://api.example.com/users/%d", id), nil)

    req.Header.Set("Authorization", "Bearer token123")
    req.Header.Set("Accept", "application/json")

    resp, err := client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
    }

    var user User
    err = json.NewDecoder(resp.Body).Decode(&user)
    return &user, err
}
```

### POST con body JSON

```go
type CreateUserReq struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

func createUser(name, email string) (*User, error) {
    body := CreateUserReq{Name: name, Email: email}
    data, _ := json.Marshal(body)

    resp, err := http.Post(
        "https://api.example.com/users",
        "application/json",
        bytes.NewReader(data),
    )
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var user User
    err = json.NewDecoder(resp.Body).Decode(&user)
    return &user, err
}
```

### Contexto y cancelación

```go
func fetchWithContext(ctx context.Context, url string) ([]byte, error) {
    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    return io.ReadAll(resp.Body)
}

// Uso con timeout
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

data, err := fetchWithContext(ctx, "https://api.example.com/heavy")
if err != nil {
    log.Printf("request cancelled or failed: %v", err)
}
```

### Cliente reutilizable con transporte

```go
// Transport personalizado para control fino
transport := &http.Transport{
    MaxIdleConns:        100,
    MaxConnsPerHost:     10,
    IdleConnTimeout:     90 * time.Second,
    DisableCompression:  false,
}

client := &http.Client{
    Transport: transport,
    Timeout:   30 * time.Second,
}
```

### Retry simple

```go
func doWithRetry(client *http.Client, req *http.Request, maxRetries int) (*http.Response, error) {
    var resp *http.Response
    var err error

    for range maxRetries {
        resp, err = client.Do(req)
        if err == nil && resp.StatusCode < 500 {
            return resp, nil
        }
        if resp != nil {
            resp.Body.Close()
        }
        time.Sleep(time.Second)
    }

    return nil, fmt.Errorf("max retries exceeded: %w", err)
}
```

## Comparativa: HTTP Client

| Aspecto | Laravel | Go (stdlib) |
|---------|---------|-------------|
| **GET** | `Http::get(url)` | `http.Get(url)` |
| **POST JSON** | `Http::post(url, data)` | `http.Post(url, "json", body)` |
| **Headers** | `->withHeaders([...])` | `req.Header.Set(...)` |
| **Timeout** | `->timeout(10)` | `client.Timeout / context.WithTimeout` |
| **Retry** | `->retry(3, 100)` | Manual (loop + backoff) |
| **Test mock** | `Http::fake()` | Servidor test (httptest) |
| **Transporte** | No expuesto | `http.Transport` (conexiones, proxy) |
| **Streaming** | `->withOptions(['stream' => true])` | `resp.Body` (io.ReadCloser) |

## Errores comunes

1. **No cerrar `resp.Body`** — Fuga de conexiones. Siempre `defer resp.Body.Close()`.
2. **Ignorar timeouts** — Sin timeout, una petición puede colgarse indefinidamente. Siempre configura `client.Timeout` o usa `context.WithTimeout`.
3. **Re-crear el cliente en cada request** — `http.Client` está diseñado para reutilizarse. Crea uno y reúsalo.
4. **No verificar `resp.StatusCode`** — Un 404 o 500 no es error de red. Verifica el código de estado.
5. **Leer `resp.Body` múltiples veces** — El body es un stream; solo se lee una vez. Si necesitas leerlo varias veces, usa `io.ReadAll` y almacena el resultado.

## Buenas prácticas

- Reutiliza el `http.Client`. Crear uno nuevo por request desperdicia conexiones.
- Siempre usa `context` para cancelación y timeouts.
- Verifica `resp.StatusCode` antes de decodificar la respuesta.
- Para APIs JSON, usa `json.NewDecoder(resp.Body)` en lugar de `io.ReadAll` + `json.Unmarshal`.
- En tests, usa `httptest.NewServer` para simular APIs externas.

## Ejercicio sugerido

> Crea un cliente que consulte la API de GitHub (`https://api.github.com/users/{username}`), maneje errores (rate limiting, usuario no encontrado), e imprima nombre, repos públicos, y followers. Agrega un timeout de 5s y retry 3 veces con backoff de 1s.

## Siguientes pasos

- [Envío de emails](/digging-deeper/envio-emails/)
- [Sistema de archivos](/digging-deeper/file-system/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
