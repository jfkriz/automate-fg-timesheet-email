export interface DateRange {
  start: string;
  end: string;
}

export interface EmailOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer };
}

export interface TimesheetConfig {
  loginUrl: string;
  timesheetsUrl: string;
  username: string;
  password: string;
}

export interface AppConfig {
  timesheet: TimesheetConfig;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  myEmail: string;
  hrEmails: string;
  emailCronSchedule: string;
  emailCronScheduleTimezone: string;
}
