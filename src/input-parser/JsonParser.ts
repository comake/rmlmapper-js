import { JSONPath } from 'jsonpath-plus';
import { RDF } from '../util/Vocabulary';
import { SourceParser } from './SourceParser';
import type { SourceParserArgs } from './SourceParser';

type JsonValue =
  | string
  | number
  | boolean
  | JsonValue[];

export class JsonParser extends SourceParser<JSON> {
  private readonly json: JSON;
  private readonly paths: string[];

  public constructor(args: SourceParserArgs) {
    super(args);
    const source = this.readSourceWithCache();
    this.json = source;
    this.paths = JSONPath({ path: args.iterator, json: this.json, resultType: 'path' });
  }

  protected parseSource(source: string): JSON {
    return JSON.parse(source);
  }

  public getCount(): number {
    return this.paths.length;
  }

  protected getRawData(index: number, selector: string, datatype: string): any[] {
    const sel = selector.replace(/^PATH~/u, '');
    const splitter = sel.startsWith('[') ? '' : '.';
    const values = JSONPath({
      path: `${this.paths[index]}${splitter}${sel}`,
      json: this.json,
      resultType: selector.startsWith('PATH~') ? 'pointer' : 'value',
    })
      // Null values are ignored (undefined shouldn't happens since input is json)
      .filter((selectedValue: JsonValue): boolean => selectedValue !== null && selectedValue !== undefined);

    if (values.length === 1 && Array.isArray(values[0]) && datatype !== RDF.JSON) {
      return values[0];
    }
    return values;
  }
}
