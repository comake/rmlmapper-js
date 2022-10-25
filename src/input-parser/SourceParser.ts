import type { ProcessOptions } from '../util/Types';

export interface SourceParserArgs {
  options: ProcessOptions;
  source: any;
  iterator: string;
}

export abstract class SourceParser {
  private readonly ignoreEmptyStrings?: boolean;
  private readonly ignoreValues?: string[];

  public constructor(args: SourceParserArgs) {
    this.ignoreEmptyStrings = args.options.ignoreEmptyStrings;
    this.ignoreValues = args.options.ignoreValues;
  }

  /**
  * Get the total count of items in the dataset
  */
  public abstract getCount(): number;
  /**
  * Get the data at a specific index matching a selector
  * @param index - the index of the data to get
  * @param selector - the selector of the field to get from the data at the index
  */
  public abstract getRawData(index: number, selector: string, datatype?: string): any[];

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
