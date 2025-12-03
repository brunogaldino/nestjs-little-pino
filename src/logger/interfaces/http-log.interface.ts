export interface HttpLog {
  requestId?: number | string;
  duration?: number;
  title: string;
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
