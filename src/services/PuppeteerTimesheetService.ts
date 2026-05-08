import type { IBrowserProvider } from '../interfaces/IBrowserProvider';
import type { ITimesheetService } from '../interfaces/ITimesheetService';
import type { DateRange, TimesheetConfig } from '../interfaces/types';

export class PuppeteerTimesheetService implements ITimesheetService {
  constructor(
    private readonly browserProvider: IBrowserProvider,
    private readonly config: TimesheetConfig,
  ) {}

  async fetchTimesheetPdf(dates: DateRange): Promise<Buffer | null> {
    const browser = await this.browserProvider.launch();
    try {
      const page = await browser.newPage();

      await page.goto(this.config.loginUrl);
      await page.type('input[name="username"]', this.config.username);
      await page.type('input[name="password"]', this.config.password);
      await Promise.all([
        page.click('#primary_content > div.entryLoginInput_button > button'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
      ]);

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
            return text.includes(start) && text.includes(end) && text.includes('Approved');
          });
          if (targetRow) {
            const link = targetRow.querySelector('a') as HTMLAnchorElement;
            return { found: true, url: link.href };
          }
          return { found: false, url: '' };
        },
        dates.start,
        dates.end,
      ) as { found: boolean; url: string };

      if (!result.found) {
        return null;
      }

      await page.goto(result.url);
      await page.waitForNetworkIdle();

      const pdfBytes = await page.pdf({ format: 'LETTER', printBackground: true });
      return Buffer.from(pdfBytes);
    } finally {
      await browser.close();
    }
  }
}
