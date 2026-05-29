import { PuppeteerTimesheetService } from '../../src/services/PuppeteerTimesheetService';
import type { IBrowserProvider } from '../../src/interfaces/IBrowserProvider';
import type { Browser, Page } from 'puppeteer';

function makeMockPage() {
  const mockPdfResponse = {
    buffer: jest.fn().mockResolvedValue(Buffer.from([1, 2, 3])),
  };

  return {
    goto: jest.fn().mockResolvedValue(null),
    type: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    waitForNavigation: jest.fn().mockResolvedValue(null),
    waitForResponse: jest.fn().mockResolvedValue(mockPdfResponse),
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
