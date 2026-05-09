# Scheduled Cron Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `node-cron` scheduled job to the web server that automatically runs the timesheet automation on a configurable schedule (default: Monday 9am ET), by extracting shared bot logic into `src/utils/runBot.ts`.

**Architecture:** Extract the fetch-and-email logic from `src/main.ts` into a shared `runBot()` function that takes injected services. `src/main.ts` calls it directly; `src/server.ts` calls it on a `node-cron` schedule. Two new optional env vars (`EMAIL_CRON_SCHEDULE`, `EMAIL_CRON_SCHEDULE_TIMEZONE`) configure the schedule.

**Tech Stack:** TypeScript, node-cron, Express (existing), Puppeteer (existing), Nodemailer (existing), Jest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/interfaces/types.ts` | Modify | Add `emailCronSchedule` and `emailCronScheduleTimezone` to `AppConfig` |
| `src/utils/config.ts` | Modify | Read `EMAIL_CRON_SCHEDULE` and `EMAIL_CRON_SCHEDULE_TIMEZONE` with defaults |
| `src/utils/runBot.ts` | Create | Shared automation logic: fetch PDF → email HR or alert |
| `src/main.ts` | Modify | Refactor to call `runBot()`; drop disk write side-effect |
| `src/server.ts` | Modify | Add `node-cron` schedule that calls `runBot()` |
| `.env.example` | Modify | Document the two new optional env vars |
| `tests/utils/config.test.ts` | Modify | Add tests for the two new optional config fields |
| `tests/utils/runBot.test.ts` | Create | Unit tests for `runBot()` success, not-found, and error paths |

---

## Task 1: Install node-cron

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime and type packages**

```bash
yarn add node-cron
yarn add -D @types/node-cron
```

Expected output: `node-cron` added to `dependencies`, `@types/node-cron` added to `devDependencies` in `package.json`.

- [ ] **Step 2: Commit**

```bash
git add package.json yarn.lock
git commit -m "feat: add node-cron dependency"
```

---

## Task 2: Extend AppConfig type

**Files:**
- Modify: `src/interfaces/types.ts`

- [ ] **Step 1: Add the two new optional fields to `AppConfig`**

Replace the `AppConfig` interface in `src/interfaces/types.ts` with:

```ts
export interface AppConfig {
  timesheet: TimesheetConfig;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  myEmail: string;
  hrEmail: string;
  emailCronSchedule: string;
  emailCronScheduleTimezone: string;
}
```

- [ ] **Step 2: Verify TypeScript still compiles (loadConfig return will fail until Task 3)**

```bash
yarn build 2>&1 | head -20
```

Expected: errors about `emailCronSchedule` and `emailCronScheduleTimezone` missing from the return value in `config.ts` — that's expected and fixed in Task 3.

---

## Task 3: Update loadConfig and tests

**Files:**
- Modify: `src/utils/config.ts`
- Modify: `tests/utils/config.test.ts`

- [ ] **Step 1: Write failing tests for the two new config fields**

Add to the `describe('loadConfig', ...)` block in `tests/utils/config.test.ts`, after the existing tests:

```ts
  it('defaults emailCronSchedule to "0 9 * * 1" when EMAIL_CRON_SCHEDULE is absent', () => {
    const config = loadConfig();
    expect(config.emailCronSchedule).toBe('0 9 * * 1');
  });

  it('uses EMAIL_CRON_SCHEDULE when set', () => {
    process.env.EMAIL_CRON_SCHEDULE = '0 8 * * 5';
    const config = loadConfig();
    expect(config.emailCronSchedule).toBe('0 8 * * 5');
    delete process.env.EMAIL_CRON_SCHEDULE;
  });

  it('defaults emailCronScheduleTimezone to "America/New_York" when EMAIL_CRON_SCHEDULE_TIMEZONE is absent', () => {
    const config = loadConfig();
    expect(config.emailCronScheduleTimezone).toBe('America/New_York');
  });

  it('uses EMAIL_CRON_SCHEDULE_TIMEZONE when set', () => {
    process.env.EMAIL_CRON_SCHEDULE_TIMEZONE = 'America/Chicago';
    const config = loadConfig();
    expect(config.emailCronScheduleTimezone).toBe('America/Chicago');
    delete process.env.EMAIL_CRON_SCHEDULE_TIMEZONE;
  });
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
yarn test tests/utils/config.test.ts
```

Expected: 4 new failures — `emailCronSchedule` and `emailCronScheduleTimezone` are undefined on the returned config.

- [ ] **Step 3: Update `loadConfig()` to return the two new fields**

Replace the return statement in `src/utils/config.ts` with:

```ts
  return {
    timesheet: {
      loginUrl: vars.FIELDGLASS_LOGIN_URL!,
      timesheetsUrl: vars.FIELDGLASS_TIMESHEETS_URL!,
      username: vars.FIELDGLASS_USERNAME!,
      password: vars.FIELDGLASS_PASSWORD!,
    },
    smtp: {
      host: vars.SMTP_HOST!,
      port: parseInt(vars.SMTP_PORT!, 10),
      secure: vars.SMTP_SECURE === 'true',
      user: vars.EMAIL_USER!,
      pass: vars.EMAIL_PASS!,
    },
    myEmail: vars.MY_EMAIL!,
    hrEmail: vars.HR_EMAIL!,
    emailCronSchedule: process.env.EMAIL_CRON_SCHEDULE ?? '0 9 * * 1',
    emailCronScheduleTimezone: process.env.EMAIL_CRON_SCHEDULE_TIMEZONE ?? 'America/New_York',
  };
