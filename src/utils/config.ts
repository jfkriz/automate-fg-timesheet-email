import type { AppConfig } from '../interfaces/types';

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
      secure: vars.SMTP_SECURE === 'true',
      user: vars.EMAIL_USER!,
      pass: vars.EMAIL_PASS!,
    },
    myEmail: vars.MY_EMAIL!,
    hrEmail: vars.HR_EMAIL!,
    emailCronSchedule: process.env.EMAIL_CRON_SCHEDULE ?? '0 9 * * 1',
    emailCronScheduleTimezone: process.env.EMAIL_CRON_SCHEDULE_TIMEZONE ?? 'America/New_York',
  };
}
