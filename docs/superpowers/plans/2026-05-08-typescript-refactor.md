# TypeScript Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the single-file JS script into a structured TypeScript app with service layers, dependency injection, and Jest unit tests.

**Architecture:** Interface-driven DI — `IBrowserProvider`, `ITimesheetService`, and `IEmailService` define the contracts; concrete implementations live in `src/services/`; `main.ts` is the sole composition root that wires everything together. Tests inject fakes that satisfy each interface.

**Tech Stack:** TypeScript 5, Jest 29, ts-jest, puppeteer 24, nodemailer 8, dotenv

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `tsconfig.json` | Create | IDE + test compilation |
| `tsconfig.build.json` | Create | Production build only (`src/` → `dist/`) |
| `jest.config.ts` | Create | Jest with ts-jest preset |
| `package.json` | Modify | Add scripts + dev deps |
| `src/interfaces/types.ts` | Create | Shared types: `DateRange`, `EmailOptions`, `AppConfig`, `TimesheetConfig` |
| `src/interfaces/IBrowserProvider.ts` | Create | Contract for Puppeteer browser factory |
| `src/interfaces/ITimesheetService.ts` | Create | Contract for PDF fetching |
| `src/interfaces/IEmailService.ts` | Create | Contract for email sending |
| `src/utils/dateUtils.ts` | Create | Pure: `getTargetWeekRange(referenceDate?)` |
| `src/utils/config.ts` | Create | `loadConfig()` — reads + validates env vars |
| `src/services/PuppeteerBrowserProvider.ts` | Create | Thin adapter: `puppeteer.launch()` with Nix args |
| `src/services/PuppeteerTimesheetService.ts` | Create | Puppeteer login + PDF fetch |
| `src/services/NodemailerEmailService.ts` | Create | Nodemailer send wrapper |
| `src/main.ts` | Create | CLI entry point + composition root |
| `tests/utils/dateUtils.test.ts` | Create | Unit tests for date calculation |
| `tests/utils/config.test.ts` | Create | Unit tests for env var loading |
| `tests/services/emailService.test.ts` | Create | Unit tests for email service |
| `tests/services/timesheetService.test.ts` | Create | Unit tests for timesheet service |
| `.env.example` | Modify | Add missing SMTP + email vars |
| `src/retrieve-timesheet.js` | Delete | Replaced by TypeScript implementation |

---

## Task 1: Configure TypeScript and Jest tooling

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `jest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dev dependencies**

```bash
yarn add --dev typescript ts-jest jest @types/jest @types/nodemailer
```

Expected: packages added to `node_modules/`, `package.json` devDependencies updated.

- [ ] **Step 2: Create `tsconfig.json`** (used by IDE and Jest)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "tests/**/*", "jest.config.ts"]
}
```

- [ ] **Step 3: Create `tsconfig.build.json`** (used only for `yarn build`)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
};

export default config;
```

- [ ] **Step 5: Update `package.json` scripts**

Replace the existing `package.json` with:

```json
{
  "name": "automate-fg-timesheet-email",
  "version": "1.0.0",
  "main": "dist/main.js",
  "license": "MIT",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js",
    "test": "jest"
  },
  "dependencies": {
    "dotenv": "^17.4.2",
    "nodemailer": "^8.0.7",
    "puppeteer": "^24.42.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/nodemailer": "^6.4.14",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.4",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 6: Verify Jest runs (no tests yet)**

```bash
yarn test
```

Expected output contains: `No tests found` or `Test Suites: 0 passed`. No compilation errors.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json tsconfig.build.json jest.config.ts package.json yarn.lock
git commit -m "chore: add TypeScript and Jest tooling"
```

---

## Task 2: Define shared types and interfaces

**Files:**
- Create: `src/interfaces/types.ts`
- Create: `src/interfaces/IBrowserProvider.ts`
- Create: `src/interfaces/ITimesheetService.ts`
- Create: `src/interfaces/IEmailService.ts`

- [ ] **Step 1: Create `src/interfaces/types.ts`**

```typescript
export interface DateRange {
  start: string;
  end: string;
}

export interface EmailOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer };
}

