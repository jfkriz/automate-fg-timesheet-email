# Web Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Dockerized Express web server as a second entry point that exposes a form to fetch and optionally email a Fieldglass timesheet PDF.

**Architecture:** A new `src/server.ts` composition root instantiates the same service layer as the CLI and wires it to two Express routes (`GET /` and `POST /api/submit`). No shared state with `src/main.ts`; both compile to `dist/` from the existing `tsconfig.build.json`. A multi-stage Dockerfile plus `docker-compose.yml` wrap the server for deployment.

**Tech Stack:** Express 5, TypeScript, Puppeteer, Nodemailer, Docker (node:20-alpine build / node:20-slim runtime)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `package.json` | Add `express` dep, `@types/express` devDep, `start:web` script |
| Modify | `src/services/PuppeteerBrowserProvider.ts` | Respect `PUPPETEER_EXECUTABLE_PATH` env var for Docker |
| Create | `src/server.ts` | Express entry point: GET / and POST /api/submit |
| Create | `src/public/index.html` | Form HTML + vanilla JS (no framework) |
| Modify | `tests/utils/config.test.ts` | Add HR_EMAIL regression guard |
| Create | `Dockerfile` | Multi-stage build |
| Create | `docker-compose.yml` | Compose config |

---

### Task 1: Add Express dependency and start:web script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add express and @types/express**

```bash
yarn add express
yarn add -D @types/express
```

- [ ] **Step 2: Add start:web script to package.json**

Open `package.json` and add `"start:web": "node dist/server.js"` to the `scripts` block:

```json
"scripts": {
  "build": "tsc -p tsconfig.build.json",
  "start": "node dist/main.js",
  "start:web": "node dist/server.js",
  "test": "jest"
},
```

- [ ] **Step 3: Verify build still works**

```bash
yarn build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add express dependency and start:web script"
```

---

### Task 2: Add HR_EMAIL regression guard test

**Files:**
- Modify: `tests/utils/config.test.ts`

This test is a regression guard — it ensures `HR_EMAIL` remains required in `loadConfig()`. It should pass immediately without any code changes.

- [ ] **Step 1: Add the test**

Open `tests/utils/config.test.ts` and add this test inside the existing `describe('loadConfig', ...)` block, after the last existing `it(...)`:

```typescript
it('throws when only HR_EMAIL is missing', () => {
  delete process.env.HR_EMAIL;
  expect(() => loadConfig()).toThrow('HR_EMAIL');
});
```

- [ ] **Step 2: Run the new test to verify it passes**

```bash
yarn test tests/utils/config.test.ts
```

Expected: all 5 tests pass (the new test passes immediately — it is a guard, not a change driver).

- [ ] **Step 3: Commit**

```bash
git add tests/utils/config.test.ts
git commit -m "test: add HR_EMAIL regression guard to config tests"
```

---

### Task 3: Update PuppeteerBrowserProvider to support Docker executable path

**Files:**
- Modify: `src/services/PuppeteerBrowserProvider.ts`

In Docker, Puppeteer must use the system Chromium (installed via apt) rather than its bundled binary. This is controlled by `PUPPETEER_EXECUTABLE_PATH`. When the env var is absent (local dev), `undefined` is passed and Puppeteer falls back to its bundled browser — identical to current behavior.

- [ ] **Step 1: Update the launch call**

Replace the contents of `src/services/PuppeteerBrowserProvider.ts` with:

```typescript
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import type { IBrowserProvider } from '../interfaces/IBrowserProvider';

export class PuppeteerBrowserProvider implements IBrowserProvider {
  async launch(): Promise<Browser> {
    return puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}
```

- [ ] **Step 2: Run existing tests to verify no regression**

```bash
yarn test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/services/PuppeteerBrowserProvider.ts
git commit -m "feat: support PUPPETEER_EXECUTABLE_PATH for Docker Chromium"
```

---

### Task 4: Create src/server.ts

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Create the file**

Create `src/server.ts` with the following content:

```typescript
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import express from 'express';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { loadConfig } from './utils/config';
import { getTargetWeekRange } from './utils/dateUtils';
import { PuppeteerBrowserProvider } from './services/PuppeteerBrowserProvider';
import { PuppeteerTimesheetService } from './services/PuppeteerTimesheetService';
import { NodemailerEmailService } from './services/NodemailerEmailService';

const config = loadConfig();

const browserProvider = new PuppeteerBrowserProvider();
const timesheetService = new PuppeteerTimesheetService(browserProvider, config.timesheet);
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});
const emailService = new NodemailerEmailService(transporter);

const htmlTemplate = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'public', 'index.html'),
  'utf8',
);

const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  const { end: defaultDate } = getTargetWeekRange();
  const html = htmlTemplate
    .replace('{{DEFAULT_DATE}}', defaultDate)
    .replace('{{HR_EMAIL}}', config.hrEmail);
  res.send(html);
});

app.post('/api/submit', async (req, res) => {
  const { date, sendEmail, recipientEmail } = req.body as {
    date?: string;
    sendEmail?: boolean;
    recipientEmail?: string;
  };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ status: 'error', message: 'date must be in YYYY-MM-DD format' });
    return;
  }
  if (sendEmail && !recipientEmail) {
    res.status(400).json({ status: 'error', message: 'recipientEmail is required when sending email' });
    return;
  }

  try {
    const dateRange = getTargetWeekRange(new Date(`${date}T12:00:00`));
    const pdfBuffer = await timesheetService.fetchTimesheetPdf(dateRange);

    if (!pdfBuffer) {
      res.json({ status: 'not_found', message: `No approved timesheet found for week ending ${dateRange.end}` });
      return;
    }

    if (sendEmail) {
      const filename = `Timesheet_Ending_${dateRange.end}.pdf`;
      await emailService.send({
        from: config.myEmail,
        to: recipientEmail!,
        subject: `Timesheet Approved - Period Ending ${dateRange.end}`,
        text: `Attached is the approved timesheet for the week ending ${dateRange.end}.`,
        attachment: { filename, content: pdfBuffer },
      });
      res.json({ status: 'sent', message: `Timesheet for week ending ${dateRange.end} sent to ${recipientEmail}` });
      return;
    }

    const filename = `Timesheet_Ending_${dateRange.end}.pdf`;
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ status: 'error', message: 'An error occurred. Check server logs.' });
  }
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

- [ ] **Step 2: Verify it compiles**

```bash
yarn build
```

Expected: exits 0. `dist/server.js` now exists alongside `dist/main.js`.

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add Express web server entry point"
```

