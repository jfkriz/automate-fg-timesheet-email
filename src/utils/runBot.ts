import type { AppConfig } from '../interfaces/types';
import type { ITimesheetService } from '../interfaces/ITimesheetService';
import type { IEmailService } from '../interfaces/IEmailService';
import { getTargetWeekRange } from './dateUtils';
import { logger } from './logger';

interface BotServices {
  timesheetService: ITimesheetService;
  emailService: IEmailService;
}

export async function runBot(
  services: BotServices,
  config: AppConfig,
  referenceDate?: Date,
): Promise<void> {
  const { timesheetService, emailService } = services;
  const dateRange = getTargetWeekRange(referenceDate);

  logger.info(`Bot started for week ending ${dateRange.end}.`);

  try {
    const pdfBuffer = await timesheetService.fetchTimesheetPdf(dateRange);

    if (!pdfBuffer) {
      try {
        await sendAlert(emailService, config.myEmail, dateRange.end);
      } catch {
        // swallow — email service failure must not propagate
      }
      logger.error(`No approved timesheet found for week ending ${dateRange.end}.`);
      return;
    }

    const filename = `Timesheet_Ending_${dateRange.end}.pdf`;
    await emailService.send({
      from: config.myEmail,
      to: config.hrEmails,
      subject: `Fieldglass Timesheet Approved - Period Ending ${dateRange.end}`,
      text: `Attached is my approved Fieldglass timesheet for the week ending ${dateRange.end}.`,
      attachment: { filename, content: pdfBuffer },
    });

    logger.info(`Timesheet sent successfully for week ending ${dateRange.end}.`);
  } catch (err) {
    try {
      await sendAlert(emailService, config.myEmail, dateRange.end, err);
    } catch {
      // swallow secondary failure — original error takes precedence
    }
    logger.error('Bot encountered an error:', err);
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
