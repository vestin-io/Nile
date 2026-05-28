import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import pino, { type Logger as PinoLogger } from "pino";

import { BoundedLogDestination } from "./BoundedLogDestination";

type LogFields = Record<string, unknown>;

export class NileLogger {
  private static readonly MAX_LOG_BYTES = 10 * 1024 * 1024;

  static createDefault(options?: { logPath?: string; level?: string; module?: string }): NileLogger {
    const logger = this.createPinoLogger(options);

    const nileLogger = new NileLogger(logger);
    return options?.module ? nileLogger.child({ module: options.module }) : nileLogger;
  }

  static silent(): NileLogger {
    return new NileLogger(pino({ enabled: false }));
  }

  constructor(private readonly logger: PinoLogger) {}

  private static createPinoLogger(options?: { logPath?: string; level?: string }): PinoLogger {
    const preferredPath = options?.logPath ?? join(homedir(), ".nile-switcher", "logs", "app.log");
    const fallbackPath = join(tmpdir(), "nile-switcher", "logs", "app.log");
    const config = {
      name: "nile",
      level: options?.level ?? process.env.NILE_LOG_LEVEL ?? "info",
      redact: [
        "apiKey",
        "idToken",
        "accessToken",
        "refreshToken",
        "OPENAI_API_KEY",
        "*.apiKey",
        "*.idToken",
        "*.accessToken",
        "*.refreshToken",
        "*.OPENAI_API_KEY",
        "sessionToken",
        "*.sessionToken",
        "authorization",
        "*.authorization",
        "tokens.id_token",
        "tokens.access_token",
        "tokens.refresh_token",
      ],
    };

    try {
      return pino(config, new BoundedLogDestination({
        path: preferredPath,
        maxBytes: this.MAX_LOG_BYTES,
      }));
    } catch {
      return pino(config, new BoundedLogDestination({
        path: fallbackPath,
        maxBytes: this.MAX_LOG_BYTES,
      }));
    }
  }

  child(bindings: LogFields): NileLogger {
    return new NileLogger(this.logger.child(bindings));
  }

  debug(event: string, fields?: LogFields): void {
    this.logger.debug(fields ?? {}, event);
  }

  info(event: string, fields?: LogFields): void {
    this.logger.info(fields ?? {}, event);
  }

  warn(event: string, fields?: LogFields): void {
    this.logger.warn(fields ?? {}, event);
  }

  error(event: string, error?: unknown, fields?: LogFields): void {
    const payload: LogFields = {
      ...(fields ?? {}),
    };

    if (error instanceof Error) {
      payload.err = error;
    } else if (error !== undefined) {
      payload.error = String(error);
    }

    this.logger.error(payload, event);
  }
}
