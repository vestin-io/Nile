import type { EndpointRecord } from "@nile/core/models/endpoint";
import type { SessionModelCatalogReader, SessionModelCatalogResult } from "@nile/core/models/connection/family";
import type { StoredCredential } from "@nile/core/services/credential/Types";

const LOAD_CODE_ASSIST_URL = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
const LIST_EXPERIMENTS_URL = "https://cloudcode-pa.googleapis.com/v1internal:listExperiments";
const RETRIEVE_USER_QUOTA_URL = "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota";
const REQUEST_TIMEOUT_MS = 10_000;

const PREVIEW_GEMINI_MODEL = "gemini-3-pro-preview";
const PREVIEW_GEMINI_3_1_MODEL = "gemini-3.1-pro-preview";
const PREVIEW_GEMINI_FLASH_MODEL = "gemini-3-flash-preview";
const PREVIEW_GEMINI_3_1_FLASH_LITE_MODEL = "gemini-3.1-flash-lite-preview";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";
const DEFAULT_GEMINI_FLASH_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_FLASH_LITE_MODEL = "gemini-2.5-flash-lite";
const GEMMA_4_31B_IT_MODEL = "gemma-4-31b-it";
const GEMMA_4_26B_A4B_IT_MODEL = "gemma-4-26b-a4b-it";

const GEMINI_3_1_PRO_LAUNCHED_FLAG_ID = 45_760_185;
const PRO_MODEL_NO_ACCESS_FLAG_ID = 45_768_879;
const GEMINI_3_1_FLASH_LITE_LAUNCHED_FLAG_ID = 45_771_641;

type LoadCodeAssistPayload = {
  cloudaicompanionProject?: unknown;
};

type ListExperimentsPayload = {
  flags?: Array<{
    flagId?: unknown;
    boolValue?: unknown;
  }> | null;
};

type RetrieveUserQuotaPayload = {
  buckets?: Array<{
    modelId?: unknown;
  }> | null;
};

type GeminiExperimentState = {
  gemini31Launched: boolean;
  proModelNoAccess: boolean;
  gemini31FlashLiteLaunched: boolean;
};

