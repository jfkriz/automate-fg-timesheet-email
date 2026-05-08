import type { EmailOptions } from './types';

export interface IEmailService {
  send(options: EmailOptions): Promise<void>;
}
