import { Logger } from 'tslog';

// 1. Map string representation to tslog numeric IDs
const logLevels: Record<string, number> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
};

// 2. Fetch the env variable, safely fall back to "warn" if missing or invalid
const requestedLevel = process.env.LOG_LEVEL?.trim().toLowerCase() || 'warn';
const minLevel = logLevels[requestedLevel] ?? logLevels['warn'];

export const logger = new Logger({ minLevel, name: 'timesheet-bot' });
