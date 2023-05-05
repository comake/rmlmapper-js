import { DOMParser } from '@xmldom/xmldom';
import { registerCustomXPathFunction, evaluateXPathToNodes, evaluateXPath, evaluateXPathToStrings } from 'fontoxpath';
import { DOMParser as SlimDOMParser } from 'slimdom';
import type { SourceParserArgs } from './SourceParser';
import { SourceParser } from './SourceParser';

function parseXml(xml: string): any {
  return new SlimDOMParser().parseFromString(xml, 'text/xml');
}

registerCustomXPathFunction(
  'fn:parse-xml',
  [ 'xs:string' ],
  'item()',
  (context, xml): Document => parseXml(xml),
);

export class FontoxpathParser extends SourceParser<Document> {
  private readonly parser = new DOMParser();
  private readonly docArray: any[];

  public constructor(args: SourceParserArgs) {
    super(args);
    const source = this.readSourceWithCache();
    this.docArray = evaluateXPathToNodes(
      args.iterator,
      source,
      null,
      null,
      { language: evaluateXPath.XPATH_3_1_LANGUAGE },
    );
  }

  protected parseSource(source: string): Document {
    return this.parser.parseFromString(source, 'text/xml');
  }

  public getCount(): number {
    return this.docArray.length;
  }

  protected getRawData(index: number, selector: string): any[] {
    if (selector.startsWith('PATH~')) {
      selector = `${selector.slice(5)}/path()`;
    }
    const object = this.docArray[index];
    return evaluateXPathToStrings(
      selector,
      object,
      null,
      null,
      { language: evaluateXPath.XPATH_3_1_LANGUAGE },
    );
  }
}
