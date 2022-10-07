import { JSONPath } from 'jsonpath-plus';
import type { SourceParser } from './SourceParser';

type JsonValue =
  | string
  | number
  | boolean
  | JsonValue[];

export class JsonParser implements SourceParser {
  private readonly iterator: string;
  private readonly json: JSON;
  private readonly paths: string[];

  public constructor(source: JSON, iterator: string) {
    this.iterator = iterator;
    this.json = source;
    this.paths = JSONPath({ path: iterator, json: this.json, resultType: 'path' });
  }

  public getCount(): number {
    return this.paths.length;
  }

  public getData(index: number, selector: string): any[] {
    const sel = selector.replace(/^PATH~/u, '');
    const splitter = sel.startsWith('[') ? '' : '.';
    const arr = JSONPath({
      path: `${this.paths[index]}${splitter}${sel}`,
      json: this.json,
      resultType: selector.startsWith('PATH~') ? 'pointer' : 'value',
    })
      // Null values are ignored (undefined shouldn't happens since input is json)
      .filter((selectedValue: JsonValue): boolean => selectedValue !== null && selectedValue !== undefined);

    if (arr.length === 1 && Array.isArray(arr[0])) {
      return arr[0].map((selectedValue: JsonValue): string => selectedValue.toString());
    }
    return arr.map((selectedValue: JsonValue): string => selectedValue.toString());
  }
}
