import { runRetryTick } from '../../src/utils/retryTick';
import type { ITimesheetService } from '../../src/interfaces/ITimesheetService';
import type { IEmailService } from '../../src/interfaces/IEmailService';
import type { AppConfig, RetryState } from '../../src/interfaces/types';
import { readRetryState, writeRetryState, clearRetryState } from '../../src/utils/retryState';

jest.mock('../../src/utils/retryState');

const mockRead = readRetryState as jest.Mock;
const mockWrite = writeRetryState as jest.Mock;
const mockClear = clearRetryState as jest.Mock;

const mockConfig: AppConfig = {
  timesheet: {
    loginUrl: 'https://example.com/login',
    timesheetsUrl: 'https://example.com/timesheets',
    username: 'user',
    password: 'pass',
  },
  smtp: { host: 'smtp.example.com', port: 587, secure: false, user: 'user', pass: 'pass' },
  myEmail: 'me@example.com',
  hrEmails: 'hr@example.com',
  emailCronSchedule: '0 9 * * 1',
  emailCronScheduleTimezone: 'America/New_York',
  retryWindowHours: 24,
  retryIntervalHours: 1,
  retryStateFile: '/data/retry-state.json',
};

// weekEnding is a Saturday; expiresAt is after NOW_ACTIVE but before NOW_EXPIRED
const ACTIVE_STATE: RetryState = {
  weekEnding: '2026-06-28',
  startedAt: '2026-06-22T09:00:00.000Z',
  expiresAt: '2026-06-23T09:00:00.000Z',
  attemptCount: 1,
  lastAttemptAt: '2026-06-22T09:00:00.000Z',
};

const NOW_ACTIVE = new Date('2026-06-22T10:00:00.000Z');   // before expiresAt
const NOW_EXPIRED = new Date('2026-06-23T10:00:00.000Z');  // after expiresAt

describe('runRetryTick', () => {
  let mockFetchPdf: jest.Mock;
  let mockSend: jest.Mock;
  let timesheetService: ITimesheetService;
  let emailService: IEmailService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockFetchPdf = jest.fn();
    mockSend = jest.fn().mockResolvedValue(undefined);
    timesheetService = { fetchTimesheetPdf: mockFetchPdf };
    emailService = { send: mockSend };
  });

  it('does nothing when no state file exists', async () => {
    mockRead.mockReturnValue(null);
    await runRetryTick({ timesheetService, emailService }, mockConfig, NOW_ACTIVE);
    expect(mockFetchPdf).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns early without fetching when readRetryState throws', async () => {
    mockRead.mockImplementation(() => { throw new Error('read error'); });
    await expect(
      runRetryTick({ timesheetService, emailService }, mockConfig, NOW_ACTIVE),
    ).resolves.toBeUndefined();
    expect(mockFetchPdf).not.toHaveBeenCalled();
  });

  it('sends failure alert and clears state when window is expired', async () => {
    mockRead.mockReturnValue(ACTIVE_STATE);
    await runRetryTick({ timesheetService, emailService }, mockConfig, NOW_EXPIRED);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'me@example.com',
        subject: 'ACTION REQUIRED: Timesheet Bot Alert',
        text: expect.stringContaining('2026-06-28'),
      }),
    );
    expect(mockClear).toHaveBeenCalledWith('/data/retry-state.json');
    expect(mockFetchPdf).not.toHaveBeenCalled();
  });

  it('sends HR email and clears state when PDF is found during active window', async () => {
    mockRead.mockReturnValue(ACTIVE_STATE);
    const pdf = Buffer.from([1, 2, 3]);
    mockFetchPdf.mockResolvedValue(pdf);

    await runRetryTick({ timesheetService, emailService }, mockConfig, NOW_ACTIVE);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hr@example.com',
        subject: expect.stringContaining('Timesheet Approved'),
        attachment: expect.objectContaining({ content: pdf }),
      }),
    );
    expect(mockClear).toHaveBeenCalledWith('/data/retry-state.json');
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('increments attemptCount and rewrites state when PDF is not found', async () => {
    mockRead.mockReturnValue(ACTIVE_STATE);
    mockFetchPdf.mockResolvedValue(null);

    await runRetryTick({ timesheetService, emailService }, mockConfig, NOW_ACTIVE);

    expect(mockWrite).toHaveBeenCalledWith(
      '/data/retry-state.json',
      expect.objectContaining({
        attemptCount: 2,
        lastAttemptAt: NOW_ACTIVE.toISOString(),
      }),
    );
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('updates lastAttemptAt but not attemptCount when fetchTimesheetPdf throws', async () => {
    mockRead.mockReturnValue(ACTIVE_STATE);
    mockFetchPdf.mockRejectedValue(new Error('network timeout'));

    await runRetryTick({ timesheetService, emailService }, mockConfig, NOW_ACTIVE);

    expect(mockWrite).toHaveBeenCalledWith(
      '/data/retry-state.json',
      expect.objectContaining({
        attemptCount: 1,
        lastAttemptAt: NOW_ACTIVE.toISOString(),
      }),
    );
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });
});