export interface TimesheetConfig {
  loginUrl: string;
  timesheetsUrl: string;
  username: string;
  password: string;
}

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
}
```

- [ ] **Step 2: Create `src/interfaces/IBrowserProvider.ts`**

```typescript
import type { Browser } from 'puppeteer';

export interface IBrowserProvider {
  launch(): Promise<Browser>;
}
```

- [ ] **Step 3: Create `src/interfaces/ITimesheetService.ts`**

```typescript
import type { DateRange } from './types';

export interface ITimesheetService {
  fetchTimesheetPdf(dates: DateRange): Promise<Buffer | null>;
}
```

- [ ] **Step 4: Create `src/interfaces/IEmailService.ts`**

```typescript
import type { EmailOptions } from './types';

export interface IEmailService {
  send(options: EmailOptions): Promise<void>;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
yarn build
```

Expected: `dist/` directory is not created yet (no `src/` files besides interfaces), but `tsc` should exit 0 with no errors. If `dist/` is empty or missing that's fine — no `src/` files have been written yet that produce output.

- [ ] **Step 6: Commit**

```bash
git add src/interfaces/
git commit -m "feat: add shared types and service interfaces"
```

---

## Task 3: Implement `dateUtils` with TDD

**Files:**
- Create: `tests/utils/dateUtils.test.ts`
- Create: `src/utils/dateUtils.ts`

- [ ] **Step 1: Create `tests/utils/dateUtils.test.ts`**

```typescript
import { getTargetWeekRange } from '../../src/utils/dateUtils';

describe('getTargetWeekRange', () => {
  it('returns previous Sunday-Saturday for a Wednesday reference', () => {
    const result = getTargetWeekRange(new Date('2026-05-06T12:00:00'));
    expect(result).toEqual({ start: '2026-04-26', end: '2026-05-02' });
  });

  it('returns the just-completed week when reference is Saturday', () => {
    const result = getTargetWeekRange(new Date('2026-05-02T12:00:00'));
    expect(result).toEqual({ start: '2026-04-26', end: '2026-05-02' });
  });

  it('returns the previous week when reference is Sunday', () => {
    const result = getTargetWeekRange(new Date('2026-05-03T12:00:00'));
    expect(result).toEqual({ start: '2026-04-26', end: '2026-05-02' });
  });

  it('returns the previous week when reference is Monday', () => {
    const result = getTargetWeekRange(new Date('2026-05-04T12:00:00'));
    expect(result).toEqual({ start: '2026-04-26', end: '2026-05-02' });
  });

  it('does not throw when called with no arguments', () => {
    expect(() => getTargetWeekRange()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
yarn jest tests/utils/dateUtils.test.ts
```

Expected: `FAIL` with `Cannot find module '../../src/utils/dateUtils'`

- [ ] **Step 3: Create `src/utils/dateUtils.ts`**

```typescript
import type { DateRange } from '../interfaces/types';

export function getTargetWeekRange(referenceDate: Date = new Date()): DateRange {
  const lastSaturday = new Date(referenceDate);
  lastSaturday.setDate(referenceDate.getDate() - ((referenceDate.getDay() + 1) % 7));

  const oneWeekAgoSunday = new Date(lastSaturday);
  oneWeekAgoSunday.setDate(lastSaturday.getDate() - 6);

  return {
    start: formatDate(oneWeekAgoSunday),
    end: formatDate(lastSaturday),
  };
}

function formatDate(date: Date): string {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
yarn jest tests/utils/dateUtils.test.ts
```

Expected: `PASS tests/utils/dateUtils.test.ts` with 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dateUtils.ts tests/utils/dateUtils.test.ts
git commit -m "feat: add dateUtils with getTargetWeekRange"
```

---

## Task 4: Implement `config.ts` with TDD

**Files:**
- Create: `tests/utils/config.test.ts`
- Create: `src/utils/config.ts`

- [ ] **Step 1: Create `tests/utils/config.test.ts`**

```typescript
import { loadConfig } from '../../src/utils/config';

const validEnv: Record<string, string> = {
  FIELDGLASS_LOGIN_URL: 'https://example.com/login',
  FIELDGLASS_TIMESHEETS_URL: 'https://example.com/timesheets',
  FIELDGLASS_USERNAME: 'user',
  FIELDGLASS_PASSWORD: 'pass',
  SMTP_HOST: 'smtp.mailgun.org',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  EMAIL_USER: 'postmaster@mg.example.com',
  EMAIL_PASS: 'secret',
  MY_EMAIL: 'me@example.com',
  HR_EMAIL: 'hr@example.com',
};

describe('loadConfig', () => {
  beforeEach(() => {
    Object.entries(validEnv).forEach(([k, v]) => { process.env[k] = v; });
  });

  afterEach(() => {
    Object.keys(validEnv).forEach((k) => { delete process.env[k]; });
  });

  it('returns a typed config when all vars are set', () => {
    const config = loadConfig();
    expect(config.timesheet.loginUrl).toBe('https://example.com/login');
    expect(config.timesheet.timesheetsUrl).toBe('https://example.com/timesheets');
    expect(config.timesheet.username).toBe('user');
    expect(config.timesheet.password).toBe('pass');
    expect(config.smtp.host).toBe('smtp.mailgun.org');
    expect(config.smtp.port).toBe(587);
    expect(config.smtp.secure).toBe(false);
    expect(config.smtp.user).toBe('postmaster@mg.example.com');
    expect(config.smtp.pass).toBe('secret');
    expect(config.myEmail).toBe('me@example.com');
    expect(config.hrEmail).toBe('hr@example.com');
  });

  it('parses SMTP_SECURE=true as boolean true', () => {
    process.env.SMTP_SECURE = 'true';
    const config = loadConfig();
    expect(config.smtp.secure).toBe(true);
  });

  it('throws listing all missing variables', () => {
    delete process.env.SMTP_HOST;
    delete process.env.HR_EMAIL;
    expect(() => loadConfig()).toThrow('SMTP_HOST, HR_EMAIL');
  });

  it('throws with a single missing variable name', () => {
    delete process.env.FIELDGLASS_PASSWORD;
    expect(() => loadConfig()).toThrow('FIELDGLASS_PASSWORD');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
yarn jest tests/utils/config.test.ts
```

Expected: `FAIL` with `Cannot find module '../../src/utils/config'`

- [ ] **Step 3: Create `src/utils/config.ts`**

```typescript
import type { AppConfig } from '../interfaces/types';

export function loadConfig(): AppConfig {
  const vars: Record<string, string | undefined> = {
    FIELDGLASS_LOGIN_URL: process.env.FIELDGLASS_LOGIN_URL,
    FIELDGLASS_TIMESHEETS_URL: process.env.FIELDGLASS_TIMESHEETS_URL,
    FIELDGLASS_USERNAME: process.env.FIELDGLASS_USERNAME,
    FIELDGLASS_PASSWORD: process.env.FIELDGLASS_PASSWORD,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    MY_EMAIL: process.env.MY_EMAIL,
    HR_EMAIL: process.env.HR_EMAIL,
  };

  const missing = Object.entries(vars)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

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
      secure: process.env.SMTP_SECURE === 'true',
      user: vars.EMAIL_USER!,
      pass: vars.EMAIL_PASS!,
    },
    myEmail: vars.MY_EMAIL!,
    hrEmail: vars.HR_EMAIL!,
  };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
yarn jest tests/utils/config.test.ts
```

Expected: `PASS tests/utils/config.test.ts` with 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/config.ts tests/utils/config.test.ts
git commit -m "feat: add config loader with env var validation"
```

---

## Task 5: Implement `NodemailerEmailService` with TDD

**Files:**
- Create: `tests/services/emailService.test.ts`
- Create: `src/services/NodemailerEmailService.ts`

- [ ] **Step 1: Create `tests/services/emailService.test.ts`**

```typescript
import { NodemailerEmailService } from '../../src/services/NodemailerEmailService';
import type { Transporter } from 'nodemailer';

describe('NodemailerEmailService', () => {
  let mockSendMail: jest.Mock;
  let mockTransporter: Transporter;
  let service: NodemailerEmailService;

  beforeEach(() => {
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    mockTransporter = { sendMail: mockSendMail } as unknown as Transporter;
    service = new NodemailerEmailService(mockTransporter);
  });

  it('calls sendMail with correct fields when no attachment', async () => {
    await service.send({
      from: 'me@example.com',
      to: 'hr@example.com',
      subject: 'Test Subject',
      text: 'Test body',
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'me@example.com',
      to: 'hr@example.com',
      subject: 'Test Subject',
      text: 'Test body',
      attachments: [],
    });
  });

  it('includes attachment when provided', async () => {
    const content = Buffer.from([1, 2, 3]);
    await service.send({
      from: 'me@example.com',
      to: 'hr@example.com',
      subject: 'Timesheet',
      text: 'See attached',
      attachment: { filename: 'timesheet.pdf', content },
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'me@example.com',
      to: 'hr@example.com',
      subject: 'Timesheet',
      text: 'See attached',
      attachments: [{ filename: 'timesheet.pdf', content }],
    });
  });

  it('propagates errors thrown by sendMail', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

    await expect(
      service.send({ from: 'me@example.com', to: 'hr@example.com', subject: 'x', text: 'y' }),
    ).rejects.toThrow('SMTP connection refused');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
yarn jest tests/services/emailService.test.ts
```

Expected: `FAIL` with `Cannot find module '../../src/services/NodemailerEmailService'`

- [ ] **Step 3: Create `src/services/NodemailerEmailService.ts`**

```typescript
import type { Transporter } from 'nodemailer';
import type { IEmailService } from '../interfaces/IEmailService';
import type { EmailOptions } from '../interfaces/types';

export class NodemailerEmailService implements IEmailService {
  constructor(private readonly transporter: Transporter) {}

  async send(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      attachments: options.attachment
        ? [{ filename: options.attachment.filename, content: options.attachment.content }]
        : [],
    });
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
yarn jest tests/services/emailService.test.ts
```

Expected: `PASS tests/services/emailService.test.ts` with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/services/NodemailerEmailService.ts tests/services/emailService.test.ts
git commit -m "feat: add NodemailerEmailService"
```

---

## Task 6: Implement `PuppeteerBrowserProvider`

This is a thin adapter with no meaningful logic to unit test — it delegates entirely to `puppeteer.launch()`.

**Files:**
- Create: `src/services/PuppeteerBrowserProvider.ts`

- [ ] **Step 1: Create `src/services/PuppeteerBrowserProvider.ts`**

```typescript
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import type { IBrowserProvider } from '../interfaces/IBrowserProvider';

export class PuppeteerBrowserProvider implements IBrowserProvider {
  async launch(): Promise<Browser> {
    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
yarn build
```

Expected: exits 0, `dist/` now contains compiled output for all `src/` files written so far.

- [ ] **Step 3: Commit**

```bash
git add src/services/PuppeteerBrowserProvider.ts
git commit -m "feat: add PuppeteerBrowserProvider adapter"
```

---

## Task 7: Implement `PuppeteerTimesheetService` with TDD

**Files:**
- Create: `tests/services/timesheetService.test.ts`
- Create: `src/services/PuppeteerTimesheetService.ts`

- [ ] **Step 1: Create `tests/services/timesheetService.test.ts`**

```typescript
import { PuppeteerTimesheetService } from '../../src/services/PuppeteerTimesheetService';
import type { IBrowserProvider } from '../../src/interfaces/IBrowserProvider';
import type { Browser, Page } from 'puppeteer';

function makeMockPage() {
  return {
    goto: jest.fn().mockResolvedValue(null),
    type: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    waitForNavigation: jest.fn().mockResolvedValue(null),
    waitForNetworkIdle: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(null),
    evaluate: jest.fn(),
    pdf: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  };
}

const testConfig = {
  loginUrl: 'https://example.com/login',
  timesheetsUrl: 'https://example.com/timesheets',
  username: 'testuser',
  password: 'testpass',
};

const testDates = { start: '2026-04-26', end: '2026-05-02' };

describe('PuppeteerTimesheetService', () => {
  let mockPage: ReturnType<typeof makeMockPage>;
  let mockBrowser: { newPage: jest.Mock; close: jest.Mock };
  let mockBrowserProvider: IBrowserProvider;
  let service: PuppeteerTimesheetService;

  beforeEach(() => {
    mockPage = makeMockPage();
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    mockBrowserProvider = {
      launch: jest.fn().mockResolvedValue(mockBrowser as unknown as Browser),
    };
    service = new PuppeteerTimesheetService(mockBrowserProvider, testConfig);
  });

  it('returns a Buffer when an approved timesheet row is found', async () => {
    mockPage.evaluate.mockResolvedValue({ found: true, url: 'https://example.com/ts/123' });

    const result = await service.fetchTimesheetPdf(testDates);

    expect(result).toBeInstanceOf(Buffer);
    expect(result).toEqual(Buffer.from([1, 2, 3]));
  });

  it('returns null when no approved row is found', async () => {
    mockPage.evaluate.mockResolvedValue({ found: false, url: '' });

    const result = await service.fetchTimesheetPdf(testDates);

    expect(result).toBeNull();
  });

  it('throws when page navigation fails', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('net::ERR_CONNECTION_REFUSED'));

    await expect(service.fetchTimesheetPdf(testDates)).rejects.toThrow(
      'net::ERR_CONNECTION_REFUSED',
    );
  });

  it('closes the browser even when an error is thrown', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

    await expect(service.fetchTimesheetPdf(testDates)).rejects.toThrow();

    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('always closes the browser on success', async () => {
    mockPage.evaluate.mockResolvedValue({ found: false, url: '' });

    await service.fetchTimesheetPdf(testDates);

    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
yarn jest tests/services/timesheetService.test.ts
```

Expected: `FAIL` with `Cannot find module '../../src/services/PuppeteerTimesheetService'`

- [ ] **Step 3: Create `src/services/PuppeteerTimesheetService.ts`**

```typescript
import type { IBrowserProvider } from '../interfaces/IBrowserProvider';
import type { ITimesheetService } from '../interfaces/ITimesheetService';
import type { DateRange, TimesheetConfig } from '../interfaces/types';

export class PuppeteerTimesheetService implements ITimesheetService {
  constructor(
    private readonly browserProvider: IBrowserProvider,
    private readonly config: TimesheetConfig,
  ) {}

  async fetchTimesheetPdf(dates: DateRange): Promise<Buffer | null> {
    const browser = await this.browserProvider.launch();
    try {
      const page = await browser.newPage();

      await page.goto(this.config.loginUrl);
      await page.type('input[name="username"]', this.config.username);
      await page.type('input[name="password"]', this.config.password);
      await Promise.all([
        page.click('#primary_content > div.entryLoginInput_button > button'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
      ]);

      await page.goto(this.config.timesheetsUrl);
      await page.waitForNetworkIdle();
      await page.waitForSelector('#contenttabletimeSheet_worker_list');

      const result = await page.evaluate(
        (start: string, end: string) => {
          const rows = Array.from(
            document.querySelectorAll('#contenttabletimeSheet_worker_list > [role="row"]'),
          );
          const targetRow = rows.find((r) => {
            const text = (r as HTMLElement).innerText;
            return text.includes(start) && text.includes(end) && text.includes('Approved');
          });
          if (targetRow) {
            const link = targetRow.querySelector('a') as HTMLAnchorElement;
            return { found: true, url: link.href };
          }
          return { found: false, url: '' };
        },
        dates.start,
        dates.end,
      ) as { found: boolean; url: string };

      if (!result.found) {
        return null;
      }

      await page.goto(result.url);
      await page.waitForNetworkIdle();

      const pdfBytes = await page.pdf({ format: 'LETTER', printBackground: true });
      return Buffer.from(pdfBytes);
    } finally {
      await browser.close();
    }
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
yarn jest tests/services/timesheetService.test.ts
```

Expected: `PASS tests/services/timesheetService.test.ts` with 5 tests passing.

- [ ] **Step 5: Run full test suite**

```bash
yarn test
```

Expected: all test files pass. Note the count: `Tests: 17 passed` (5 dateUtils + 4 config + 3 email + 5 timesheet).

- [ ] **Step 6: Commit**

```bash
git add src/services/PuppeteerTimesheetService.ts tests/services/timesheetService.test.ts
git commit -m "feat: add PuppeteerTimesheetService with DI"
```

---

## Task 8: Implement `main.ts`

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Create `src/main.ts`**

```typescript
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { loadConfig } from './utils/config';
import { getTargetWeekRange } from './utils/dateUtils';
import { PuppeteerBrowserProvider } from './services/PuppeteerBrowserProvider';
import { PuppeteerTimesheetService } from './services/PuppeteerTimesheetService';
import { NodemailerEmailService } from './services/NodemailerEmailService';
import type { IEmailService } from './interfaces/IEmailService';

async function main(): Promise<void> {
  const dateArg = process.argv[2];
  if (dateArg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    console.error(`Invalid date format: "${dateArg}". Expected YYYY-MM-DD.`);
    process.exit(1);
  }

  const config = loadConfig();

  const referenceDate = dateArg ? new Date(`${dateArg}T12:00:00`) : undefined;
  const dateRange = getTargetWeekRange(referenceDate);

  const browserProvider = new PuppeteerBrowserProvider();
  const timesheetService = new PuppeteerTimesheetService(browserProvider, config.timesheet);
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  const emailService = new NodemailerEmailService(transporter);

  try {
    const pdfBuffer = await timesheetService.fetchTimesheetPdf(dateRange);

    if (!pdfBuffer) {
      await sendAlert(emailService, config.myEmail, dateRange.end);
      console.error(`No approved timesheet found for week ending ${dateRange.end}.`);
      process.exit(1);
    }

    const filename = `Timesheet_Ending_${dateRange.end}.pdf`;
    fs.writeFileSync(path.join(process.cwd(), filename), pdfBuffer);

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
    process.exit(1);
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

main();
```

- [ ] **Step 2: Build and verify compilation**

```bash
yarn build
```

Expected: exits 0, `dist/main.js` exists.

- [ ] **Step 3: Run full test suite to confirm nothing regressed**

```bash
yarn test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: add main entry point with CLI date arg and error handling"
```

---

## Task 9: Update `.env.example` and remove old JS file

**Files:**
- Modify: `.env.example`
- Delete: `src/retrieve-timesheet.js`

- [ ] **Step 1: Update `.env.example`**

Replace the contents of `.env.example` with:

```
FIELDGLASS_LOGIN_URL=https://www.us.fieldglass.cloud.sap/login.do
FIELDGLASS_TIMESHEETS_URL=https://www.us.fieldglass.cloud.sap/time_sheet_list.do
FIELDGLASS_USERNAME=your_username_here
FIELDGLASS_PASSWORD=your_password_here
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=postmaster@yourdomain.mailgun.org
EMAIL_PASS=your_mailgun_smtp_password
MY_EMAIL=your_email@example.com
HR_EMAIL=hr@yourcompany.com
```

- [ ] **Step 2: Delete the old JS file**

```bash
rm src/retrieve-timesheet.js
```

- [ ] **Step 3: Final build and test**

```bash
yarn build && yarn test
```

Expected: build succeeds, all 17 tests pass.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git rm src/retrieve-timesheet.js
git commit -m "chore: update .env.example and remove old JS entry point"
```
