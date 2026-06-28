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
  HR_EMAILS: 'hr@example.com',
};

describe('loadConfig', () => {
  beforeEach(() => {
    Object.entries(validEnv).forEach(([k, v]) => { process.env[k] = v; });
  });

  afterEach(() => {
    Object.keys(validEnv).forEach((k) => { delete process.env[k]; });
    delete process.env.EMAIL_CRON_SCHEDULE;
    delete process.env.EMAIL_CRON_SCHEDULE_TIMEZONE;
    delete process.env.RETRY_WINDOW_HOURS;
    delete process.env.RETRY_INTERVAL_HOURS;
    delete process.env.RETRY_STATE_FILE;
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
    expect(config.hrEmails).toBe('hr@example.com');
  });

  it('parses SMTP_SECURE=true as boolean true', () => {
    process.env.SMTP_SECURE = 'true';
    const config = loadConfig();
    expect(config.smtp.secure).toBe(true);
  });

  it('throws listing all missing variables', () => {
    delete process.env.SMTP_HOST;
    delete process.env.HR_EMAILS;
    expect(() => loadConfig()).toThrow('SMTP_HOST, HR_EMAILS');
  });

  it('throws with a single missing variable name', () => {
    delete process.env.FIELDGLASS_PASSWORD;
    expect(() => loadConfig()).toThrow('FIELDGLASS_PASSWORD');
  });

  it('throws when only HR_EMAILS is missing', () => {
    delete process.env.HR_EMAILS;
    expect(() => loadConfig()).toThrow('HR_EMAILS');
  });

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

  it('defaults retryWindowHours to 24 when RETRY_WINDOW_HOURS is absent', () => {
    const config = loadConfig();
    expect(config.retryWindowHours).toBe(24);
  });

  it('uses RETRY_WINDOW_HOURS when set', () => {
    process.env.RETRY_WINDOW_HOURS = '48';
    const config = loadConfig();
    expect(config.retryWindowHours).toBe(48);
  });

  it('defaults retryIntervalHours to 1 when RETRY_INTERVAL_HOURS is absent', () => {
    const config = loadConfig();
    expect(config.retryIntervalHours).toBe(1);
  });

  it('uses RETRY_INTERVAL_HOURS when set', () => {
    process.env.RETRY_INTERVAL_HOURS = '2';
    const config = loadConfig();
    expect(config.retryIntervalHours).toBe(2);
  });

  it('defaults retryStateFile to "/data/retry-state.json" when RETRY_STATE_FILE is absent', () => {
    const config = loadConfig();
    expect(config.retryStateFile).toBe('/data/retry-state.json');
  });

  it('uses RETRY_STATE_FILE when set', () => {
    process.env.RETRY_STATE_FILE = '/tmp/test-retry.json';
    const config = loadConfig();
    expect(config.retryStateFile).toBe('/tmp/test-retry.json');
  });

  it('clamps RETRY_INTERVAL_HOURS=0 to minimum of 1', () => {
    process.env.RETRY_INTERVAL_HOURS = '0';
    const config = loadConfig();
    expect(config.retryIntervalHours).toBe(1);
  });

  it('defaults retryIntervalHours to 1 when RETRY_INTERVAL_HOURS is not a number', () => {
    process.env.RETRY_INTERVAL_HOURS = 'not-a-number';
    const config = loadConfig();
    expect(config.retryIntervalHours).toBe(1);
  });

  it('clamps RETRY_WINDOW_HOURS=0 to minimum of 24', () => {
    process.env.RETRY_WINDOW_HOURS = '0';
    const config = loadConfig();
    expect(config.retryWindowHours).toBe(24);
  });
});
