import type { AppConfig } from '../interfaces/types';
import type { ITimesheetService } from '../interfaces/ITimesheetService';
import type { IEmailService } from '../interfaces/IEmailService';
import { readRetryState, writeRetryState, clearRetryState } from './retryState';
import { getTargetWeekRange } from './dateUtils';
import { logger } from './logger';

interface RetryServices {
  timesheetService: ITimesheetService;
  emailService: IEmailService;
}

export async function runRetryTick(
  services: RetryServices,
  config: AppConfig,
  now: Date = new Date(),
): Promise<void> {
  const { timesheetService, emailService } = services;
  logger.trace(`Retry tick started at ${now.toISOString()}.`);

  let state;
  try {
    state = readRetryState(config.retryStateFile);
  } catch {
    logger.error('Could not read retry state file; skipping retry tick.');
    return;
  }

  if (!state) return;

  if (now >= new Date(state.expiresAt)) {
    logger.info(`Retry window expired for week ending ${state.weekEnding}; sending failure alert.`);
    try {
      await emailService.send({
        from: config.myEmail,
        to: config.myEmail,
        subject: 'ACTION REQUIRED: Timesheet Bot Alert',
        text: `The bot could not find an "Approved" timesheet for the week ending ${state.weekEnding}. Please verify your submission status.`,
      });
    } catch (err) {
      logger.error('Failed to send failure alert:', err);
    }
    clearRetryState(config.retryStateFile);
    return;
  }

  logger.info(`Retry attempt ${state.attemptCount + 1} for week ending ${state.weekEnding}.`);

  const dateRange = getTargetWeekRange(new Date(`${state.weekEnding}T12:00:00`));

  try {
    const pdfBuffer = await timesheetService.fetchTimesheetPdf(dateRange);

    if (pdfBuffer) {
      const filename = `Timesheet_Ending_${state.weekEnding}.pdf`;
      await emailService.send({
        from: config.myEmail,
        to: config.hrEmails,
        subject: `Fieldglass Timesheet Approved - Period Ending ${state.weekEnding}`,
        text: `Attached is my approved Fieldglass timesheet for the week ending ${state.weekEnding}.`,
        attachment: { filename, content: pdfBuffer },
      });
      logger.info(`Timesheet found and sent for week ending ${state.weekEnding}.`);
      clearRetryState(config.retryStateFile);
    } else {
      writeRetryState(config.retryStateFile, {
        ...state,
        attemptCount: state.attemptCount + 1,
        lastAttemptAt: now.toISOString(),
      });
      logger.info(`Timesheet not yet found for week ending ${state.weekEnding}; attempt ${state.attemptCount + 1}.`);
    }
  } catch (err) {
    logger.error('Error during retry fetch:', err);
    try {
      writeRetryState(config.retryStateFile, {
        ...state,
        lastAttemptAt: now.toISOString(),
      });
    } catch (writeErr) {
      logger.error('Failed to update retry state after error:', writeErr);
    }
  }
}
