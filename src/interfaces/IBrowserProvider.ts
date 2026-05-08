import type { Browser } from 'puppeteer';

export interface IBrowserProvider {
  launch(): Promise<Browser>;
}
