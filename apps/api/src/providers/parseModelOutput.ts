import { AnalyzeModelOutputSchema, type AnalyzeModelOutput } from "@trace/contracts";

export class ModelOutputError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ModelOutputError";
  }
}

function parse(content: string) {
  try {
    return AnalyzeModelOutputSchema.safeParse(JSON.parse(content));
  } catch (error) {
    return {
      success: false as const,
      error,
    };
  }
}

type ParseWithRepairInput = {
  initial: () => Promise<string>;
  repair: (invalidOutput: string) => Promise<string>;
};

export async function parseAnalyzeOutputWithRepair({
  initial,
  repair,
}: ParseWithRepairInput): Promise<AnalyzeModelOutput> {
  const firstOutput = await initial();
  const firstParse = parse(firstOutput);
  if (firstParse.success) {
    return firstParse.data;
  }

  const repairedOutput = await repair(firstOutput);
  const repairedParse = parse(repairedOutput);
  if (repairedParse.success) {
    return repairedParse.data;
  }

  throw new ModelOutputError("Model returned invalid structured output after one repair attempt", {
    cause: repairedParse.error,
  });
}
