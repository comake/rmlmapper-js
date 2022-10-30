import { registerCustomXPathFunction, evaluateXPathToNodes, evaluateXPath, evaluateXPathToStrings } from 'fontoxpath';
import { DOMParser } from 'slimdom';
import type { SourceParserArgs } from './SourceParser';
import { SourceParser } from './SourceParser';

function parseXml(xml: string): any {
  return new DOMParser().parseFromString(xml, 'text/xml');
}

registerCustomXPathFunction(
  'fn:parse-xml',
  [ 'xs:string' ],
  'item()',
  (context, xml): Document => parseXml(xml),
);

export class FontoxpathParser extends SourceParser {
  private readonly docArray: any[];

  public constructor(args: SourceParserArgs) {
    super(args);
    this.docArray = evaluateXPathToNodes(
      args.iterator,
      args.source,
      null,
      null,
      { language: evaluateXPath.XPATH_3_1_LANGUAGE },
    );
  }

  public getCount(): number {
    return this.docArray.length;
  }

  public getRawData(index: number, selector: string): any[] {
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
