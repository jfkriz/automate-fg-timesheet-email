import type { AppConfig } from '../interfaces/types';

function clampHours(raw: string | undefined, defaultValue: number, minValue: number, label: string): number {
  const parsed = parseInt(raw ?? String(defaultValue), 10);
  if (isNaN(parsed) || parsed < minValue) {
    const reason = isNaN(parsed) ? `"${raw}" is not a number` : `${parsed} is below the minimum of ${minValue}`;
    console.warn(`[config] ${label}=${raw ?? '(unset)'} is invalid (${reason}); using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  const vars: Record<string, string | undefined> = {
    FIELDGLASS_LOGIN_URL: process.env.FIELDGLASS_LOGIN_URL,
    FIELDGLASS_TIMESHEETS_URL: process.env.FIELDGLASS_TIMESHEETS_URL,
    FIELDGLASS_USERNAME: process.env.FIELDGLASS_USERNAME,
    FIELDGLASS_PASSWORD: process.env.FIELDGLASS_PASSWORD,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    MY_EMAIL: process.env.MY_EMAIL,
    HR_EMAILS: process.env.HR_EMAILS,
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
      secure: vars.SMTP_SECURE === 'true',
      user: vars.EMAIL_USER!,
      pass: vars.EMAIL_PASS!,
    },
    myEmail: vars.MY_EMAIL!,
    hrEmails: vars.HR_EMAILS!,
    emailCronSchedule: process.env.EMAIL_CRON_SCHEDULE ?? '0 9 * * 1',
    emailCronScheduleTimezone: process.env.EMAIL_CRON_SCHEDULE_TIMEZONE ?? 'America/New_York',
    retryWindowHours: clampHours(process.env.RETRY_WINDOW_HOURS, 24, 1, 'RETRY_WINDOW_HOURS'),
    retryIntervalHours: clampHours(process.env.RETRY_INTERVAL_HOURS, 1, 1, 'RETRY_INTERVAL_HOURS'),
    retryStateFile: process.env.RETRY_STATE_FILE ?? '/data/retry-state.json',
  };
}