---

### Task 5: Create src/public/index.html

**Files:**
- Create: `src/public/index.html`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p src/public
```

Create `src/public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timesheet Submission</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 48px auto; padding: 0 16px; color: #333; }
    h1 { font-size: 1.4rem; margin-bottom: 24px; }
    .field { margin-bottom: 18px; }
    .field label { display: block; font-size: 13px; font-weight: 600; color: #555; margin-bottom: 6px; }
    input[type="date"], input[type="email"] {
      padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px;
      font-size: 14px; width: 100%; box-sizing: border-box;
    }
    .checkbox-label { display: flex; align-items: center; gap: 8px; font-weight: normal; color: #333; cursor: pointer; }
    .checkbox-label input { width: 16px; height: 16px; flex-shrink: 0; }
    #recipient-field { display: none; }
    button {
      padding: 10px 20px; background: #1a73e8; color: white;
      border: none; border-radius: 4px; font-size: 14px; cursor: pointer;
    }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    #result {
      margin-top: 20px; padding: 12px 16px; border-radius: 6px;
      font-size: 13px; display: none;
    }
    #result.sent     { background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; }
    #result.not_found { background: #fff3e0; border: 1px solid #ffcc80; color: #e65100; }
    #result.error    { background: #ffebee; border: 1px solid #ef9a9a; color: #c62828; }
  </style>
</head>
<body>
  <h1>Timesheet Submission</h1>
  <form id="form">
    <div class="field">
      <label for="date">Timesheet week ending date</label>
      <input type="date" id="date" name="date" value="{{DEFAULT_DATE}}" required>
    </div>
    <div class="field">
      <label class="checkbox-label">
        <input type="checkbox" id="send-email">
        Send timesheet email to recipient
      </label>
    </div>
    <div class="field" id="recipient-field">
      <label for="recipient">Recipient email <span style="color:#c00">*</span></label>
      <input type="email" id="recipient" name="recipient" value="{{HR_EMAIL}}" placeholder="hr@company.com">
    </div>
    <button type="submit" id="submit-btn">Fetch Timesheet PDF</button>
  </form>
  <div id="result"></div>

  <script>
    const checkbox = document.getElementById('send-email');
    const recipientField = document.getElementById('recipient-field');
    const recipientInput = document.getElementById('recipient');
    const submitBtn = document.getElementById('submit-btn');
    const resultDiv = document.getElementById('result');

    checkbox.addEventListener('change', () => {
      const checked = checkbox.checked;
      recipientField.style.display = checked ? 'block' : 'none';
      recipientInput.required = checked;
      submitBtn.textContent = checked ? 'Fetch & Send Timesheet' : 'Fetch Timesheet PDF';
    });

    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      resultDiv.style.display = 'none';
      resultDiv.className = '';

      const date = document.getElementById('date').value;
      const sendEmail = checkbox.checked;
      const body = { date, sendEmail };
      if (sendEmail) body.recipientEmail = recipientInput.value;

      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('application/pdf')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } else {
          const data = await response.json();
          resultDiv.textContent = data.message;
          resultDiv.className = data.status;
          resultDiv.style.display = 'block';
        }
      } catch {
        resultDiv.textContent = 'Network error. Check server logs.';
        resultDiv.className = 'error';
        resultDiv.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Smoke-test the server locally**

Ensure a `.env` file exists with valid values (copy from `.env.example` and fill in real credentials), then:

```bash
yarn build && node dist/server.js
```

Expected output: `Server running on port 3000`

Open `http://localhost:3000` in a browser. Verify:
- The date picker shows last Saturday's date.
- The recipient email field is hidden.
- Checking the checkbox shows the recipient field pre-filled with `HR_EMAIL`.
- Button label changes between "Fetch Timesheet PDF" and "Fetch & Send Timesheet".

Kill the server with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add src/public/index.html
git commit -m "feat: add timesheet submission web form"
```

---

### Task 6: Create Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create the Dockerfile**

Create `Dockerfile` at the project root:

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN yarn build

# Runtime stage
FROM node:20-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY --from=build /app/dist ./dist
COPY src/public ./src/public

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

- [ ] **Step 2: Build the image**

```bash
docker build -t automate-fg-timesheet-email .
```

Expected: build succeeds, both stages complete without errors.

- [ ] **Step 3: Verify the container starts**

```bash
docker run --rm --env-file .env -p 3000:3000 automate-fg-timesheet-email
```

Expected: `Server running on port 3000`. Open `http://localhost:3000` to verify the form loads. Kill with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "feat: add multi-stage Dockerfile for web server"
```

---

### Task 7: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create the file**

Create `docker-compose.yml` at the project root:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
```

- [ ] **Step 2: Verify it starts**

```bash
docker compose up --build
```

Expected: image builds, container starts, logs show `Server running on port 3000`. Open `http://localhost:3000` to verify. Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml for web server deployment"
```
