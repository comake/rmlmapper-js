import { SourceReader } from './SourceReader';

export class JsonSourceReader extends SourceReader<JSON> {
  protected readSource(source: string): JSON {
    const sourceContents = this.readSourceFromInputOptions(source);
    return JSON.parse(sourceContents);
  }
}
