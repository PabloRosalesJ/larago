---
title: "Colas y worker pools"
description: "Implementa un worker pool con goroutines y channels, equivalente a Queues + Horizon de Laravel"
order: 7
section: "10-digging-deeper"
laravel_url: "https://laravel.com/docs/13.x/queues"
go_packages: ["sync", "context", "log/slog"]
---

# Colas y worker pools

**TL;DR** — Laravel tiene `dispatch(new ProcessPodcast($podcast))` con Redis/DB como backend, workers con Horizon, y retry. Go usa goroutines + channels para worker pools, sin dependencias externas para el orquestador.

---

## En Laravel

```php
// Laravel: dispatch jobs
class ProcessPodcast implements ShouldQueue
{
    public function __construct(public Podcast $podcast) {}
    public function handle(): void
    {
        // procesar...
    }
}

dispatch(new ProcessPodcast($podcast))->onQueue('processing');
```

Laravel requiere un worker corriendo (`php artisan queue:work`). Horizon provee dashboard y configuración por consola. El backend puede ser base de datos, Redis, SQS, o beanstalkd.

## En Go

Go tiene goroutines como primitiva de concurrencia nativa. Un worker pool es simplemente N goroutines leyendo de un mismo canal.

### Worker pool simple

```go
package main

import (
    "fmt"
    "log"
    "sync"
    "time"
)

type Job struct {
    ID      int
    Payload string
}

func main() {
    const numWorkers = 3
    jobs := make(chan Job, 100)

    var wg sync.WaitGroup

    // Iniciar workers
    for range numWorkers {
        wg.Add(1)
        go worker(jobs, &wg)
    }

    // Encolar trabajos
    for i := range 10 {
        jobs <- Job{ID: i, Payload: fmt.Sprintf("tarea-%d", i)}
    }
    close(jobs)

    wg.Wait()
    log.Println("Todos los trabajos completados")
}

func worker(jobs <-chan Job, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {
        log.Printf("Worker procesando job %d: %s", job.ID, job.Payload)
        time.Sleep(100 * time.Millisecond) // simular trabajo
    }
}
```

### Worker pool con graceful shutdown

```go
type Pool struct {
    jobs    chan Job
    results chan Result
    workers int
    wg      sync.WaitGroup
    quit    chan struct{}
}

func NewPool(workers, buffer int) *Pool {
    return &Pool{
        jobs:    make(chan Job, buffer),
        results: make(chan Result, buffer),
        workers: workers,
        quit:    make(chan struct{}),
    }
}

func (p *Pool) Start() {
    for range p.workers {
        p.wg.Add(1)
        go p.work()
    }
}

func (p *Pool) work() {
    defer p.wg.Done()
    for {
        select {
        case job, ok := <-p.jobs:
            if !ok {
                return // canal cerrado
            }
            p.results <- p.process(job)
        case <-p.quit:
            return // shutdown forzado
        }
    }
}

func (p *Pool) process(job Job) Result {
    // Simular procesamiento
    time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)
    return Result{JobID: job.ID, Success: true}
}

// Shutdown graceful: espera a que terminen los jobs activos
func (p *Pool) Shutdown() {
    close(p.jobs)  // no más jobs nuevos
    p.wg.Wait()    // esperar workers
    close(p.results)
}

// Shutdown forzado: cancela workers inmediatamente
func (p *Pool) ShutdownNow() {
    close(p.quit)
}
```

### Cola con persistencia

Para un sistema de colas real, necesitas un backend externo:

```go
// Backend interface permite swap Redis <-> DB <-> memoria
type Backend interface {
    Push(queue string, job Job) error
    Pop(queue string, timeout time.Duration) (Job, error)
    Ack(queue string, job Job) error
}

type RedisBackend struct {
    client *redis.Client
}

func (b *RedisBackend) Push(queue string, job Job) error {
    data, _ := json.Marshal(job)
    return b.client.LPush(context.Background(), "queue:"+queue, data).Err()
}

func (b *RedisBackend) Pop(queue string, timeout time.Duration) (Job, error) {
    result, err := b.client.BRPop(context.Background(), timeout, "queue:"+queue).Result()
    if err != nil {
        return Job{}, err
    }
    var job Job
    json.Unmarshal([]byte(result[1]), &job)
    return job, nil
}
```

