# Scheduled Cron Job Design

**Date:** 2026-05-09
**Status:** Approved

## Overview

Add a `node-cron` scheduled job to the web server that automatically runs the timesheet automation every Monday at 9am ET (configurable via `EMAIL_CRON_SCHEDULE` and `EMAIL_CRON_SCHEDULE_TIMEZONE` env vars). The core automation logic is extracted from `main.ts` into a shared `runBot()` function used by both the CLI and the cron job.

## New Files

```
src/
  utils/
    runBot.ts   ← shared automation logic (fetch PDF → email HR or alert)
```

## Modified Files

- `src/main.ts` — refactored to call `runBot()`; behavior unchanged
- `src/server.ts` — adds `node-cron` schedule that calls `runBot()`
- `src/utils/config.ts` — adds optional `emailCronSchedule` (default `'0 9 * * 1'`) and `emailCronScheduleTimezone` (default `'America/New_York'`) fields
- `.env.example` — documents optional `EMAIL_CRON_SCHEDULE` and `EMAIL_CRON_SCHEDULE_TIMEZONE` vars
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
cron.schedule(config.emailCronSchedule, () => runBot(services, config), {
  timezone: config.emailCronScheduleTimezone,
});
```

The schedule fires with no `referenceDate` so it targets the current week. The server continues running regardless of job outcome.

## Config

`loadConfig()` reads two optional env vars:
- `EMAIL_CRON_SCHEDULE` — cron expression, defaults to `'0 9 * * 1'` (Monday 9am)
- `EMAIL_CRON_SCHEDULE_TIMEZONE` — timezone string, defaults to `'America/New_York'`

Neither value is validated — invalid expressions or timezone strings will surface as `node-cron` errors at startup.

`.env.example` addition:
```
# EMAIL_CRON_SCHEDULE=0 9 * * 1           # cron expression for auto-send (default: Monday 9am)
# EMAIL_CRON_SCHEDULE_TIMEZONE=America/New_York  # timezone for cron schedule (default: America/New_York)
```

## Data Flow (cron path)

1. Server starts → `loadConfig()` → `emailCronSchedule` and `emailCronScheduleTimezone` set
2. `node-cron` registers job with `emailCronSchedule` and `emailCronScheduleTimezone`
3. Job fires → `runBot(services, config)` called with no `referenceDate`
4. Fetch PDF for current week → email HR on success, alert `MY_EMAIL` on failure
5. Result logged to stdout; server continues running

## Testing

- `config.test.ts` — new cases: `EMAIL_CRON_SCHEDULE` absent → defaults to `'0 9 * * 1'`; `EMAIL_CRON_SCHEDULE_TIMEZONE` absent → defaults to `'America/New_York'`
- `runBot.test.ts` — two cases:
  - PDF found → `emailService.send()` called with HR email
  - PDF not found → `emailService.send()` called with alert to `MY_EMAIL`
- All existing tests remain unchanged
