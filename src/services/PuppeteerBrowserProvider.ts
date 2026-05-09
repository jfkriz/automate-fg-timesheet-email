import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import type { IBrowserProvider } from '../interfaces/IBrowserProvider';

export class PuppeteerBrowserProvider implements IBrowserProvider {
  async launch(): Promise<Browser> {
    return puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}
