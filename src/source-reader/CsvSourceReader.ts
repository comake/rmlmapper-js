import { SourceReader } from './SourceReader';

export class CsvSourceReader extends SourceReader<string> {
  protected readSource(source: string): string {
    return this.readSourceFromInputOptions(source);
  }
}
