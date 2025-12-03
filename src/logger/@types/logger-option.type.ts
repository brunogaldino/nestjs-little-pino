
export type LoggerOptions = {
  environment: string;
  serviceName: string;
  prettify?: boolean;
  version?: string;
  idField: string;
  redact?: {
    fields?: string[];
    censorString?: string;
    remove?: boolean;
  }
}
