export class ModelProviderTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super("Vision model request timed out", options);
    this.name = "ModelProviderTimeoutError";
  }
}

export class ModelOutputTruncatedError extends Error {
  readonly completionTokens?: number;
  readonly finishReason = "length";

  constructor(completionTokens?: number) {
    super("Vision model response ended because it reached the output token limit");
    this.name = "ModelOutputTruncatedError";
    this.completionTokens = completionTokens;
  }
}
