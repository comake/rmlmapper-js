import csv from 'csvjson';
import { addArray } from '../util/ArrayUtil';
import type { SourceParserArgs } from './SourceParser';
import { SourceParser } from './SourceParser';

export class CsvParser extends SourceParser {
  private readonly data: any[];

  public constructor(args: SourceParserArgs) {
    super(args);
    const csvOptions = {
      delimiter: args.options.csv?.delimiter ?? ',',
    };

    const result = csv.toObject(args.source, csvOptions);
    this.data = result;
  }

  public getCount(): number {
    return this.data.length;
  }

  public getRawData(index: number, selector: string): string[] {
    if (selector.startsWith('PATH~')) {
      return [ index.toString() ];
    }
    if (this.data[index]?.[selector]) {
      return addArray(this.data[index][selector]);
    }
    return [];
  }
}
