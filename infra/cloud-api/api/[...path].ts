import * as CloudApiConfig from "../src/Config.ts";
import { makeCloudApiHandler } from "../src/http/App.ts";

const { handler } = makeCloudApiHandler(CloudApiConfig.fromEnv(process.env));

export default { fetch: handler };
