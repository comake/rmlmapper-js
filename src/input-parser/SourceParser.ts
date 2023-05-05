import type { ProcessOptions } from '../util/Types';

export interface SourceParserArgs {
  source: string;
  sourceCache: Record<string, any>;
  options: ProcessOptions;
  iterator: string;
}

export abstract class SourceParser<T> {
  private readonly ignoreEmptyStrings?: boolean;
  private readonly ignoreValues?: string[];
  private readonly source: string;
  private readonly sourceCache: Record<string, any>;
  protected readonly options: ProcessOptions;

  public constructor(args: SourceParserArgs) {
    this.ignoreEmptyStrings = args.options.ignoreEmptyStrings;
    this.ignoreValues = args.options.ignoreValues;
    this.source = args.source;
    this.sourceCache = args.sourceCache;
    this.options = args.options;
  }

  protected readSourceWithCache(): T {
    if (this.sourceCache[this.source]) {
      return this.sourceCache[this.source];
    }
    if (this.options.inputFiles?.[this.source]) {
      const contents = this.options.inputFiles[this.source];
      const parsed = this.parseSource(contents);
      this.sourceCache[this.source] = parsed;
      return parsed;
    }
    throw new Error(`File ${this.source} not specified`);
  }

  protected abstract parseSource(contents: string): T;

  /**
  * Get the total count of items in the dataset
  */
  public abstract getCount(): number;
  /**
  * Get the data at a specific index matching a selector
  * @param index - the index of the data to get
  * @param selector - the selector of the field to get from the data at the index
  */
  protected abstract getRawData(index: number, selector: string, datatype?: string): any[];

  public getData(index: number, selector: string, datatype?: string): any[] {
    let values = this.getRawData(index, selector, datatype);
    if (this.ignoreEmptyStrings) {
      values = values.filter((value: string): boolean => value.trim() !== '');
    }
    if (this.ignoreValues) {
      values = values.filter((value: string): boolean => !this.ignoreValues!.includes(value));
    }
    return values;
  }
}
