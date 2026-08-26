import type { AnalyzeModelOutput, AnalyzeRequest, ProviderInfo } from "@trace/contracts";

export interface ModelProvider {
  readonly info: ProviderInfo;
  analyze(input: AnalyzeRequest): Promise<AnalyzeModelOutput>;
}
