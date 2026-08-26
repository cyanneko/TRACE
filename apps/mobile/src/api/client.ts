import {
  AnalyzeResultSchema,
  type AnalyzeRequest,
  type AnalyzeResult,
  type InsightRequest,
  InsightResultSchema,
  type InsightResult,
  type ProviderInfo,
} from "@trace/contracts";
import { Platform } from "react-native";

const fallbackApiUrl = Platform.OS === "web" ? "http://127.0.0.1:8787" : "http://localhost:8787";
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? fallbackApiUrl).replace(/\/$/, "");
const requestTimeoutMs = 115_000;

export class TraceApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "REQUEST_FAILED", status = 0) {
    super(message);
    this.name = "TraceApiError";
    this.code = code;
    this.status = status;
  }
}

type HealthResponse = {
  modelProvider: ProviderInfo;
  service: string;
  status: "ok";
};

async function request(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TraceApiError("TRACE API timed out. Please retry.", "REQUEST_TIMEOUT");
    }
    throw new TraceApiError("TRACE API is unreachable. Check that the WSL API is running.", "API_UNREACHABLE");
  } finally {
    clearTimeout(timeout);
  }
}

async function readError(response: Response): Promise<TraceApiError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
    };
    return new TraceApiError(
      body.error?.message ?? `TRACE API returned ${response.status}.`,
      body.error?.code,
      response.status,
    );
  } catch {
    return new TraceApiError(`TRACE API returned ${response.status}.`, "INVALID_API_RESPONSE", response.status);
  }
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await request("/health");
  if (!response.ok) {
    throw await readError(response);
  }

  return (await response.json()) as HealthResponse;
}

export async function analyzeScreenshot(input: AnalyzeRequest): Promise<AnalyzeResult> {
  const response = await request("/v1/analyze", {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return AnalyzeResultSchema.parse(await response.json());
}

export async function generateInsights(input: InsightRequest): Promise<InsightResult> {
  const response = await request("/v1/insights", {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return InsightResultSchema.parse(await response.json());
}
