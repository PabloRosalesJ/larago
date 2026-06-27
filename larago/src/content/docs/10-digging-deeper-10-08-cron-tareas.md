---
title: "Task scheduling (cron)"
description: "Programa tareas recurrentes en Go con time.Ticker y time.After, equivalente al schedule:cron de Laravel"
order: 8
section: "10-digging-deeper"
laravel_url: "https://laravel.com/docs/13.x/scheduling"
go_packages: ["time", "context", "os/signal", "syscall"]
---

# Task scheduling (cron)

**TL;DR** — Laravel tiene `$schedule->command('emails:send')->daily()` con cron expresiones. Go usa `time.Ticker` para intervalos fijos y `time.After` para retrasos, combinado con un scheduler personalizable.

---

## En Laravel

```php
// Laravel: programador de tareas en app/Console/Kernel.php
class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('emails:send')->dailyAt('06:00');
        $schedule->job(new CleanupJob)->hourly();
        $schedule->call(fn () => DB::table('logs')->delete())
                 ->everyFifteenMinutes();
        $schedule->command('backup:run')
                 ->cron('0 */2 * * *');
    }
}
```

Laravel ejecuta `schedule:run` cada minuto (vía cron del sistema). El evaluador decide qué tareas deben correr basado en la hora actual.

## En Go

Go no tiene un scheduler built-in. Las opciones son:

1. `time.Ticker` — para intervalos fijos (equivalentes a `->everyMinute()`, `->hourly()`)
2. `time.After` — para ejecución única diferida
3. `time.Timer` — para tareas que se reprograman manualmente
4. Librería externa `robfig/cron` — para expresiones cron completas

### Scheduler simple con Ticker

```go
package main

import (
    "context"
    "log"
    "os/signal"
    "syscall"
    "time"
)

func main() {
    ctx, cancel := signal.NotifyContext(context.Background(),
        syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    // Tarea cada 30 segundos
    go runEvery(ctx, 30*time.Second, func() {
        log.Println("Ejecutando cleanup de logs...")
        // cleanupLogs()
    })

    // Tarea cada hora (al minuto 0)
    go runEveryHour(ctx, func() {
        log.Println("Ejecutando backup...")
        // runBackup()
    })

    // Tarea diaria a las 6:00
    go runDailyAt(ctx, "06:00", func() {
        log.Println("Enviando emails diarios...")
        // sendDailyEmails()
    })

    <-ctx.Done()
    log.Println("Scheduler detenido")
}

func runEvery(ctx context.Context, interval time.Duration, fn func()) {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            fn()
        case <-ctx.Done():
            return
        }
    }
}
```

### Scheduler con expresiones cron (implementación manual)

```go
type Job struct {
    Name     string
    Schedule string   // formato "min hour day month weekday"
    Task     func()
    Enabled  bool
}

type Scheduler struct {
    jobs []Job
    mu   sync.RWMutex
}

func (s *Scheduler) Add(name, schedule string, task func()) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.jobs = append(s.jobs, Job{
        Name: name, Schedule: schedule, Task: task, Enabled: true,
    })
}

func (s *Scheduler) Start(ctx context.Context) {
    for _, job := range s.jobs {
        go s.runJob(ctx, job)
    }
}

func (s *Scheduler) runJob(ctx context.Context, job Job) {
    for {
        next := nextRun(job.Schedule, time.Now())
        if next.IsZero() {
            return // expresión inválida
        }

        delay := time.Until(next)
        if delay < 0 {
            delay = 0
        }

        select {
        case <-time.After(delay):
            job.Task()
        case <-ctx.Done():
            return
        }
    }
}
```

### Tarea diaria a hora específica

```go
func runDailyAt(ctx context.Context, hourMin string, fn func()) {
    for {
        now := time.Now()
        target, _ := time.Parse("15:04", hourMin)
        next := time.Date(now.Year(), now.Month(), now.Day(),
            target.Hour(), target.Minute(), 0, 0, now.Location())

        if now.After(next) {
            next = next.Add(24 * time.Hour)
        }

        select {
        case <-time.After(time.Until(next)):
            fn()
        case <-ctx.Done():
            return
        }
    }
}
```

### Tarea que se ejecuta inmediatamente en el minuto cero de cada hora

