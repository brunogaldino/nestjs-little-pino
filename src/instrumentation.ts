import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  AlwaysOnSampler,
  BasicTracerProvider,
  BatchSpanProcessor,
  Span,
} from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVER_PORT,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import os from 'node:os';

let sdk = new NodeSDK();

if (process.env?.INSTRUMENTATION_ENABLED == 'true') {
  process.env.OTEL_EXPORTER_OTLP_COMPRESSION = 'gzip';
  process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http';

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.npm_package_name ?? process.env.SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version,
    [ATTR_SERVER_PORT]: process.env.PORT ?? 3000,
    'deployment.environment': process.env.NODE_ENV,
    'k8s.pod.name': os.hostname(),
    'container.image.tag': `${process.env.npm_package_name}:${process.env.npm_package_version}`,
  });

  const exporter = new OTLPTraceExporter({
    url: process.env.TRACES_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  });

  const provider = new BasicTracerProvider({ resource, sampler: new AlwaysOnSampler() });
  // provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  // provider.register();

  sdk = new NodeSDK({
    serviceName: process.env.npm_package_name ?? process.env.SERVICE_NAME,
    autoDetectResources: true,
    traceExporter: exporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: process.env.METRICS_ENDPOINT ?? 'http://localhost:4318/v1/metrics',
      }),
    }),
    sampler: new AlwaysOnSampler(),
    spanProcessor: new BatchSpanProcessor(exporter, {
      maxExportBatchSize: 1000,
      maxQueueSize: 1000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-express': { enabled: false },
        '@opentelemetry/instrumentation-fastify': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-pg': { enabled: true, requireParentSpan: true },
        '@opentelemetry/instrumentation-ioredis': {
          enabled: true,
          requestHook: (span: Span, requestInfo) => {
            span.updateName(`${requestInfo.cmdName.toUpperCase()} - ${requestInfo.cmdArgs[0]}`);
          },
        },
        '@opentelemetry/instrumentation-undici': {
          enabled: true,
          requireParentforSpans: true,
          requestHook: (span: Span, request) => {
            span.updateName(`${request.method} - ${request.origin}${request.path}`);
          },
          ignoreRequestHook: (request) => {
            return request.path.includes('/health') || request.path.includes('/monitoring');
          },
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (request) => {
            return request.url.includes('/health') || request.url.includes('/monitoring');
          },
          requireParentforIncomingSpans: true,
        },
      }),
    ],
    resource,
  });

  sdk.start();

  console.log('Open Telemetry initialized');

  process.on('SIGTERM', async () => {
    await sdk
      .shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
} else {
  console.log(
    'Instrumentation disabled, set INSTRUMENTATION_ENABLED=true if you want it enabled',
    process.env?.INSTRUMENTATION_ENABLED ?? false,
  );
}

export default sdk
