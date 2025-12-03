import { LoggerInterceptor } from "./logger.interceptor";

export function TransformBodyLog(transform: new () => BodyLogTransformer) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    LoggerInterceptor.registeredTransformers.set(
      `${target.constructor.name}-${propertyKey}`,
      new transform(),
    );

    return descriptor;
  };
}

export abstract class BodyLogTransformer<Req = any, Res = any> {
  transformRequest(request: Req): string | object | number | boolean {
    return request as any;
  }

  transformResponse(response: Res): string | object | number | boolean {
    return response as any;
  }

  skip(_request: Req, _response: Res): boolean | Promise<boolean> {
    return false;
  }
}
