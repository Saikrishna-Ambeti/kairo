import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { expect, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { OtlpTracer, OtlpSerialization } from "effect/observability";
import * as Layer from "effect/Layer";

import * as EnvironmentConnector from "./environments/EnvironmentConnector.ts";
import { withSchemaErrorSpanAttributes } from "./observability.ts";

interface ExportedRequest {
  readonly authorization: string | undefined;
  readonly body: string;
  readonly dataset: string | undefined;
}

const otlpAttributeValue = (value: {
  readonly stringValue?: string | null;
  readonly boolValue?: boolean | null;
  readonly intValue?: string | number | null;
  readonly doubleValue?: number | null;
}) => value.stringValue ?? value.boolValue ?? value.intValue ?? value.doubleValue;

const decodeJson = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown));

it.effect("exports schema error fields as span attributes", () =>
  Effect.gen(function* () {
    const exportedRequest = yield* Deferred.make<ExportedRequest>();
    yield* HttpServer.serveEffect(
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        yield* Deferred.succeed(exportedRequest, {
          authorization: request.headers.authorization,
          body: yield* request.text,
          dataset: request.headers["x-axiom-dataset"],
        });
        return HttpServerResponse.empty({ status: 204 });
      }),
    );

    yield* Effect.fail(
      new EnvironmentConnector.EnvironmentConnectNotAuthorized({
        environmentId: "environment-1",
        operation: "connect",
        reason: "managed_endpoint_allocation_not_ready",
      }),
    ).pipe(
      Effect.withSpan("relay.test.schema_error"),
      Effect.exit,
      withSchemaErrorSpanAttributes,
      Effect.provide(
        OtlpTracer.layer({
          url: "/v1/traces",
          resource: {
            serviceName: "kairo-relay-worker",
            attributes: { "service.namespace": "kairo" },
          },
          headers: {
            Authorization: "Bearer test-token",
            "X-Axiom-Dataset": "relay-test-traces",
          },
        }).pipe(Layer.provide(OtlpSerialization.layerJson)),
      ),
    );

    const request = yield* Deferred.await(exportedRequest).pipe(Effect.timeout("1 second"));
    const payload = (yield* decodeJson(request.body)) as OtlpTracer.TraceData;
    const resourceAttributes = Object.fromEntries(
      payload.resourceSpans
        .flatMap((resourceSpan) => resourceSpan.resource.attributes)
        .map((attribute) => [attribute.key, otlpAttributeValue(attribute.value)]),
    );
    const span = payload.resourceSpans
      .flatMap((resourceSpan) => resourceSpan.scopeSpans)
      .flatMap((scopeSpan) => scopeSpan.spans)
      .find((candidate) => candidate.name === "relay.test.schema_error");
    const attributes = Object.fromEntries(
      (span?.attributes ?? []).map((attribute) => [
        attribute.key,
        otlpAttributeValue(attribute.value),
      ]),
    );

    expect(request.authorization).toBe("Bearer test-token");
    expect(request.dataset).toBe("relay-test-traces");
    expect(resourceAttributes).toMatchObject({
      "service.name": "kairo-relay-worker",
      "service.namespace": "kairo",
    });
    expect(attributes).toMatchObject({
      "error.type": "EnvironmentConnectNotAuthorized",
      "error.environmentId": "environment-1",
      "error.operation": "connect",
      "error.reason": "managed_endpoint_allocation_not_ready",
    });
  }).pipe(Effect.provide(NodeHttpServer.layerTest), Effect.scoped),
);
