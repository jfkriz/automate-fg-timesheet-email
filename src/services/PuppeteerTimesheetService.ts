import { HTTPResponse } from 'puppeteer';
import type { IBrowserProvider } from '../interfaces/IBrowserProvider';
import type { ITimesheetService } from '../interfaces/ITimesheetService';
import type { DateRange, TimesheetConfig } from '../interfaces/types';
import { logger } from '../utils/logger';

export class PuppeteerTimesheetService implements ITimesheetService {
  constructor(
    private readonly browserProvider: IBrowserProvider,
    private readonly config: TimesheetConfig,
  ) {}

  async fetchTimesheetPdf(dates: DateRange): Promise<Buffer | null> {
    const browser = await this.browserProvider.launch();
    try {
      const page = await browser.newPage();

      logger.info(`Navigating to login page: ${this.config.loginUrl}`);
      await page.goto(this.config.loginUrl);
      await page.type('input[name="username"]', this.config.username);
      await page.type('input[name="password"]', this.config.password);
      await Promise.all([
        page.click('#primary_content > div.entryLoginInput_button > button'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
      ]);
      logger.info('Login submitted, waiting for navigation.');

      logger.info(`Navigating to timesheets page: ${this.config.timesheetsUrl}`);
      await page.goto(this.config.timesheetsUrl);
      await page.waitForNetworkIdle();
      await page.waitForSelector('#contenttabletimeSheet_worker_list');

      const result = await page.evaluate(
        (start: string, end: string) => {
          const rows = Array.from(
            document.querySelectorAll('#contenttabletimeSheet_worker_list > [role="row"]'),
          );
          const targetRow = rows.find((r) => {
            const text = (r as HTMLElement).innerText;
            // Statuses:
            // - Approved
            // - Pending Approval
            // - Invoiced
            // - Draft
            // - Others?
            return text.includes(start) && text.includes(end) && text.includes('Approved');
          });
          if (targetRow) {
            const link = targetRow.querySelector('a') as HTMLAnchorElement | null;
            if (link) {
              return { found: true, url: link.href };
            }
          }
          return { found: false, url: '' };
        },
        dates.start,
        dates.end,
      ) as { found: boolean; url: string };

      if (!result.found) {
        logger.warn(`No approved timesheet row found for ${dates.start} – ${dates.end}.`);
        return null;
      }

      logger.info(`Timesheet row found. Navigating to: ${result.url}`);
      await page.goto(result.url);
      await page.waitForNetworkIdle();

      // If available, invoke the script-defined print download URL directly.
      const printDownloadPath = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const text = script.textContent ?? '';
          if (!text.includes('option == "action_print"') || !text.includes('downLoadPdf(')) {
            continue;
          }

          const match = text.match(
            /option\s*==\s*"action_print"[\s\S]*?downLoadPdf\(\s*['"]([^'"]+)['"]\s*\)/,
          );
          if (match) {
            return match[1];
          }
        }
        return '';
      });

      if (typeof printDownloadPath === 'string' && printDownloadPath.length > 0) {
        const base = new URL(page.url()).origin;
        logger.info(`Timesheet print: using extracted downLoadPdf URL: ${base}${printDownloadPath}`);
        const cookies = await browser.cookies();
        const response = await fetch(`${base}${printDownloadPath}`, {
          headers: {
            Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
          },
        });
        if (response.ok) {
          const contentType = response.headers.get('content-type') ?? '';
          if (contentType.toLowerCase().includes('application/pdf')) {
            logger.info('Timesheet print: captured PDF response from direct URL navigation.');
            const pdfBytes = await response.arrayBuffer();
            return Buffer.from(pdfBytes);
          } else {
            logger.warn(
              `Timesheet print: direct URL navigation did not yield PDF content (content-type: ${contentType}). Falling back to page.pdf().`,
            );
          }
        }
      }

      logger.info('Timesheet print: attempting to print current page as fallback.');
      const pdfBytes = await page.pdf({ format: 'LETTER', printBackground: true });
      return Buffer.from(pdfBytes);
    } finally {
      await browser.close();
    }
  }
}
