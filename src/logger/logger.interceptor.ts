import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpLog } from './interfaces/http-log.interface';
import { BodyLogTransformer } from './logger-transformer.decorator';

@Injectable()
export class HTTPLoggerInterceptor implements NestInterceptor {
  private logger = new Logger('HTTP');
  static registeredTransformers = new Map<string, BodyLogTransformer>();
  // private readonly BASE_URL =
  //   'http://banking-app.banking-app.svc.cluster.local';

  constructor(ignorePaths: Array<string | RegExp> | undefined) {
    this.ignorePaths = ignorePaths ?? [];
  }
  private readonly ignorePaths: (string | RegExp)[];

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // const httpContext: HttpArgumentsHost = context.switchToHttp();
    const beginTime = performance.now();
    // const correlationId: string =
    //   httpContext.getRequest().headers['x-request-id'] ?? randomUUID();

    const { contextType } = context as any;
    const url: string = context.switchToHttp().getRequest().route.path;

    const shouldIgnoreLog =
      contextType === 'http' &&
      this.ignorePaths.find((pathToIgnore) => {
        if (pathToIgnore instanceof RegExp) {
          return pathToIgnore.test(url.toUpperCase());
        }

        return url.toUpperCase() === pathToIgnore.toUpperCase();
      });

    return next.handle().pipe(
      map((response) => {
        if (!shouldIgnoreLog) {
          const endTime = performance.now();
          const log = this.logRequest(context, response, endTime - beginTime);

          if (log) {
            if (log.http?.status_code >= 500) {
              this.logger.error(log);
            } else if (log.http?.status_code >= 400) {
              this.logger.warn(log);
            } else {
              this.logger.log(log);
            }
          }
        }

        return response;
        // return this.removeBaseUrl(response);
      }),
      catchError((err) =>
        throwError(() => {
          const endTime = Date.now();
          const log = this.logRequest(context, err, endTime - beginTime);

          if (log) {
            if (log.http?.status_code >= 400 && log.http?.status_code <= 499) {
              this.logger.warn(log, url);
            } else {
              this.logger.error(log, url);
            }
          }

          return err;
        }),
      ),
    );
  }

  logRequest(
    context: ExecutionContext,
    dataResponse: any,
    elapsedTimeMs: number,
  ): HttpLog {
    const httpRequest = context.switchToHttp().getRequest<Request>();
    const httpResponse = context.switchToHttp().getResponse<Response>();
    let transformRequestException: any;
    let transformResponseException: any;
    let skipException: any = null;
    let { statusCode } = httpResponse;

    const ctxClass = context.getClass().name;
    const ctxMethod = context['handler'].name;

    const transformer = HTTPLoggerInterceptor.registeredTransformers.get(
      `${ctxClass}-${ctxMethod}`,
    );

    let response =
      dataResponse instanceof HttpException
        ? dataResponse?.getResponse()
        : dataResponse;

    const error = {
      message: '',
      stack: '',
      kind: '',
    };

    if (dataResponse instanceof Error) {
      statusCode =
        dataResponse instanceof HttpException ? dataResponse.getStatus() : 500;
      error.message = dataResponse.message;
      error.stack = dataResponse?.stack ?? '';
      error.kind = httpStatusMap.get(statusCode) ?? dataResponse.name;
    } else if (statusCode <= 399) {
      if (transformer) {
        try {
          if (transformer.skip(httpRequest.body, response)) return null as any;
        } catch (e) {
          skipException = e;
        }

        try {
          httpRequest.body = transformer.transformRequest(httpRequest.body);
        } catch (e) {
          transformRequestException = e;
        }

        try {
          response = transformer.transformResponse(response);
        } catch (e) {
          transformResponseException = e;
        }
      }
    }

    const output: HttpLog = {
      duration: elapsedTimeMs,
      message: `[REQUEST] [${httpRequest.method as any}] [${httpRequest.route.path}]`,
      http: {
        url_details: {
          full: httpRequest.originalUrl,
          path: httpRequest.route.path,
          queryString: httpRequest.query as Record<string, string>,
          routeParams: httpRequest.params,
        },
        method: httpRequest.method as any,
        url: httpRequest.route.path,
        version: httpRequest.httpVersion,
        useragent: httpRequest.headers['user-agent'],
        status_code: statusCode,
        req: {
          headers: httpRequest.headers,
          body: httpRequest.body, //O TRANSFORDADO CASO DECORADO,
        },
        res: {
          body: response,
        },
      },
      network: {
        client: { ip: httpRequest.socket.remoteAddress },
      },
    };

    if (error.message !== '') {
      output['error'] = error;
    }

    if (dataResponse instanceof HttpException)
      output.http.res['rawException'] = dataResponse;

    if (transformRequestException) {
      output.http.req['transformError'] = transformRequestException?.message;
    }

    if (transformResponseException) {
      output.http.res['transformError'] = transformResponseException?.message;
    }

    if (skipException) {
      output.http['skipError'] = skipException?.message;
    }

    return output;
  }

  // private removeBaseUrl(value: any): any {
  //   if (
  //     value &&
  //     typeof value === 'object' &&
  //     'next' in value &&
  //     value['next']
  //   ) {
  //     value['next'] = (value['next'] as string)?.replace(this.BASE_URL, '');
  //   }
  //
  //   return value;
  // }
}

