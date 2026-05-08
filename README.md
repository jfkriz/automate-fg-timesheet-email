# automate-fg-timesheet-email

Automates weekly timesheet submission to HR. Logs into SAP Fieldglass, finds the approved timesheet for the previous week, generates a PDF, and emails it to HR. Sends an alert to you if no approved timesheet is found or if the bot encounters an error.

## How it works

1. Calculates the previous Sunday–Saturday date range (or uses a date you provide)
2. Logs into Fieldglass via Puppeteer and navigates to the timesheet list
3. Finds a row matching that date range with status "Approved"
4. Generates a PDF of that timesheet page
5. Emails the PDF to HR via Mailgun SMTP
6. On failure (not found, or any error): sends an alert email to you and exits with a non-zero code

## Prerequisites

- Node.js 18+
- A [Mailgun](https://www.mailgun.com) account with SMTP credentials
- SAP Fieldglass credentials

On NixOS / nix-shell: `nix-shell` provides Node.js and Chromium automatically.

## Setup

```bash
# Install dependencies
yarn install

# Copy and fill in environment variables
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|----------|-------------|
| `FIELDGLASS_LOGIN_URL` | Fieldglass login page URL |
| `FIELDGLASS_TIMESHEETS_URL` | Fieldglass timesheet list URL |
| `FIELDGLASS_USERNAME` | Your Fieldglass username |
| `FIELDGLASS_PASSWORD` | Your Fieldglass password |
| `SMTP_HOST` | SMTP host (e.g. `smtp.mailgun.org`) |
| `SMTP_PORT` | SMTP port (e.g. `587`) |
| `SMTP_SECURE` | `true` for port 465, `false` for port 587 |
| `EMAIL_USER` | SMTP username (Mailgun: `postmaster@yourdomain`) |
| `EMAIL_PASS` | SMTP password |
| `MY_EMAIL` | Your email address (alert recipient and sender) |
| `HR_EMAIL` | HR email address (timesheet recipient) |

## Usage

```bash
# Build
yarn build

# Run (uses previous week by default)
yarn start

# Run for a specific week (provide any date within that week)
yarn start 2026-04-30
```

The date argument is any `YYYY-MM-DD` date within the target week — the bot calculates the Sunday–Saturday range from it.

## Development

```bash
# Run tests
yarn test

# Build TypeScript
yarn build
```

### Project structure

```
src/
  interfaces/        # TypeScript contracts (IBrowserProvider, IEmailService, etc.)
  services/          # Concrete implementations (Puppeteer, Nodemailer)
  utils/             # Pure functions: date calculation, env var loading
  main.ts            # Entry point and composition root
tests/
  services/          # Unit tests for services (DI mocks)
  utils/             # Unit tests for pure utilities
```

Services are wired together only in `main.ts`. Everything else depends on interfaces, making each service independently testable without a real browser or SMTP connection.

## Automation

To run weekly, add a cron job:

```cron
0 9 * * 1 cd /path/to/repo && node dist/main.js >> /var/log/timesheet-bot.log 2>&1
```

This runs every Monday at 9am, submitting the prior week's approved timesheet.
