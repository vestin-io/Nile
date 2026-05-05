export class EndpointLabelFormatter {
  formatEndpointLabel(label: string): string {
    const match = label.match(/^Azure OpenAI \((.+)\)$/);
    if (!match) {
      return label;
    }

    const resource = this.readAzureResourceName(match[1]);
    return resource ? `Azure OpenAI (${resource})` : label;
  }

  formatConnectionLabel(endpointLabel: string, label: string, authMode: string): string {
    if (authMode === "api_key" && label === `${endpointLabel} API Key`) {
      return "API Key";
    }

    const match = label.match(/^Azure OpenAI \((.+)\) API Key$/);
    if (!match) {
      return label;
    }

    const resource = this.readAzureResourceName(match[1]);
    return resource ? `${resource} API Key` : label;
  }

  private readAzureResourceName(host: string): string | null {
    const azureSuffix = ".cognitiveservices.azure.com";
    if (host.endsWith(azureSuffix)) {
      return host.slice(0, -azureSuffix.length) || null;
    }

    return host.split(".")[0] || null;
  }
}
