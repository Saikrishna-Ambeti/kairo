import { makeSecretProviderDefinitionRegistry } from "@kairo/secret-provider-core/shared/definition";
import * as OnePassword from "@kairo/secret-provider-onepassword/shared/definition";

export const builtInSecretProviderDefinitions = makeSecretProviderDefinitionRegistry([
  OnePassword.definition,
]);
