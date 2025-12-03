import { DynamicModule, Global, Module } from "@nestjs/common";
import { LoggerModule as PinoLogger } from 'nestjs-pino';
import { LoggerOptions } from "./@types/logger-option.type";
import { LoggerAsyncOptions } from "./interfaces/logger-async-options.interface";
import { setupPinoHTTP } from "./helpers/setup-pino-http";

@Global()
@Module({})
export class LoggerModule {
  static forRoot(opts: LoggerOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLogger.forRoot({
          pinoHttp: setupPinoHTTP(opts)
        }),
      ]
    }
  }

  static forRootAsync(opts: LoggerAsyncOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLogger.forRootAsync({
          imports: opts.imports || [],
          inject: opts.inject || [],
          useFactory: async (...args: any[]) => {
            return {
              pinoHttp: setupPinoHTTP(await opts.useFactory(...args)),
            };
          },
        }),
      ],
      exports: [LoggerModule],
    };
  }
}
