import type {
  AnalyzeModelOutput,
  AnalyzeRequest,
  InsightBundle,
  InsightRequest,
  ProviderInfo,
} from "@trace/contracts";

export interface ModelProvider {
  readonly info: ProviderInfo;
  analyze(input: AnalyzeRequest): Promise<AnalyzeModelOutput>;
  generateInsights(input: InsightRequest): Promise<InsightBundle>;
}
