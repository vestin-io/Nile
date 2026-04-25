type LogFields = Record<string, unknown>;

export class HostLocalLogger {
  static silent(): HostLocalLogger {
    return new HostLocalLogger();
  }

  child(_fields: LogFields): HostLocalLogger {
    return this;
  }

  warn(_event: string, _fields?: LogFields): void {}
}
