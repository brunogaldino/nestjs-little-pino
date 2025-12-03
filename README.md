# nestjs-little-pino 🌲

<!--toc:start-->
- [nestjs-little-pino 🌲](#nestjs-little-pino-🌲)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [The log structure](#the-log-structure)
  - [The module configuration](#the-module-configuration)
    - [Usage of environment variables](#usage-of-environment-variables)
  - [The HTTP interceptor](#the-http-interceptor)
  - [Customizing Request and Response Bodies with @TransformBodyLog](#customizing-request-and-response-bodies-with-transformbodylog)
    - [The BodyLogTransformer Abstraction](#the-bodylogtransformer-abstraction)
      - [Example](#example)
<!--toc:end-->

> A small, opinionated wrapper for `nestjs-pino` with sane defaults and OpenTelemetry (OTel) integration out of the box.

I'm lazy, and sometimes I just want my structured logs to work out-of-the-box without any tinkering or major configurations. This library aims to enforce an opinionated standard schema for all logs produced inside your application, powered by the amazing Pino

The library is aimed not to be extensible, but to be easy to use, just register the module, give some configurations and that is it !

## Installation

```bash
npm install nestjs-little-pino
# OR
pnpm add nestjs-little-pino
```

## Quick Start

1. Register the Module `LoggerModule` in your `AppModule`.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-little-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      serviceName: 'my-service',
      redact: {
        fields: [
          'http.req.headers.authorization',
          'http.req.body.*.password',
          'http.req.body.*.otp',
        ],
        remove: true,
      }
    }),
  ],
})
export class AppModule {}
```

or, if you prefer to load async:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          prettify: true,
          serviceName: config.getOrThrow('PROJECT_NAME'),
          version: config.getOrThrow('PROJECT_VERSION'),
          environment: config.getOrThrow('NODE_ENV'),
          idField: 'x-request-id',
          redact: {
            fields: [
              'http.req.headers.authorization',
              'http.req.body.*.password',
              'http.req.body.*.otp',
            ],
          },
        };
      },
    })
})
export class AppModule {}

```

2. Configure your `main.ts`

To ensure startup logs (like "NestFactory starting...") are formatted correctly, you must enable log buffering and attach the logger manually.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-little-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  await app.listen(3000);
}
bootstrap();
```

## The log structure

All logs are wrapped into a standard structure:

```json
{
  "level": "info",
  "severity_number": 9,
  "time": 1764791143965,
  "env": "development",
  "service": "my-service",
  "version": "v0.0.0",
  "pid": 37494,
  "hostname": "macbook.local",
  "context": "MyController",
  "msg": "My Message"
}
```

The `level` field is the standard name level name.
The `severity_number` is calculated using the level, to comply with [OTel Severity Numbers](https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber)

## The module configuration

You can give the following configurations to the `LoggerModule`

| field | value | description | default |
| --------------- | --------------- | --------------- | --------------- |
| level | LogLevel | The minimum level that will be logged on stdout | `info` |
| environment | string | Service environment  | `development` |
| serviceName | string | Name of the service  | `""` |
| prettify    | boolean | If logs should be prettified by `pino-pretty` | `false` |
| version     | string  | Service version | `v0.0.0`
| idField     | string  | For projects that uses headers with "distributed IDs". Used to track logs across multiple projects | `x-request-id` |
| ignorePaths | Array<string | Regexp> | Paths that sould be ignored by the interceptor | `[]` |
| redact.fields | Array<string> | Pino native [redaction](https://github.com/pinojs/pino/blob/main/docs/redaction.md) | `[]` |
| redact.remove | boolean | If fields should be removed from the payload | `false` |
| redact.censorString | string | String that will be used to censor the value | `***` |

### Usage of environment variables

You can also use the following environment variables to dynamically setup the logger.

- **Note**: Env vars _will_ override the configuration values

| variable | value | description |
| -------------- | --------------- | --------------- |
| LOG_LEVEL | LogLevel | Overrides the log level of the application |
|  DISABLE_PINO_INTERCEPTOR | string | If the interceptor should be disabled |

## The HTTP interceptor

By default, when registering the `LoggerModule` a new interceptor will be registered inside the project.
This interceptor is responsible to wrap all requests and responses into a single line of log in a structured manner
following the standard:

```typescript
export interface HttpLog {
  title?: string;
  requestId?: number | string;
  duration?: number;
  message: string;
  http: {
    method: string;
    url: string;
    version: string;
    useragent: string | undefined;
    status_code: number;
    url_details?: {
      full: string;
      path?: string;
      queryString?: Record<string, string>;
      routeParams?: Record<string, string>;
    };
    req: {
      headers: any;
      body: any;
    };
    res: {
      headers?: any;
      body: any;
    };
  };
  network?: {
    client: { ip: any };
  };
  error?: any;
}
```

An example of formatted log:

```json
{
  "level": "info",
  "severity_number": 9,
  "time": 1764785098857,
  "env": "development",
  "service": "my-service",
  "version": "v0.0.1",
  "pid": 17476,
  "hostname": "pc.local",
  "context": "HTTP",
  "duration": 1621,
  "title": "[REQUEST] [GET] [/accounts/:account/transactions]",
  "http": {
    "url_details": {
      "full": "/accounts/a6d20923-c6b9-4b32-992a-efbbd79c867e/transactions?beginDate=2025-11-20",
      "path": "/accounts/:account/transactions",
      "queryString": {
        "beginDate": "2025-11-20",
      },
      "routeParams": {
        "account": "a6d20923-c6b9-4b32-992a-efbbd79c867e"
      }
    },
    "method": "GET",
    "url": "/accounts/:account/transactions",
    "version": "1.1",
    "useragent": "PostmanRuntime/7.49.1",
    "status_code": 200,
    "req": {
      "headers": {
        "authorization": "Bearer ***"
        "user-agent": "PostmanRuntime/7.49.1",
        "accept": "*/*",
        "postman-token": "adc74223-41f2-4d67-b634-6b3c5b268e32",
        "host": "localhost:3000",
        "accept-encoding": "gzip, deflate, br",
        "connection": "keep-alive",
        "x-api-version": "1"
      }
    },
    "res": {
      "body": {
        "count": 4,
        "results": [
          {
            "uuid": "6377eb60-1121-54ca-b461-e4510607eb72",
            "status": "CREATED",
          }
        ]
      }
    }
  },
  "network": {
    "client": {
      "ip": "::1"
    }
  }
}
```

## Customizing Request and Response Bodies with @TransformBodyLog

Sometimes, you don't need to send the entire request payload to your logging tool. Removing unnecessary content and keeping only the essentials can significantly reduce data ingestion and indexing costs.

To apply these transformations, you can use the `@TransformBodyLog()` decorator on a Controller route. This decorator registers a specific function for that route.
Whenever a request is handled, the transformer function is executed before the log is generated, allowing you to modify the http.req.body or http.res.body.

### The BodyLogTransformer Abstraction

To use the decorator, you must create a transformer
that extends the `BodyLogTransformer<Req=any, Res=any> class:`

```typescript
export abstract class BodyLogTransformer<Req = any, Res = any> {
  transformRequest(request: Req): string | object | number | boolean {
    return request as any;
  }
  transformResponse(response: Res): string | object | number | boolean {
    return response as any;
  }

  skip(request: Req, response: Res): boolean {
    return false;
  }
}
```

- Note: The generic types are optional and serve only to assist IntelliSense while writing transformers.

The `transformRequest`, `transformResponse`, and `skip` methods are optional; implement only the ones you need.

Finally, decorate your endpoint using @TransformBodyLog(YourTransformerClass).

#### Example

```typescript
export class TestLoggerTransformer extends BodyLogTransformer<MyRequestDTO, TestResponseDTO> {
  transformResponse(response: TestResponseDTO): object {
    delete response.param1; // Delete the param1 from the log
    response.myObject.nestedAtt = 'CHANGED';//Change the nested attribute to "CHANGED"
    return response;
  }

  skip(request: Request, response: Response): boolean {
    //Skip logging the request in case "isValid = true"
    return request.isValid;
  }
}

export class TestResponseDTO {
  param1: number;
  isValid: boolean;
  myObject: {
    nestedAtt: string;
  };
}

@Controller()
export class TesteController {
  @Post('/teste')
  @TransformBodyLog(TestLoggerTransformer)
  async teste(@Body() request: MyRequestDTO): Promise<TesteResponseDTO> {
    return {
      isValid: false,
      myObject: {
        nestedAtt: 'NOT CHANGED',
      },
      param1: 10,
    };
  }
}
```
