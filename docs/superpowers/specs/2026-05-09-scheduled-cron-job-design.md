# Scheduled Cron Job Design

**Date:** 2026-05-09
**Status:** Approved

## Overview

Add a `node-cron` scheduled job to the web server that automatically runs the timesheet automation every Monday at 9am ET (configurable via `EMAIL_SCHEDULE` env var). The core automation logic is extracted from `main.ts` into a shared `runBot()` function used by both the CLI and the cron job.

## New Files

```
src/
  utils/
    runBot.ts   ← shared automation logic (fetch PDF → email HR or alert)
```

## Modified Files

- `src/main.ts` — refactored to call `runBot()`; behavior unchanged
- `src/server.ts` — adds `node-cron` schedule that calls `runBot()`
- `src/utils/config.ts` — adds optional `emailSchedule` field (default `'0 9 * * 1'`)
- `.env.example` — documents optional `EMAIL_SCHEDULE` var
- `package.json` — adds `node-cron` and `@types/node-cron`

## Architecture

### `src/utils/runBot.ts`

Exports a single function:

```ts
runBot(services: { timesheetService, emailService }, config: AppConfig, referenceDate?: Date): Promise<void>
```

Contains the logic currently in `main.ts`:
1. Derive `DateRange` via `getTargetWeekRange(referenceDate)` (omitting `referenceDate` uses current date)
2. Call `timesheetService.fetchTimesheetPdf(dateRange)`
3. **PDF found** → call `emailService.send()` to HR email → log success
4. **PDF not found** → call `sendAlert()` to `MY_EMAIL` → log warning
5. **Thrown error** → call `sendAlert()` with error details → log error → **does not** call `process.exit()` (safe for server context)

The `sendAlert()` helper moves here from `main.ts`.

### `src/main.ts`

Wires up services, parses date arg, calls `runBot()`. Catches unhandled errors and calls `process.exit(1)` (CLI-appropriate behavior that `runBot` itself no longer does).

### `src/server.ts`

After Express setup, registers a cron job:

```ts
cron.schedule(config.emailSchedule, () => runBot(services, config), {
  timezone: 'America/New_York',
});
```

The schedule fires with no `referenceDate` so it targets the current week. The server continues running regardless of job outcome.

## Config

`loadConfig()` reads `EMAIL_SCHEDULE` from env. If absent, defaults to `'0 9 * * 1'` (Monday 9am). The value is not validated — invalid cron expressions will surface as a `node-cron` error at startup.

`.env.example` addition:
```
# EMAIL_SCHEDULE=0 9 * * 1  # cron expression for auto-send (default: Monday 9am ET)
```

## Data Flow (cron path)

1. Server starts → `loadConfig()` → `emailSchedule` set
2. `node-cron` registers job with `emailSchedule` and timezone `America/New_York`
3. Job fires → `runBot(services, config)` called with no `referenceDate`
4. Fetch PDF for current week → email HR on success, alert `MY_EMAIL` on failure
5. Result logged to stdout; server continues running

## Testing

- `config.test.ts` — new case: `EMAIL_SCHEDULE` absent → `emailSchedule` defaults to `'0 9 * * 1'`
- `runBot.test.ts` — two cases:
  - PDF found → `emailService.send()` called with HR email
  - PDF not found → `emailService.send()` called with alert to `MY_EMAIL`
- All existing tests remain unchanged
