import csv from 'csvjson';
import { addArray } from '../util/ArrayUtil';
import type { SourceParserArgs } from './SourceParser';
import { SourceParser } from './SourceParser';

export class CsvParser extends SourceParser<string> {
  private readonly data: any[];

  public constructor(args: SourceParserArgs) {
    super(args);
    const source = this.readSourceWithCache();
    const csvOptions = {
      delimiter: args.options.csv?.delimiter ?? ',',
    };
    const result = csv.toObject(source, csvOptions);
    this.data = result;
  }

  protected parseSource(source: string): string {
    return source;
  }

  public getCount(): number {
    return this.data.length;
  }

  protected getRawData(index: number, selector: string): any[] {
    if (selector.startsWith('PATH~')) {
      return [ index.toString() ];
    }
    if (this.data[index]?.[selector]) {
      return addArray(this.data[index][selector]);
    }
    return [];
  }
}
