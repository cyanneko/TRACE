import type { UserVisionProvider } from "@trace/contracts";

import {
  assertUserVisionProviderAllowed,
  resolveUserVisionProviderConfig,
  resolveVisionProviderConfig,
  type Environment,
} from "../config.js";
import { FixtureProvider } from "./fixtureProvider.js";
import type { ModelProvider } from "./modelProvider.js";
import { OpenAICompatibleVisionProvider } from "./openAICompatibleVisionProvider.js";

export function createModelProvider(environment: Environment): ModelProvider {
  if (environment.VISION_PROVIDER === "fixture") {
    return new FixtureProvider();
  }

  return new OpenAICompatibleVisionProvider(resolveVisionProviderConfig(environment));
}

export function createUserModelProvider(settings: UserVisionProvider, environment: Environment): ModelProvider {
  if (settings.provider === "fixture") {
    return new FixtureProvider();
  }

  const config = resolveUserVisionProviderConfig(settings);
  assertUserVisionProviderAllowed(config, environment);
  return new OpenAICompatibleVisionProvider(config);
}
