import type { Transporter } from 'nodemailer';
import type { IEmailService } from '../interfaces/IEmailService';
import type { EmailOptions } from '../interfaces/types';
import { logger } from '../utils/logger';

export class NodemailerEmailService implements IEmailService {
  constructor(private readonly transporter: Transporter) {}

  async send(options: EmailOptions): Promise<void> {
    logger.info(`Sending email to ${options.to} with subject "${options.subject}"`);
    await this.transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      attachments: options.attachment
        ? [{ filename: options.attachment.filename, content: options.attachment.content }]
        : [],
    });
  }
}
