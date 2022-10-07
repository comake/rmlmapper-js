import csv from 'csvjson';
import { addArray } from '../util/ArrayUtil';
import type { SourceParser } from './SourceParser';

export class CsvParser implements SourceParser {
  private readonly data: any[];

  public constructor(source: string, options: Record<string, any>) {
    const csvOptions = {
      delimiter: options.csv?.delimiter ?? ',',
    };

    const result = csv.toObject(source, csvOptions);
    this.data = result;
  }

  public getCount(): number {
    return this.data.length;
  }

  public getData(index: number, selector: string): any[] {
    if (selector.startsWith('PATH~')) {
      return [ index.toString() ];
    }
    if (this.data[index]?.[selector]) {
      return addArray(this.data[index][selector]);
    }
    return [];
  }
}
