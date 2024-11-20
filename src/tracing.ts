// import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
// import { NodeSDK } from '@opentelemetry/sdk-node';
// import * as process from 'process';
// import { Resource } from '@opentelemetry/resources';
// import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
// // Don't forget to import the dotenv package!
// import * as dotenv from 'dotenv';
// import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
//
// dotenv.config();
//
// const jaegerExporter = new JaegerExporter({
//   endpoint: 'http://localhost:14268/api/traces',
// });
//
// const oltpExporter = new OTLPTraceExporter({
//   url: `https://api.honeycomb.io/v1/traces`,
//   headers: {
//     'x-honeycomb-team': process.env.HONEYCOMB_API_KEY,
//   },
// });
//
// const traceExporter =
//   process.env.NODE_ENV === `development` ? jaegerExporter : oltpExporter;
//
// export const otelSDK = new NodeSDK({
//   resource: new Resource({
//     [SemanticResourceAttributes.SERVICE_NAME]: `nestjs-otel`,
//   }),
//   spanProcessor: new SimpleSpanProcessor(traceExporter),
//   instrumentations: [
//     getNodeAutoInstrumentations({
//       // we recommend disabling fs autoinstrumentation since it can be noisy
//       // and expensive during startup
//       '@opentelemetry/instrumentation-fs': {
//         enabled: false,
//       },
//     }),
//   ],
// });
//
// // gracefully shut down the SDK on process exit
// process.on('SIGTERM', () => {
//   otelSDK
//     .shutdown()
//     .then(
//       () => console.log('SDK shut down successfully'),
//       (err) => console.log('Error shutting down SDK', err),
//     )
//     .finally(() => process.exit(0));
// });