```

- [ ] **Step 4: Run all config tests and confirm they pass**

```bash
yarn test tests/utils/config.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/interfaces/types.ts src/utils/config.ts tests/utils/config.test.ts
git commit -m "feat: add emailCronSchedule and emailCronScheduleTimezone to config"
```

---

## Task 4: Create runBot.ts

**Files:**
- Create: `src/utils/runBot.ts`
- Create: `tests/utils/runBot.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/runBot.test.ts`:

```ts
import { runBot } from '../../src/utils/runBot';
import type { ITimesheetService } from '../../src/interfaces/ITimesheetService';
import type { IEmailService } from '../../src/interfaces/IEmailService';
import type { AppConfig } from '../../src/interfaces/types';

const mockConfig: AppConfig = {
  timesheet: {
    loginUrl: 'https://example.com/login',
    timesheetsUrl: 'https://example.com/timesheets',
    username: 'user',
    password: 'pass',
  },
  smtp: { host: 'smtp.example.com', port: 587, secure: false, user: 'user', pass: 'pass' },
  myEmail: 'me@example.com',
  hrEmail: 'hr@example.com',
  emailCronSchedule: '0 9 * * 1',
  emailCronScheduleTimezone: 'America/New_York',
};

describe('runBot', () => {
  let mockFetchPdf: jest.Mock;
  let mockSend: jest.Mock;
  let timesheetService: ITimesheetService;
  let emailService: IEmailService;

  beforeEach(() => {
    mockFetchPdf = jest.fn();
    mockSend = jest.fn().mockResolvedValue(undefined);
    timesheetService = { fetchTimesheetPdf: mockFetchPdf };
    emailService = { send: mockSend };
  });

  it('emails HR with the PDF when a timesheet is found', async () => {
    const pdf = Buffer.from([1, 2, 3]);
    mockFetchPdf.mockResolvedValue(pdf);

    await runBot({ timesheetService, emailService }, mockConfig);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hr@example.com',
        subject: expect.stringContaining('Timesheet Approved'),
        attachment: expect.objectContaining({ content: pdf }),
      }),
    );
  });

  it('sends an alert to myEmail when no timesheet is found', async () => {
    mockFetchPdf.mockResolvedValue(null);

    await runBot({ timesheetService, emailService }, mockConfig);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'me@example.com',
        subject: 'ACTION REQUIRED: Timesheet Bot Alert',
      }),
    );
  });

  it('sends an error alert to myEmail when fetchTimesheetPdf throws', async () => {
    mockFetchPdf.mockRejectedValue(new Error('timeout'));

    await runBot({ timesheetService, emailService }, mockConfig);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'me@example.com',
        subject: 'ERROR: Timesheet Bot Failure',
      }),
    );
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
yarn test tests/utils/runBot.test.ts
```

Expected: FAIL — `runBot` module not found.

- [ ] **Step 3: Implement `src/utils/runBot.ts`**

Create `src/utils/runBot.ts`:

```ts
import type { AppConfig } from '../interfaces/types';
import type { ITimesheetService } from '../interfaces/ITimesheetService';
import type { IEmailService } from '../interfaces/IEmailService';
import { getTargetWeekRange } from './dateUtils';

interface BotServices {
  timesheetService: ITimesheetService;
  emailService: IEmailService;
}

export async function runBot(
  services: BotServices,
  config: AppConfig,
  referenceDate?: Date,
): Promise<void> {
  const { timesheetService, emailService } = services;
  const dateRange = getTargetWeekRange(referenceDate);

  try {
    const pdfBuffer = await timesheetService.fetchTimesheetPdf(dateRange);

    if (!pdfBuffer) {
      await sendAlert(emailService, config.myEmail, dateRange.end);
      console.error(`No approved timesheet found for week ending ${dateRange.end}.`);
      return;
    }

    const filename = `Timesheet_Ending_${dateRange.end}.pdf`;
    await emailService.send({
      from: config.myEmail,
      to: config.hrEmail,
      subject: `Timesheet Approved - Period Ending ${dateRange.end}`,
      text: `Attached is my approved timesheet for the week ending ${dateRange.end}.`,
      attachment: { filename, content: pdfBuffer },
    });

    console.log(`Timesheet sent successfully for week ending ${dateRange.end}.`);
  } catch (err) {
    try {
      await sendAlert(emailService, config.myEmail, dateRange.end, err);
    } catch {
      // swallow secondary failure — original error takes precedence
    }
    console.error('Bot encountered an error:', err);
  }
}

