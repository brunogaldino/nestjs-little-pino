import { DynamicModule, Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule as PinoLogger } from 'nestjs-pino';
import { LoggerOptions } from "./@types/logger-option.type";
import { setupPinoHTTP } from "./helpers/setup-pino-http";
import { LoggerAsyncOptions } from "./interfaces/logger-async-options.interface";
import { LoggerInterceptor } from "./logger.interceptor";

@Global()
@Module({})
export class LoggerModule {
  static forRoot(opts: LoggerOptions): DynamicModule {
    let mod: DynamicModule;
    mod = {
      module: LoggerModule,
      imports: [
        PinoLogger.forRoot({
          pinoHttp: setupPinoHTTP(opts)
        }),
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: LoggerInterceptor,
        }
      ]
    }

    if (process.env.DISABLE_PINO_INTERCEPTOR) {
      delete mod.providers;
    }

    return mod;
  }

  static forRootAsync(opts: LoggerAsyncOptions): DynamicModule {
    let mod: DynamicModule;
    mod = {
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
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: LoggerInterceptor,
        }
      ],
      exports: [LoggerModule],
    };

    if (process.env.DISABLE_PINO_INTERCEPTOR) {
      delete mod.providers;
    }

    return mod;
  }
}
