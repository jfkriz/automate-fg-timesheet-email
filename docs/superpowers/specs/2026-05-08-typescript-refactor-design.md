# TypeScript Refactor Design

**Date:** 2026-05-08  
**Status:** Approved

## Overview

Refactor the single-file `src/retrieve-timesheet.js` into a structured TypeScript application with service layers, dependency injection, and Jest unit tests. The app logs into SAP Fieldglass, finds the approved timesheet for a target week, generates a PDF, and emails it to HR. If no approved timesheet is found, it sends an alert email instead.

## Project Structure

```
src/
  interfaces/
    IBrowserProvider.ts
    ITimesheetService.ts
    IEmailService.ts
  services/
    PuppeteerBrowserProvider.ts
    PuppeteerTimesheetService.ts
    NodemailerEmailService.ts
  utils/
    dateUtils.ts
    config.ts
  main.ts
tests/
  services/
    timesheetService.test.ts
    emailService.test.ts
  utils/
    dateUtils.test.ts
docs/superpowers/specs/
```

`main.ts` is the sole composition root — the only file that instantiates concrete implementations and wires them together. All other modules depend only on interfaces or pure utilities.

## Shared Types

```typescript
interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer };
}
```

## Interfaces

```typescript
// IBrowserProvider.ts
interface IBrowserProvider {
  launch(): Promise<import('puppeteer').Browser>;
}

// ITimesheetService.ts
interface ITimesheetService {
  fetchTimesheetPdf(dates: DateRange): Promise<Buffer | null>;
}

// IEmailService.ts
interface IEmailService {
  send(options: EmailOptions): Promise<void>;
}
```

`fetchTimesheetPdf` returns `null` when no approved timesheet is found for the given range — this is an expected outcome, not an error. Exceptions are reserved for actual failures (login error, network, etc.).

## Services

### `PuppeteerBrowserProvider`
- Implements `IBrowserProvider`
- Calls `puppeteer.launch()` with Nix-compatible args (`--no-sandbox`, `--disable-setuid-sandbox`)
- Isolates launch configuration from the timesheet service

### `PuppeteerTimesheetService`
- Constructor: `(browserProvider: IBrowserProvider, config: TimesheetConfig)`
- `fetchTimesheetPdf(dates)`: launches browser, logs in, navigates to timesheets, finds the row matching the date range and "Approved" status, generates PDF via `page.pdf()`, closes browser, returns `Buffer`
- Returns `null` if no matching row is found
- Throws on login failure or navigation error

### `NodemailerEmailService`
- Constructor: `(transportOptions: TransportOptions)`
- Implements `IEmailService`
- Creates nodemailer transporter and sends email with optional attachment

### `dateUtils.ts`
- `getTargetWeekRange(referenceDate?: Date): DateRange`
- Returns the previous Sunday–Saturday range relative to `referenceDate` (defaults to `new Date()`)
- Pure function, no side effects

### `config.ts`
- `loadConfig(): AppConfig`
- Reads all `process.env` vars, throws a descriptive error listing any missing required vars
- Returns a typed config object

## `main.ts` Workflow

```
1. Parse CLI arg: node dist/main.js [YYYY-MM-DD]
   - If provided, validate YYYY-MM-DD format; exit 1 with message if invalid
   - Pass as referenceDate to getTargetWeekRange()

2. loadConfig() — throws if any required env var is missing

3. Instantiate PuppeteerBrowserProvider, PuppeteerTimesheetService, NodemailerEmailService

4. fetchTimesheetPdf(dateRange)
   - null  → send alert email to MY_EMAIL, exit 1
   - Buffer → send PDF email to HR_EMAIL, exit 0

5. Any thrown error:
   - Attempt alert email to MY_EMAIL (best-effort; swallow any secondary failure)
   - Log original error to stderr
   - exit 1
```

## Error Handling

- Missing env vars: detected at startup via `loadConfig()`, exit 1 before any browser is launched
- No approved timesheet found: `null` return value, alert email sent, exit 1
- Fatal errors (login failure, network, Puppeteer crash): attempt alert email, log to stderr, exit 1
- Alert email failure: swallowed — the original error takes precedence

## Testing Strategy

**`dateUtils.test.ts`** — pure unit tests, no mocks
- Correct Sunday–Saturday range for mid-week reference date
- Edge cases: reference is Sunday, Saturday, Monday
- Default (no arg) uses today without throwing

**`timesheetService.test.ts`** — inject fake `IBrowserProvider`
- Mock returns a fake `Page` with controlled `evaluate()`, `pdf()`, `goto()` responses
- Returns `Buffer` when matching approved row found
- Returns `null` when no matching row exists
- Throws when navigation fails

**`emailService.test.ts`** — mock nodemailer transporter
- Jest-mocked transporter injected via constructor
- `send()` called with correct `from`, `to`, `subject`, `text`
- Attachment included when provided, omitted when not

## TypeScript & Tooling

- `tsconfig.json`: `strict: true`, `target: ES2020`, `module: commonjs`, `outDir: dist`
- `ts-jest` for running tests without a separate compile step
- `jest.config.ts` with `preset: 'ts-jest'`
- New `package.json` scripts:
  - `build`: `tsc`
  - `start`: `node dist/main.js`
  - `test`: `jest`
- New dev dependencies: `typescript`, `ts-jest`, `@types/jest`, `@types/nodemailer`
- Note: `puppeteer` ships its own types since v19, no `@types/puppeteer` needed
