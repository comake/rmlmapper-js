import type { SourceParserArgs } from '../../../src/input-parser/SourceParser';
import { SourceParser } from '../../../src/input-parser/SourceParser';

class DummyParser extends SourceParser<string> {
  public constructor(args: SourceParserArgs) {
    super(args);
  }

  protected parseSource(source: string): string {
    return source;
  }

  public getCount(): number {
    return 3;
  }

  protected getRawData(): string[] {
    return [ 'a', 'b', '' ];
  }
}

describe('A SourceParser', (): void => {
  const source = './input.json';
  const sourceCache = {};
  const iterator = '$';
  let options: any;

  beforeEach(async(): Promise<void> => {
    options = {};
  });

  it('returns data matching the query.', async(): Promise<void> => {
    const parser = new DummyParser({ options, source, iterator, sourceCache });
    expect(parser.getData(0, 'query')).toEqual([ 'a', 'b', '' ]);
  });
  it('removes empty strings if ignoreEmptyStrings is true.', async(): Promise<void> => {
    options.ignoreEmptyStrings = true;
    const parser = new DummyParser({ options, source, iterator, sourceCache });
    expect(parser.getData(0, 'query')).toEqual([ 'a', 'b' ]);
  });
  it('does not return values in ignoreValues.', async(): Promise<void> => {
    options.ignoreValues = [ 'a', 'b' ];
    const parser = new DummyParser({ options, source, iterator, sourceCache });
    expect(parser.getData(0, 'query')).toEqual([ '' ]);
  });
});
