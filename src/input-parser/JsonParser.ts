import { JSONPath } from 'jsonpath-plus';
import { RDF } from '../util/Vocabulary';
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

  public getRawData(index: number, selector: string, datatype?: string): string[] {
    const isJsonDataType = datatype === RDF.JSON;
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
      if (isJsonDataType) {
        return arr[0];
      }
      return arr[0].map((selectedValue: JsonValue): string => selectedValue.toString());
    }
    if (isJsonDataType) {
      return arr;
    }
    return arr.map((selectedValue: JsonValue): string => selectedValue.toString());
  }
}