async function sendAlert(
  emailService: IEmailService,
  to: string,
  weekEnding: string,
  err?: unknown,
): Promise<void> {
  const subject = err
    ? 'ERROR: Timesheet Bot Failure'
    : 'ACTION REQUIRED: Timesheet Bot Alert';
  const text = err
    ? `The timesheet bot encountered an error: ${err instanceof Error ? err.message : String(err)}`
    : `The bot could not find an "Approved" timesheet for the week ending ${weekEnding}. Please verify your submission status.`;

  await emailService.send({ from: to, to, subject, text });
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
yarn test tests/utils/runBot.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/runBot.ts tests/utils/runBot.test.ts
git commit -m "feat: add runBot shared automation function"
```

---

## Task 5: Refactor main.ts to use runBot

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace `src/main.ts` with the refactored version**

```ts
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import nodemailer from 'nodemailer';
import { loadConfig } from './utils/config';
import { PuppeteerBrowserProvider } from './services/PuppeteerBrowserProvider';
import { PuppeteerTimesheetService } from './services/PuppeteerTimesheetService';
import { NodemailerEmailService } from './services/NodemailerEmailService';
import { runBot } from './utils/runBot';

async function main(): Promise<void> {
  const dateArg = process.argv[2];
  if (dateArg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    console.error(`Invalid date format: "${dateArg}". Expected YYYY-MM-DD.`);
    process.exit(1);
  }

  const config = loadConfig();
  const referenceDate = dateArg ? new Date(`${dateArg}T12:00:00`) : undefined;

  const browserProvider = new PuppeteerBrowserProvider();
  const timesheetService = new PuppeteerTimesheetService(browserProvider, config.timesheet);
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  const emailService = new NodemailerEmailService(transporter);

  await runBot({ timesheetService, emailService }, config, referenceDate);
}

main().catch((err) => {
  console.error('Bot encountered an error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

```bash
yarn test
```

Expected: all tests PASS.

- [ ] **Step 3: Build to confirm TypeScript compiles cleanly**

```bash
yarn build
```

Expected: no errors, `dist/main.js` and `dist/server.js` emitted.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "refactor: main.ts delegates to runBot"
```

---

## Task 6: Add cron job to server.ts

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add the cron import and `runBot` import at the top of `src/server.ts`**

Replace the import block at the top of `src/server.ts` with:

```ts
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import express from 'express';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { loadConfig } from './utils/config';
import { getTargetWeekRange } from './utils/dateUtils';
import { PuppeteerBrowserProvider } from './services/PuppeteerBrowserProvider';
import { PuppeteerTimesheetService } from './services/PuppeteerTimesheetService';
import { NodemailerEmailService } from './services/NodemailerEmailService';
import { runBot } from './utils/runBot';
```

- [ ] **Step 2: Add the cron schedule at the bottom of `src/server.ts`, just before `app.listen`**

The full bottom of the file should read:

```ts
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

cron.schedule(
  config.emailCronSchedule,
  () => { void runBot({ timesheetService, emailService }, config); },
  { timezone: config.emailCronScheduleTimezone },
);
console.log(
  `Cron job scheduled: "${config.emailCronSchedule}" (${config.emailCronScheduleTimezone})`,
);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

- [ ] **Step 3: Build to confirm TypeScript compiles cleanly**

```bash
yarn build
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite**

```bash
yarn test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts
git commit -m "feat: add node-cron scheduled job to web server"
```

---

## Task 7: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append the two new optional env vars to `.env.example`**

Add these two lines at the end of `.env.example`:

```
# EMAIL_CRON_SCHEDULE=0 9 * * 1                      # cron expression for auto-send (default: Monday 9am)
# EMAIL_CRON_SCHEDULE_TIMEZONE=America/New_York       # timezone for cron schedule (default: America/New_York)
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document EMAIL_CRON_SCHEDULE and EMAIL_CRON_SCHEDULE_TIMEZONE env vars"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full test suite one last time**

```bash
yarn test
```

Expected: all tests PASS with no failures or warnings.

- [ ] **Step 2: Build the project**

```bash
yarn build
```

Expected: no TypeScript errors, `dist/` updated.
