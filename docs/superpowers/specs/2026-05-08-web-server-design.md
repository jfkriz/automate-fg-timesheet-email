# Web Server Design

**Date:** 2026-05-08
**Status:** Approved

## Overview

Add a Dockerized Express web server as a second entry point to the existing CLI application. The server hosts a simple HTML form that fetches a Fieldglass timesheet PDF for a selected week and optionally emails it to a recipient. The CLI (`src/main.ts`) remains fully intact; the web server (`src/server.ts`) is a parallel entry point that shares the same service layer.

## New Files

```
src/
  server.ts          ← Express entry point
  public/
    index.html       ← form + ~20 lines of vanilla JS
Dockerfile
docker-compose.yml
```

## Architecture

`src/server.ts` is a second composition root. It instantiates `PuppeteerTimesheetService`, `NodemailerEmailService`, and the nodemailer transporter — identical to `src/main.ts` — and wires them to HTTP routes. No new abstractions; the existing interfaces and services are used as-is.

`tsconfig.build.json` already includes `src/**/*`, so `dist/server.js` is emitted automatically alongside `dist/main.js` with no config changes. A new `start:web` script (`node dist/server.js`) is added to `package.json`. The Docker container uses `start:web`; the CLI continues to use `start`.

`HR_EMAIL` remains required in `loadConfig()`. The server injects it as the default recipient in the form, which the user can override before submitting.

## Routes

### `GET /`
Renders `src/public/index.html` with two values server-injected as defaults:
- The previous Saturday's date (computed via `getTargetWeekRange()`) as the date picker value
- `HR_EMAIL` as the pre-populated recipient email field value

### `POST /api/submit`
Accepts JSON body: `{ date: string, sendEmail: boolean, recipientEmail?: string }`

**Validation (400 on failure):**
- `date` must match `YYYY-MM-DD`
- If `sendEmail` is true, `recipientEmail` must be present and non-empty

**Behavior:**
1. Derive `DateRange`: pass submitted date to `getTargetWeekRange(new Date(`${date}T12:00:00`))` — identical to the CLI
2. Call `timesheetService.fetchTimesheetPdf(dateRange)`
3. **Not found** → JSON `{ status: "not_found", message: "No approved timesheet found for week ending YYYY-MM-DD" }`
4. **Found + sendEmail** → call `emailService.send()` → JSON `{ status: "sent", message: "Timesheet sent to <email>" }`
5. **Found + !sendEmail** → respond with `Content-Type: application/pdf`, `Content-Disposition: inline; filename="Timesheet_Ending_YYYY-MM-DD.pdf"`, PDF bytes
6. **Any thrown error** → JSON `{ status: "error", message: "..." }` (500)

## Form (`src/public/index.html`)

Fields:
- `<input type="date">` — labeled "Timesheet week ending date", defaults to previous Saturday
- `<input type="checkbox">` — labeled "Send timesheet email to recipient", unchecked by default
- `<input type="email">` — labeled "Recipient email *", hidden until checkbox is checked, pre-populated with `HR_EMAIL`, required when visible
- Submit button — label changes between "Fetch Timesheet PDF" and "Fetch & Send Timesheet" based on checkbox state

Client behavior (vanilla JS, no framework):
- Checkbox toggle: show/hide recipient field, update button label
- On submit: intercept default form submission, send `fetch` POST to `/api/submit` with JSON body
- On PDF response: create blob URL, call `window.open(blobUrl, '_blank')`
- On JSON response: display inline result message below the form (success green / not-found orange / error red)
- While submitting: disable submit button to prevent double-submit

## Result States

Displayed inline below the form, styled by status:
- **Sent** (green): "Timesheet for week ending YYYY-MM-DD sent to \<email\>"
- **Not found** (orange): "No approved timesheet found for week ending YYYY-MM-DD"
- **Error** (red): "An error occurred. Check server logs."

## Docker

### `Dockerfile` (multi-stage)

**Build stage:** Node 20 Alpine — installs all dependencies, compiles TypeScript.

**Runtime stage:** Node 20 slim (Debian-based for Puppeteer/Chromium compatibility) — installs production dependencies and Chromium system libraries, copies `dist/` and `src/public/`. Sets `PUPPETEER_EXECUTABLE_PATH` to the system Chromium binary to avoid Puppeteer downloading its own. Runs `node dist/server.js`.

### `docker-compose.yml`

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
```

Port is configurable via `PORT` env var (default: `3000`).

## Config Changes

`HR_EMAIL` remains required. No other config changes — all existing env vars stay the same.

`loadConfig()` is unchanged. The server reads `config.hrEmail` and injects it into the rendered HTML as the default recipient value.

## Testing

No new unit tests for `server.ts` — the service layer is already covered and the Express wiring is thin. One addition: a test case in `config.test.ts` verifying that `loadConfig()` still throws when `HR_EMAIL` is absent (regression guard since it remains required).
