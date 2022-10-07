import { DOMParser } from '@xmldom/xmldom';
import { SourceReader } from './SourceReader';

export class XmlSourceReader extends SourceReader<Document> {
  private readonly parser = new DOMParser();

  protected readSource(source: string): Document {
    let xml = this.readSourceFromInputOptions(source);
    if (this.options.removeNameSpace) {
      for (const key in this.options.removeNameSpace) {
        // eslint-disable-next-line unicorn/prefer-object-has-own
        if (Object.prototype.hasOwnProperty.call(this.options.removeNameSpace, key)) {
          const toDelete = `${key}="${this.options.removeNameSpace[key]}"`;
          xml = xml.replace(toDelete, '');
        }
      }
    }
    return this.parser.parseFromString(xml);
  }
}
