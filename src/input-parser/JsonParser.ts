import { JSONPath } from 'jsonpath-plus';
import { SourceParser } from './SourceParser';
import type { SourceParserArgs } from './SourceParser';

type JsonValue =
  | string
  | number
  | boolean
  | JsonValue[];

export class JsonParser extends SourceParser {
  private readonly json: JSON;
  private readonly paths: string[];

  public constructor(args: SourceParserArgs) {
    super(args);
    this.json = args.source;
    this.paths = JSONPath({ path: args.iterator, json: this.json, resultType: 'path' });
  }

  public getCount(): number {
    return this.paths.length;
  }

  public getRawData(index: number, selector: string): any[] {
    const sel = selector.replace(/^PATH~/u, '');
    const splitter = sel.startsWith('[') ? '' : '.';
    const values = JSONPath({
      path: `${this.paths[index]}${splitter}${sel}`,
      json: this.json,
      resultType: selector.startsWith('PATH~') ? 'pointer' : 'value',
    })
      // Null values are ignored (undefined shouldn't happens since input is json)
      .filter((selectedValue: JsonValue): boolean => selectedValue !== null && selectedValue !== undefined);

    if (values.length === 1 && Array.isArray(values[0])) {
      return values[0];
    }
    return values;
  }
}
