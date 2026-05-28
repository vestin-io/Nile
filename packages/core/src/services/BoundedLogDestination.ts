import { closeSync, mkdirSync, openSync, readdirSync, statSync, truncateSync, unlinkSync, write } from "node:fs";
import { Writable } from "node:stream";
import { basename, dirname, join } from "node:path";

type BoundedLogDestinationOptions = {
  maxBytes: number;
  path: string;
};

export class BoundedLogDestination extends Writable {
  private currentSize = 0;
  private fileDescriptor: number;

  constructor(private readonly options: BoundedLogDestinationOptions) {
    super();
    this.prepareDirectory();
    this.currentSize = this.readInitialSize();
    this.fileDescriptor = this.openFileDescriptor();
  }

  override _write(
    chunk: string | Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const payload = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
    try {
      this.ensureCapacity(payload.byteLength);
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    write(this.fileDescriptor, payload, 0, payload.byteLength, null, (error) => {
      if (!error) {
        this.currentSize += payload.byteLength;
      }
      callback(error);
    });
  }

  override _final(callback: (error?: Error | null) => void): void {
    try {
      closeSync(this.fileDescriptor);
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private prepareDirectory(): void {
    const directory = dirname(this.options.path);
    mkdirSync(directory, { recursive: true });
    const logName = basename(this.options.path);
    const staleLogNames = readdirSync(directory).filter((entry) => entry.startsWith(`${logName}.`));
    for (const staleLogName of staleLogNames) {
      unlinkSync(join(directory, staleLogName));
    }
  }

  private readInitialSize(): number {
    try {
      const size = statSync(this.options.path).size;
      if (size > this.options.maxBytes) {
        truncateSync(this.options.path, 0);
        return 0;
      }
      return size;
    } catch {
      return 0;
    }
  }

  private ensureCapacity(nextWriteBytes: number): void {
    if (this.currentSize + nextWriteBytes <= this.options.maxBytes) {
      return;
    }

    closeSync(this.fileDescriptor);
    truncateSync(this.options.path, 0);
    this.currentSize = 0;
    this.fileDescriptor = this.openFileDescriptor();
  }

  private openFileDescriptor(): number {
    return openSync(this.options.path, "a");
  }
}
