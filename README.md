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

| Variable | Required | Description |
|----------|----------|-------------|
| `FIELDGLASS_LOGIN_URL` | ✓ | Fieldglass login page URL |
| `FIELDGLASS_TIMESHEETS_URL` | ✓ | Fieldglass timesheet list URL |
| `FIELDGLASS_USERNAME` | ✓ | Your Fieldglass username |
| `FIELDGLASS_PASSWORD` | ✓ | Your Fieldglass password |
| `SMTP_HOST` | ✓ | SMTP host (e.g. `smtp.mailgun.org`) |
| `SMTP_PORT` | ✓ | SMTP port (e.g. `587`) |
| `SMTP_SECURE` | ✓ | `true` for port 465, `false` for port 587 |
| `EMAIL_USER` | ✓ | SMTP username (Mailgun: `postmaster@yourdomain`) |
| `EMAIL_PASS` | ✓ | SMTP password |
| `MY_EMAIL` | ✓ | Your email address (alert recipient and sender) |
| `HR_EMAILS` | ✓ | HR email address(es) — comma-separated for multiple recipients |
| `EMAIL_CRON_SCHEDULE` | | Cron expression for the built-in scheduler (default: `0 9 * * 1`) |
| `EMAIL_CRON_SCHEDULE_TIMEZONE` | | Timezone for the cron schedule (default: `America/New_York`) |

## Usage

### CLI (one-shot)

```bash
# Build
yarn build

# Run (uses previous week by default)
yarn start

# Run for a specific week (provide any date within that week)
yarn start 2026-04-30
```

The date argument is any `YYYY-MM-DD` date within the target week — the bot calculates the Sunday–Saturday range from it.

### Web server (with built-in scheduler)

```bash
yarn build
yarn start:web
```

The server starts on port 3000 (override with `PORT`) and does two things:

- **Scheduled job:** automatically fetches and emails the timesheet every Monday at 9am ET (configurable via `EMAIL_CRON_SCHEDULE` and `EMAIL_CRON_SCHEDULE_TIMEZONE`)
- **Web UI:** a form at `http://localhost:3000` lets you manually fetch or send a timesheet for any week on demand

#### Docker

```bash
docker compose up
```

The container runs the web server with the built-in scheduler. Pass env vars via `.env` (already referenced in `docker-compose.yml`).

To change the schedule, set `EMAIL_CRON_SCHEDULE` in your `.env`. For example, to run every Friday at 8am Central:

```
EMAIL_CRON_SCHEDULE=0 8 * * 5
EMAIL_CRON_SCHEDULE_TIMEZONE=America/Chicago
```

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
  utils/
    config.ts        # Loads and validates env vars
    dateUtils.ts     # Week range calculation
    runBot.ts        # Shared automation logic (fetch → email HR or alert)
  main.ts            # CLI entry point
  server.ts          # Web server entry point (Express + cron scheduler)
  public/
    index.html       # Manual trigger UI
tests/
  services/          # Unit tests for services (DI mocks)
  utils/             # Unit tests for pure utilities
```

Services are wired together only in the entry points (`main.ts`, `server.ts`). Everything else depends on interfaces, making each service independently testable without a real browser or SMTP connection. The shared `runBot()` function contains the core automation logic used by both entry points.

## Automation

The web server (`yarn start:web` or Docker) includes a built-in scheduler — no external cron setup needed. It runs the full automation (fetch + email HR, or alert on failure) on the configured schedule.

If you prefer to use the CLI with an external scheduler instead:

```cron
0 9 * * 1 cd /path/to/repo && node dist/main.js >> /var/log/timesheet-bot.log 2>&1
```
