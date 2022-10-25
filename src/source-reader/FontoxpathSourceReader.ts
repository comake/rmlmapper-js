import { DOMParser } from '@xmldom/xmldom';
import { SourceReader } from './SourceReader';

export class FontoxpathSourceReader extends SourceReader<Document> {
  private readonly parser = new DOMParser();

  protected readSource(source: string): Document {
    const xml = this.readSourceFromInputOptions(source);
    return this.parser.parseFromString(xml, 'text/xml');
  }
}
