import fs from 'fs';
import type { RetryState } from '../interfaces/types';
import { logger } from './logger';

export function readRetryState(filePath: string): RetryState | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as RetryState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    logger.error('Failed to read retry state file:', err);
    throw err;
  }
}

export function writeRetryState(filePath: string, state: RetryState): void {
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

export function clearRetryState(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('Failed to clear retry state file:', err);
    }
  }
}
