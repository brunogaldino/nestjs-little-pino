import { ModuleMetadata } from "@nestjs/common";
import { LoggerOptions } from "../@types/logger-option.type";

export interface LoggerAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<LoggerOptions> | LoggerOptions;
}
