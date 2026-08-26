import { resolveVisionProviderConfig, type Environment } from "../config.js";
import { FixtureProvider } from "./fixtureProvider.js";
import type { ModelProvider } from "./modelProvider.js";
import { OpenAICompatibleVisionProvider } from "./openAICompatibleVisionProvider.js";

export function createModelProvider(environment: Environment): ModelProvider {
  if (environment.VISION_PROVIDER === "fixture") {
    return new FixtureProvider();
  }

  return new OpenAICompatibleVisionProvider(resolveVisionProviderConfig(environment));
}