```go
func runEveryHour(ctx context.Context, fn func()) {
    for {
        now := time.Now()
        // Próximo minuto 0
        next := time.Date(now.Year(), now.Month(), now.Day(),
            now.Hour(), 0, 0, 0, now.Location())
        if now.After(next) {
            next = next.Add(time.Hour)
        }

        select {
        case <-time.After(time.Until(next)):
            fn()
        case <-ctx.Done():
            return
        }
    }
}
```

### Scheduler con formato cron usando librería externa

```go
// go get github.com/robfig/cron/v3

import "github.com/robfig/cron/v3"

func main() {
    c := cron.New()

    // Cron estándar: segundo, minuto, hora, día, mes, día-semana
    c.AddFunc("0 6 * * *", func() {
        log.Println("Enviando emails diarios (06:00)")
    })
    c.AddFunc("0 */2 * * *", func() {
        log.Println("Backup cada 2 horas")
    })
    c.AddFunc("@every 30s", func() {
        log.Println("Cleanup cada 30 segundos")
    })
    c.AddFunc("@daily", func() {
        log.Println("Tarea diaria a media noche")
    })

    c.Start()

    // Graceful shutdown
    sig := make(chan os.Signal, 1)
    signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
    <-sig

    c.Stop()
    log.Println("Cron detenido")
}
```

### Graceful shutdown

```go
func main() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // Señales del sistema
    sig := make(chan os.Signal, 1)
    signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

    // Iniciar scheduler
    go runEvery(ctx, 30*time.Second, cleanupLogs)
    go runDailyAt(ctx, "06:00", sendEmails)

    // Esperar señal de terminación
    <-sig
    log.Println("Deteniendo scheduler...")
    cancel()
    time.Sleep(2 * time.Second) // esperar tareas en curso
    log.Println("Scheduler detenido")
}
```

## Comparativa: Task Scheduling

| Aspecto | Laravel | Go (stdlib) |
|---------|---------|-------------|
| **Definir tarea** | `$schedule->command(...)` | Función Go |
| **Intervalo** | `->everyMinute()`, `->hourly()` | `time.NewTicker(interval)` |
| **Hora específica** | `->dailyAt('06:00')` | `time.After` + cálculo manual |
| **Cron expresión** | `->cron('0 6 * * *')` | `robfig/cron` (externo) |
| **Condiciones** | `->when(fn)` | If dentro de la función |
| **Overlapping** | `->withoutOverlapping()` | `sync.Mutex` sobre la tarea |
| **En background** | `->runInBackground()` | Goroutine separada |
| **Graceful** | No aplica (PHP) | `context.Context` + `os/signal` |
| **Log** | Automático | `slog` manual |

## Errores comunes

1. **Tareas que se solapan** — Si una tarea tarda más que el intervalo, se acumulan. Usa `sync.Mutex` o un semáforo por tarea.
2. **No manejar pánicos** — Si una tarea panic, la goroutine muere. Siempre usa `defer recover()` dentro de cada tarea.
3. **Ignorar zonas horarias** — `time.Now()` usa la zona local. Si el servidor está en UTC pero necesitas horario local, configúralo explícitamente.
4. **Ticker sin cleanup** — Siempre llama `ticker.Stop()` cuando termines para liberar recursos del timer.
5. **Depender de `time.Ticker` para horas exactas** — Ticker es para intervalos. Para horas exactas (06:00), calcula el próximo target con `time.Date`.

## Buenas prácticas

- Envuelve cada tarea en `defer recover()` para que un panic no mate el scheduler.
- Usa `context.Context` para cancelación y graceful shutdown.
- Para tareas que requieren expresiones cron, usa `robfig/cron` en lugar de reinventar el parser.
- Loggea cada ejecución (inicio, duración, éxito/fallo).
- Mantén las tareas idempotentes: ejecutar dos veces debe ser seguro.

## Ejercicio sugerido

> Crea un scheduler que ejecute tres tareas: un ping a google.com cada 10s, un backup de datos cada minuto, y un cleanup de logs a las 23:00. Implementa graceful shutdown con señales SIGINT/SIGTERM y asegura que las tareas no se solapen usando un mutex por tarea.

## Siguientes pasos

- [Colas y worker pools](/digging-deeper/colas/)
- [Logging estructurado](/the-basics/logging/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
