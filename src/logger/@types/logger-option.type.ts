import { LogLevel } from "../enums/log-level.enum";

export type LoggerOptions = {
  level: LogLevel;
  environment: string;
  serviceName: string;
  prettify?: boolean;
  version?: string;
  idField: string;
  ignorePaths?: Array<string | RegExp>;
  redact?: {
    fields?: string[];
    censorString?: string;
    remove?: boolean;
  }
}
