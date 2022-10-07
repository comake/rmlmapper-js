import type { ProcessOptions } from '../util/Types';

export abstract class SourceReader<T> {
  protected readonly options: ProcessOptions;
  private readonly cache: Record<string, any>;

  public constructor(cache: Record<string, any>, options: ProcessOptions) {
    this.cache = cache;
    this.options = options;
  }

  protected abstract readSource(source: string): T;

  protected readSourceFromInputOptions(source: string): string {
    if (this.options.inputFiles?.[source]) {
      return this.options.inputFiles[source];
    }
    throw new Error(`File ${source} not specified`);
  }

  public readSourceWithCache(source: string): T {
    if (this.cache[source]) {
      return this.cache[source];
    }
    const result = this.readSource(source);
    this.cache[source] = result;
    return result;
  }
}
