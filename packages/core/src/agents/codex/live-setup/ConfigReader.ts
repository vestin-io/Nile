import type {
  CodexEndpointFamily,
  ParsedConfigState,
} from "./Internal";

const AZURE_HOST_MARKERS = [".cognitiveservices.azure.com", ".openai.azure.com"];
const OPENAI_HOST_MARKERS = ["api.openai.com"];

export class ConfigStateReader {
  read(content: string | null): { value: ParsedConfigState | null } | { error: string } {
    if (content === null || !content.trim()) {
      return { value: null };
    }

    const modelProviderMatch = content.match(/^model_provider\s*=\s*"([^"\n]+)"/m);
    if (!modelProviderMatch) {
      return { value: null };
    }

    const endpointId = modelProviderMatch[1].trim();
    if (!endpointId) {
      return { error: "Codex config contains an empty model_provider value" };
    }

    const block = this.readProviderBlock(content, endpointId);
    const parsedState: ParsedConfigState = { endpointId };
    const modelMatch = content.match(/^model\s*=\s*"([^"\n]+)"/m);
    const modelId = modelMatch?.[1]?.trim();
    if (modelId) {
      parsedState.modelId = modelId;
    }

    if (block) {
      parsedState.baseUrl = this.readQuotedValue(block, "base_url");
      parsedState.wireApi = this.readQuotedValue(block, "wire_api") ?? "responses";
      parsedState.envKey = this.readQuotedValue(block, "env_key");
    }

    return { value: parsedState };
  }

  inferEndpointFamily(providerId: string, baseUrl?: string): CodexEndpointFamily {
    if (providerId === "openai") {
      return "openai";
    }

    if (!baseUrl) {
      return "openai";
    }

    if (baseUrl && OPENAI_HOST_MARKERS.some((marker) => baseUrl.includes(marker))) {
      return "openai";
    }

    if (baseUrl && AZURE_HOST_MARKERS.some((marker) => baseUrl.includes(marker))) {
      return "azure-openai";
    }

    return "gateway";
  }

  private readProviderBlock(content: string, providerId: string): string | null {
    const lines = content.split("\n");
    const blockHeader = `[model_providers.${providerId}]`;
    const startIndex = lines.findIndex((line) => line.trim() === blockHeader);
    if (startIndex === -1) {
      return null;
    }

    const blockLines: string[] = [];
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim().startsWith("[")) {
        break;
      }
      blockLines.push(line);
    }

    return blockLines.join("\n");
  }

  private readQuotedValue(block: string, key: string): string | undefined {
    const match = block.match(new RegExp(`^${key}\\s*=\\s*"([^"\\n]+)"`, "m"));
    return match?.[1]?.trim() || undefined;
  }
}
