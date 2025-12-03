import { context, trace } from "@opentelemetry/api";
import { randomUUID } from "crypto";
import { LoggerOptions } from "../@types/logger-option.type";
import { PinoOtelSeverity } from "../consts/pino-otel-severity.const";
import { deepMerge } from "./deep-merge";
import os from 'os'

const defaultOptions: LoggerOptions = {
  environment: 'development',
  serviceName: '',
  idField: 'x-request-id',
  version: 'v0.0.0',
  redact: {
    fields: [],
    remove: false
  }
}

export function setupPinoHTTP(opts: LoggerOptions) {
  const config: LoggerOptions = deepMerge({}, defaultOptions, opts);
  return {
    base: {
      env: config.environment,
      service: config.serviceName,
      version: config.version,
      pid: process.pid,
      hostname: os.hostname(),
    },
    autoLogging: false,
    genReqId: (req) => req.headers?.[config.idField] || randomUUID(),
    transport: config.prettify ? { target: 'pino-pretty' } : undefined,
    redact: {
      paths: config.redact.fields,
      censor: '***',
      remove: config.redact.remove,
    },
    customPrconfig: (req) => ({
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
  }
}

