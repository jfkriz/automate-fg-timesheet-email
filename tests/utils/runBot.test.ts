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
  hrEmails: 'hr@example.com',
  emailCronSchedule: '0 9 * * 1',
  emailCronScheduleTimezone: 'America/New_York',
  retryWindowHours: 24,
  retryIntervalHours: 1,
  retryStateFile: '/data/retry-state.json',
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

  it('does not throw when both fetchTimesheetPdf and emailService.send fail', async () => {
    mockFetchPdf.mockRejectedValue(new Error('timeout'));
    mockSend.mockRejectedValue(new Error('smtp down'));

    await expect(runBot({ timesheetService, emailService }, mockConfig)).resolves.toBeUndefined();
  });
});
