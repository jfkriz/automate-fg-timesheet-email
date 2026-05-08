import type { DateRange } from '../interfaces/types';

export function getTargetWeekRange(referenceDate: Date = new Date()): DateRange {
  const lastSaturday = new Date(referenceDate);
  lastSaturday.setDate(referenceDate.getDate() - ((referenceDate.getDay() + 1) % 7));

  const oneWeekAgoSunday = new Date(lastSaturday);
  oneWeekAgoSunday.setDate(lastSaturday.getDate() - 6);

  return {
    start: formatDate(oneWeekAgoSunday),
    end: formatDate(lastSaturday),
  };
}

function formatDate(date: Date): string {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}
