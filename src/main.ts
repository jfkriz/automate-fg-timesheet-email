import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import nodemailer from 'nodemailer';
import { loadConfig } from './utils/config';
import { PuppeteerBrowserProvider } from './services/PuppeteerBrowserProvider';
import { PuppeteerTimesheetService } from './services/PuppeteerTimesheetService';
import { NodemailerEmailService } from './services/NodemailerEmailService';
import { runBot } from './utils/runBot';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  const dateArg = process.argv[2];
  if (dateArg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    logger.error(`Invalid date format: "${dateArg}". Expected YYYY-MM-DD.`);
    process.exit(1);
  }

  const config = loadConfig();
  const referenceDate = dateArg ? new Date(`${dateArg}T12:00:00`) : undefined;

  const browserProvider = new PuppeteerBrowserProvider();
  const timesheetService = new PuppeteerTimesheetService(browserProvider, config.timesheet);
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  const emailService = new NodemailerEmailService(transporter);

  await runBot({ timesheetService, emailService }, config, referenceDate);
}

main().catch((err) => {
  logger.error('Bot encountered an error:', err);
  process.exit(1);
});