### Patrón pipeline (múltiples etapas)

```go
// Pipeline: generator -> worker -> saver
func main() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // Etapa 1: generar URLs
    urls := generateURLs(ctx, 100)

    // Etapa 2: descargar (4 workers)
    downloaded := downloadFiles(ctx, urls, 4)

    // Etapa 3: procesar (2 workers)
    processed := processFiles(ctx, downloaded, 2)

    // Consumir resultados
    for result := range processed {
        log.Printf("Resultado: %v", result)
    }
}

func generateURLs(ctx context.Context, count int) <-chan string {
    out := make(chan string, 10)
    go func() {
        defer close(out)
        for i := range count {
            select {
            case out <- fmt.Sprintf("https://example.com/file-%d", i):
            case <-ctx.Done():
                return
            }
        }
    }()
    return out
}

func downloadFiles(ctx context.Context, urls <-chan string, workers int) <-chan []byte {
    out := make(chan []byte, 10)
    var wg sync.WaitGroup
    for range workers {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for url := range urls {
                select {
                case out <- download(url):
                case <-ctx.Done():
                    return
                }
            }
        }()
    }
    go func() {
        wg.Wait()
        close(out)
    }()
    return out
}
```

### Retry con backoff

```go
func processWithRetry(job Job, maxRetries int) error {
    for attempt := range maxRetries {
        err := process(job)
        if err == nil {
            return nil
        }
        if attempt < maxRetries-1 {
            backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
            log.Printf("Retry %d/%d para job %d en %v",
                attempt+1, maxRetries, job.ID, backoff)
            time.Sleep(backoff)
        }
    }
    return fmt.Errorf("job %d failed after %d retries", job.ID, maxRetries)
}
```

## Comparativa: Colas

| Aspecto | Laravel | Go (stdlib) |
|---------|---------|-------------|
| **Definir job** | Clase `ShouldQueue` | Struct + función |
| **Encolar** | `dispatch(new Job())` | `jobs <- Job{...}` |
| **Worker** | `php artisan queue:work` | Goroutines (`go worker()`) |
| **Pool** | Horizon configura workers | N goroutines leyendo del canal |
| **Backend** | Redis, DB, SQS, Beanstalkd | En memoria (o interface externa) |
| **Retry** | `$jobs->onQueue()->retryUntil(...)` | Loop con backoff |
| **Delay** | `->delay(now()->addMinutes(10))` | `time.After` + canal temporizado |
| **Failed jobs** | Tabla `failed_jobs` | Canal de errores / log |
| **Pipeline** | `Job::withChain([...])` | Canales en serie (pipeline) |

## Errores comunes

1. **No cerrar canales** — Enviar a un canal cerrado causa panic. El productor cierra el canal, los consumidores solo leen.
2. **Buffer sin límite** — Sin buffer, el productor bloquea hasta que un worker consuma. Con buffer grande, puedes perder jobs si el programa crashea.
3. **No manejar pánicos en workers** — Si un worker panic, muere la goroutine. Usa `defer recover()` dentro del worker para logging y continuidad.
4. **Suponer orden de procesamiento** — Los workers corren concurrentemente. Si necesitas orden, usa un solo worker o asigna secuencias.
5. **Fuga de goroutines** — Un worker que espera en un canal que nunca se cierra es una goroutine泄漏. Siempre ten un mecanismo de shutdown.

## Buenas prácticas

- Define una interfaz `Backend` si necesitas persistencia. Empieza con memoria, migra a Redis después.
- Usa `context.Context` en workers para poder cancelar operaciones en shutdown.
- Implementa graceful shutdown: cierra el canal de jobs, espera con `sync.WaitGroup`.
- Para colas productivas, considera `asynq` o `machinery` como librerías externas maduras.
- Siempre loggea jobs fallidos con suficiente contexto para debugging.

## Ejercicio sugerido

> Implementa un worker pool que procese "emails" de un canal. Cada email tiene destinatario y cuerpo. Usa 2 workers. Implementa retry con backoff exponencial (1s, 2s, 4s) máximo 3 intentos. El worker debe loggear éxito/fallo.

## Siguientes pasos

- [Task scheduling (cron)](/digging-deeper/cron-tareas/)
- [Eventos y pub/sub](/digging-deeper/eventos/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
