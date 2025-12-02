import { DynamicModule, Global, Module } from "@nestjs/common";
import { context, trace } from "@opentelemetry/api";
import { LoggerModule as PinoLogger } from 'nestjs-pino';
import { randomUUID } from "node:crypto";
import os from 'node:os'
import { PinoOtelSeverity } from "./consts/pino-otel-severity.const";

type LoggerOptions = {
  environment: string;
  serviceName: string;
  version?: string;
  idField: string;
  redact: {
    fields: string[];
    censorString?: string;
    remove: boolean;
  }
}

const defaultOptions: LoggerOptions = {
  environment: 'development',
  serviceName: '',
  idField: 'x-request-id',
  version: 'v0.0.0'
}

@Global()
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerOptions): DynamicModule {

    return {
      module: LoggerModule,
      imports: [
        PinoLogger.forRoot({
          pinoHttp: {
            base: {
              env: options.environment,
              service: options.serviceName,
              version: options.version,
              pid: process.pid,
              hostname: os.hostname(),
            },
            autoLogging: false,
            genReqId: (req) => req.headers[options.idField] || randomUUID(),
            transport:
              process.env.NODE_ENV == 'local'
                ? { target: 'pino-pretty' }
                : undefined,
            redact: {
              paths: options.redact.fields,
              censor: '***',
              remove: options.redact.remove
            },
            customProps: (req) => ({
              req_id: req.id,
            }),
            mixin: (_context, _level) => {
              const currentSpan = trace.getSpan(context.active());
              if (!currentSpan) return {};

              const ctx = currentSpan.spanContext();
              return {
                trace_id: ctx.traceId,
                span_id: ctx.spanId,
              };
            },
            formatters: {
              level(label, number) {
                return {
                  level: label,
                  severity_number: PinoOtelSeverity.get(number) ?? '9' //Defaults to INFO,
                };
              },
            },
            serializers: {
              req(_) { },
              res(_) { },
            },
          },
        }),
      ]
    }
  }
}
