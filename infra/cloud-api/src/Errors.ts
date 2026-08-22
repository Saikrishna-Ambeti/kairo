import { type KairoCloudErrorCode } from "@kairo/contracts/cloud";
import * as Schema from "effect/Schema";

export class CloudApiRequestFailure extends Schema.TaggedErrorClass<CloudApiRequestFailure>()(
  "CloudApiRequestFailure",
  {
    requestId: Schema.String,
    code: Schema.String,
    safeMessage: Schema.String,
    status: Schema.Int,
    retryAfterSeconds: Schema.optional(Schema.Int),
  },
) {
  static override make(input: {
    readonly requestId: string;
    readonly code: KairoCloudErrorCode;
    readonly safeMessage: string;
    readonly status: number;
    readonly retryAfterSeconds?: number;
  }): CloudApiRequestFailure {
    return new CloudApiRequestFailure(input);
  }
}