export class GeminiSessionModelCatalogReader implements SessionModelCatalogReader {
  constructor(private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  async read(
    _endpoint: EndpointRecord,
    credential: StoredCredential,
    fetchFn: typeof fetch = this.fetchFn,
  ): Promise<SessionModelCatalogResult | null> {
    if (credential.kind !== "gemini_cli_session") {
      return null;
    }

    const accessToken = credential.accessToken.trim();
    if (!accessToken) {
      return {
        status: "unavailable",
        models: [],
        message: "This Gemini session does not expose a readable access token",
      };
    }

    let projectId: string | null;
    try {
      projectId = await this.readProjectId(accessToken, fetchFn);
    } catch (error) {
      return this.buildErrorResult(error);
    }

    if (!projectId) {
      return {
        status: "unavailable",
        models: [],
        message: "Gemini model metadata is unavailable for this session.",
      };
    }

    let experiments: GeminiExperimentState | null = null;
    try {
      experiments = await this.readExperiments(accessToken, projectId, fetchFn);
    } catch (error) {
      const authError = this.readAuthErrorMessage(error);
      if (authError) {
        return {
          status: "error",
          models: [],
          message: authError,
        };
      }
    }

    let quotaModelIds: string[] = [];
    try {
      quotaModelIds = await this.readQuotaModelIds(accessToken, projectId, fetchFn);
    } catch (error) {
      const authError = this.readAuthErrorMessage(error);
      if (authError) {
        return {
          status: "error",
          models: [],
          message: authError,
        };
      }
    }

    const models = this.buildModels(experiments, quotaModelIds);
    return {
      status: "available",
      models,
    };
  }

  private async readProjectId(accessToken: string, fetchFn: typeof fetch): Promise<string | null> {
    const response = await this.fetchJson(LOAD_CODE_ASSIST_URL, accessToken, {
      metadata: {
        ideType: "GEMINI_CLI",
        pluginType: "GEMINI",
      },
    }, fetchFn);
    const payload = response as LoadCodeAssistPayload;
    return this.extractProjectId(payload.cloudaicompanionProject);
  }

  private async readExperiments(
    accessToken: string,
    projectId: string,
    fetchFn: typeof fetch,
  ): Promise<GeminiExperimentState> {
    const response = await this.fetchJson(LIST_EXPERIMENTS_URL, accessToken, {
      project: projectId,
      metadata: {
        ideName: "IDE_UNSPECIFIED",
        pluginType: "GEMINI",
        ideVersion: "0.0.0",
        platform: this.readPlatform(),
        updateChannel: "stable",
        duetProject: projectId,
      },
    }, fetchFn);
    const payload = response as ListExperimentsPayload;
    return {
      gemini31Launched: this.readBooleanFlag(payload.flags, GEMINI_3_1_PRO_LAUNCHED_FLAG_ID),
      proModelNoAccess: this.readBooleanFlag(payload.flags, PRO_MODEL_NO_ACCESS_FLAG_ID),
      gemini31FlashLiteLaunched: this.readBooleanFlag(payload.flags, GEMINI_3_1_FLASH_LITE_LAUNCHED_FLAG_ID),
    };
  }

  private async readQuotaModelIds(
    accessToken: string,
    projectId: string,
    fetchFn: typeof fetch,
  ): Promise<string[]> {
    const response = await this.fetchJson(RETRIEVE_USER_QUOTA_URL, accessToken, {
      project: projectId,
    }, fetchFn);
    const payload = response as RetrieveUserQuotaPayload;
    const seen = new Set<string>();
    const models: string[] = [];
    for (const bucket of payload.buckets ?? []) {
      if (typeof bucket.modelId !== "string" || !bucket.modelId.trim()) {
        continue;
      }
      const modelId = bucket.modelId.trim();
      if (seen.has(modelId)) {
        continue;
      }
      seen.add(modelId);
      models.push(modelId);
    }
    return models;
  }

  private buildModels(experiments: GeminiExperimentState | null, quotaModelIds: string[]): string[] {
    const hasPreviewAccess = quotaModelIds.some((modelId) => this.isPreviewModel(modelId));
    const hasProQuota = quotaModelIds.some((modelId) => this.readTier(modelId) === "pro");
    const gemini31Launched =
      experiments?.gemini31Launched === true
      || quotaModelIds.includes(PREVIEW_GEMINI_3_1_MODEL);
    const gemini31FlashLiteLaunched =
      experiments?.gemini31FlashLiteLaunched === true
      || quotaModelIds.includes(PREVIEW_GEMINI_3_1_FLASH_LITE_MODEL);
    const proModelNoAccess = experiments?.proModelNoAccess === true;
    const canUsePro = proModelNoAccess ? false : (experiments !== null || hasProQuota);

    const models: string[] = [];
    if (hasPreviewAccess) {
      if (canUsePro) {
        models.push(gemini31Launched ? PREVIEW_GEMINI_3_1_MODEL : PREVIEW_GEMINI_MODEL);
      }
      models.push(PREVIEW_GEMINI_FLASH_MODEL);
      if (gemini31FlashLiteLaunched) {
        models.push(PREVIEW_GEMINI_3_1_FLASH_LITE_MODEL);
      }
    }

    if (canUsePro) {
      models.push(DEFAULT_GEMINI_MODEL);
    }
    models.push(
      DEFAULT_GEMINI_FLASH_MODEL,
      DEFAULT_GEMINI_FLASH_LITE_MODEL,
      GEMMA_4_31B_IT_MODEL,
      GEMMA_4_26B_A4B_IT_MODEL,
    );
    return models;
  }

  private async fetchJson(
    url: string,
    accessToken: string,
    body: object,
    fetchFn: typeof fetch,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Gemini session is expired or unauthorized. Refresh the Gemini CLI session and try again.");
      }
      if (!response.ok) {
        throw new Error(`Gemini model detection failed with status ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private buildErrorResult(error: unknown): SessionModelCatalogResult {
    return {
      status: "error",
      models: [],
      message: this.readAuthErrorMessage(error)
        ?? (error instanceof Error ? error.message : "Gemini model detection failed"),
    };
  }

  private readAuthErrorMessage(error: unknown): string | null {
    return error instanceof Error
      && error.message === "Gemini session is expired or unauthorized. Refresh the Gemini CLI session and try again."
      ? error.message
      : null;
  }

  private extractProjectId(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const projectId = record.id ?? record.projectId;
    return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
  }

  private readBooleanFlag(
    flags: ListExperimentsPayload["flags"],
    flagId: number,
  ): boolean {
    for (const flag of flags ?? []) {
      const candidateFlagId = typeof flag.flagId === "number"
        ? flag.flagId
        : typeof flag.flagId === "string" && flag.flagId.trim()
          ? Number(flag.flagId)
          : Number.NaN;
      if (candidateFlagId !== flagId) {
        continue;
      }
      return flag.boolValue === true;
    }
    return false;
  }

  private isPreviewModel(modelId: string): boolean {
    return modelId.includes("-preview");
  }

  private readTier(modelId: string): "pro" | "flash" | "flash-lite" | null {
    const lower = modelId.toLowerCase();
    if (lower.includes("flash-lite")) {
      return "flash-lite";
    }
    if (lower.includes("flash")) {
      return "flash";
    }
    if (lower.includes("pro")) {
      return "pro";
    }
    return null;
  }

  private readPlatform(): string {
    if (process.platform === "darwin" && process.arch === "arm64") {
      return "DARWIN_ARM64";
    }
    if (process.platform === "darwin" && process.arch === "x64") {
      return "DARWIN_AMD64";
    }
    if (process.platform === "linux" && process.arch === "arm64") {
      return "LINUX_ARM64";
    }
    if (process.platform === "linux" && process.arch === "x64") {
      return "LINUX_AMD64";
    }
    if (process.platform === "win32" && process.arch === "x64") {
      return "WINDOWS_AMD64";
    }
    return "PLATFORM_UNSPECIFIED";
  }
}
