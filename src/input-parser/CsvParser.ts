import csv from 'csvjson';
import helper from './helper.js';
import type { Parser } from './Parser';

export class CsvParser implements Parser {
  private readonly iterator: string;
  private readonly data: any[];

  public constructor(inputPath: string, iterator: string, options: Record<string, any>) {
    this.iterator = iterator;
    const csvString = helper.readFileCSV(inputPath, options) as string;

    const csvOptions = {
      delimiter: options.csv?.delimiter ?? ',',
    };

    const result = csv.toObject(csvString, csvOptions);
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
      return helper.addArray(this.data[index][selector]);
    }
    return [];
  }
}
