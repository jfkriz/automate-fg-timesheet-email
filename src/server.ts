import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import express from 'express';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { loadConfig } from './utils/config';
import { getTargetWeekRange } from './utils/dateUtils';
import { PuppeteerBrowserProvider } from './services/PuppeteerBrowserProvider';
import { PuppeteerTimesheetService } from './services/PuppeteerTimesheetService';
import { NodemailerEmailService } from './services/NodemailerEmailService';
import { runBot } from './utils/runBot';
import { runRetryTick } from './utils/retryTick';
import { logger } from './utils/logger';

const config = loadConfig();

const browserProvider = new PuppeteerBrowserProvider();
const timesheetService = new PuppeteerTimesheetService(browserProvider, config.timesheet);
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});
const emailService = new NodemailerEmailService(transporter);

const htmlTemplate = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'public', 'index.html'),
  'utf8',
);

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.get('/', (_req, res) => {
  const { end: defaultDate } = getTargetWeekRange();
  const html = htmlTemplate
    .replace('{{DEFAULT_DATE}}', defaultDate)
    .replace('{{HR_EMAILS}}', config.hrEmails);
  res.send(html);
});

app.post('/api/submit', async (req, res) => {
  const { date, sendEmail, recipientEmail } = req.body as {
    date?: string;
    sendEmail?: boolean;
    recipientEmail?: string;
  };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ status: 'error', message: 'date must be in YYYY-MM-DD format' });
    return;
  }
  if (sendEmail && !recipientEmail) {
    res.status(400).json({ status: 'error', message: 'recipientEmail is required when sending email' });
    return;
  }

  try {
    const dateRange = getTargetWeekRange(new Date(`${date}T12:00:00`));
    const pdfBuffer = await timesheetService.fetchTimesheetPdf(dateRange);

    if (!pdfBuffer) {
      res.json({ status: 'not_found', message: `No approved timesheet found for week ending ${dateRange.end}` });
      return;
    }

    if (sendEmail) {
      const filename = `Timesheet_Ending_${dateRange.end}.pdf`;
      await emailService.send({
        from: config.myEmail,
        to: recipientEmail!,
        subject: `Fieldglass Timesheet Approved - Period Ending ${dateRange.end}`,
        text: `Attached is my approved Fieldglass timesheet for the week ending ${dateRange.end}.`,
        attachment: { filename, content: pdfBuffer },
      });
      res.json({ status: 'sent', message: `Timesheet for week ending ${dateRange.end} sent to ${recipientEmail}` });
      return;
    }

    const filename = `Timesheet_Ending_${dateRange.end}.pdf`;
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Server error:', err);
    res.status(500).json({ status: 'error', message: 'An error occurred. Check server logs.' });
  }
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

cron.schedule(
  config.emailCronSchedule,
  () => { void runBot({ timesheetService, emailService }, config); },
  { timezone: config.emailCronScheduleTimezone },
);
logger.info(`Cron job scheduled: "${config.emailCronSchedule}" (${config.emailCronScheduleTimezone})`);

const retryCronExpression = `0 */${config.retryIntervalHours} * * *`;
cron.schedule(
  retryCronExpression,
  () => { void runRetryTick({ timesheetService, emailService }, config); },
  { timezone: config.emailCronScheduleTimezone },
);
logger.info(`Retry cron scheduled: "${retryCronExpression}" (${config.emailCronScheduleTimezone})`);

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});

void runRetryTick({ timesheetService, emailService }, config)
  .catch((err: unknown) => logger.error('Startup retry check failed:', err));
