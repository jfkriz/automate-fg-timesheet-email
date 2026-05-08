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
