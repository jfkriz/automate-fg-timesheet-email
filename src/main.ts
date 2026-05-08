import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { loadConfig } from './utils/config';
import { getTargetWeekRange } from './utils/dateUtils';
import { PuppeteerBrowserProvider } from './services/PuppeteerBrowserProvider';
import { PuppeteerTimesheetService } from './services/PuppeteerTimesheetService';
import { NodemailerEmailService } from './services/NodemailerEmailService';
import type { IEmailService } from './interfaces/IEmailService';

async function main(): Promise<void> {
  const dateArg = process.argv[2];
  if (dateArg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    console.error(`Invalid date format: "${dateArg}". Expected YYYY-MM-DD.`);
    process.exit(1);
  }

  const config = loadConfig();

  const referenceDate = dateArg ? new Date(`${dateArg}T12:00:00`) : undefined;
  const dateRange = getTargetWeekRange(referenceDate);

  const browserProvider = new PuppeteerBrowserProvider();
  const timesheetService = new PuppeteerTimesheetService(browserProvider, config.timesheet);
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  const emailService = new NodemailerEmailService(transporter);

  try {
    const pdfBuffer = await timesheetService.fetchTimesheetPdf(dateRange);

    if (!pdfBuffer) {
      await sendAlert(emailService, config.myEmail, dateRange.end);
      console.error(`No approved timesheet found for week ending ${dateRange.end}.`);
      process.exit(1);
    }

    const filename = `Timesheet_Ending_${dateRange.end}.pdf`;
    fs.writeFileSync(path.join(process.cwd(), filename), pdfBuffer);

    await emailService.send({
      from: config.myEmail,
      to: config.hrEmail,
      subject: `Timesheet Approved - Period Ending ${dateRange.end}`,
      text: `Attached is my approved timesheet for the week ending ${dateRange.end}.`,
      attachment: { filename, content: pdfBuffer },
    });

    console.log(`Timesheet sent successfully for week ending ${dateRange.end}.`);
  } catch (err) {
    try {
      await sendAlert(emailService, config.myEmail, dateRange.end, err);
    } catch {
      // swallow secondary failure — original error takes precedence
    }
    console.error('Bot encountered an error:', err);
    process.exit(1);
  }
}

async function sendAlert(
  emailService: IEmailService,
  to: string,
  weekEnding: string,
  err?: unknown,
): Promise<void> {
  const subject = err
    ? 'ERROR: Timesheet Bot Failure'
    : 'ACTION REQUIRED: Timesheet Bot Alert';
  const text = err
    ? `The timesheet bot encountered an error: ${err instanceof Error ? err.message : String(err)}`
    : `The bot could not find an "Approved" timesheet for the week ending ${weekEnding}. Please verify your submission status.`;

  await emailService.send({ from: to, to, subject, text });
}

main();
