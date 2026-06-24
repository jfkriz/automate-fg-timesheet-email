# Timesheet Retry Design

**Date:** 2026-06-24

## Problem

The weekly cron fires once. If the timesheet is not yet approved at that moment, it immediately sends a failure alert email and gives up. Because the cron only fires once per week, there is no second chance until the following week.

## Goal

When the weekly cron finds no approved timesheet, retry on a configurable interval (default: every hour) for a configurable window (default: 24 hours). Send the success email the moment an approved timesheet is found. Only send the failure alert after all retries are exhausted. Survive container restarts by persisting retry state to a file on a Docker volume.

## Approach

**Weekly cron + separate hourly retry cron with a JSON state file.**

The existing weekly cron behavior is preserved. A new hourly retry cron is layered on top. A small JSON file on a mounted Docker volume carries the retry state across cron ticks and container restarts.

## Architecture

### Retry State File

Path: configurable via `RETRY_STATE_FILE` (default `/data/retry-state.json`), written to a Docker named volume.

```json
{
  "weekEnding": "2026-06-28",
  "startedAt": "2026-06-22T09:00:00.000Z",
  "expiresAt": "2026-06-23T09:00:00.000Z",
  "attemptCount": 1,
  "lastAttemptAt": "2026-06-22T09:00:00.000Z"
}
```

### Weekly Cron (existing, lightly modified)

- Fires on the existing `EMAIL_CRON_SCHEDULE` (default: Monday 9am).
- If `fetchTimesheetPdf` returns null, write the retry state file instead of immediately sending the failure alert.
- If writing the state file fails (volume not mounted, permissions), fall back to the existing immediate failure alert — the user is never silently dropped.
- If `fetchTimesheetPdf` succeeds, send the HR email as before (no state file is written; the happy path is unchanged).

### Hourly Retry Cron (new)

- Fires on a cron constructed from `RETRY_INTERVAL_HOURS`: `0 */${retryIntervalHours} * * *` (e.g., default `1` → `0 * * * *`, value `2` → `0 */2 * * *`).
- On each tick:
  1. Read state file. If none, do nothing.
  2. If window expired (`now >= expiresAt`): send failure alert, clear state file, done.
  3. If window active: call `fetchTimesheetPdf()`.
     - **Found:** send HR email, clear state file.
     - **Not found:** increment `attemptCount`, update `lastAttemptAt`, rewrite state file.
     - **Throws:** log error, update `lastAttemptAt`, rewrite state file — transient errors do not end the window early.

### Startup Check (new)

On server start, run the same retry-tick logic once immediately. This means a restarted container retries within seconds rather than waiting up to an hour for the next cron tick.

If the state file exists but the window has already expired by startup time, send the failure alert and clear the file immediately.

## Components

| File | Change |
|---|---|
| `src/utils/retryState.ts` | **New.** `readRetryState()`, `writeRetryState()`, `clearRetryState()` — the only place that touches the file. |
| `src/utils/runBot.ts` | **Modified.** On null PDF: call `writeRetryState()` instead of `sendAlert()`. Fall back to `sendAlert()` if write fails. |
| `src/utils/config.ts` | **Modified.** Add `retryWindowHours`, `retryIntervalHours`, `retryStateFile` to `AppConfig`. |
| `src/interfaces/types.ts` | **Modified.** Add `retryWindowHours`, `retryIntervalHours`, `retryStateFile` to `AppConfig` interface. Add `RetryState` interface. |
| `src/server.ts` | **Modified.** Register hourly retry cron; run startup check. |
| `docker-compose.yml` | **Modified.** Add named volume `timesheet-data` mounted at `/data`. |
| `.env.example` | **Modified.** Document three new optional env vars. |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `RETRY_WINDOW_HOURS` | `24` | Total hours to keep retrying before sending failure alert |
| `RETRY_INTERVAL_HOURS` | `1` | Hours between retry attempts (drives hourly cron expression) |
| `RETRY_STATE_FILE` | `/data/retry-state.json` | Absolute path to state file; must be on a mounted volume |

All three are optional. The app behaves correctly with defaults and no volume mount (it falls back to the immediate failure alert if the state file cannot be written).

## Error Handling

| Scenario | Behavior |
|---|---|
| `writeRetryState()` fails | Log error, fall back to immediate failure alert |
| `readRetryState()` fails | Log error, skip this retry tick |
| `fetchTimesheetPdf()` throws during retry | Log error, update `lastAttemptAt`, continue retrying |
| Container restarts while retry window active | Startup check immediately runs a retry attempt |
| Container restarts after window expired | Startup check sends failure alert and clears state |
| New weekly cron fires while old state file exists | Overwrite state file with new week's state |

## Data Flow Diagram

```
Monday 9am (weekly cron)
  └─ fetchTimesheetPdf()
       ├─ Found → send HR email (unchanged)
       └─ Not found → writeRetryState() → log "retrying"
                         └─ if write fails → sendAlert() (fallback)

Every hour (retry cron) + on startup
  └─ readRetryState()
       ├─ No file → skip
       ├─ Window expired → sendAlert() → clearRetryState()
       └─ Window active → fetchTimesheetPdf()
                            ├─ Found → send HR email → clearRetryState()
                            ├─ Not found → update state file
                            └─ Throws → log + update state file
```

## Out of Scope

- Database or external state store (by design — JSON file is sufficient)
- Retry for the manual `/api/submit` web endpoint (that is already interactive; the user can simply resubmit)
- Configuring different retry windows per week
