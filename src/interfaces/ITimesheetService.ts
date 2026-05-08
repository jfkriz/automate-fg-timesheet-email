import type { DateRange } from './types';

export interface ITimesheetService {
  fetchTimesheetPdf(dates: DateRange): Promise<Buffer | null>;
}
