import { registerCustomXPathFunction, evaluateXPathToNodes, evaluateXPath, evaluateXPathToStrings } from 'fontoxpath';
import { DOMParser } from 'slimdom';
import type { SourceParser } from './SourceParser';

function parseXml(xml: string): any {
  return new DOMParser().parseFromString(xml, 'text/xml');
}

registerCustomXPathFunction(
  'fn:parse-xml',
  [ 'xs:string' ],
  'item()',
  (context, xml): Document => parseXml(xml),
);

export class FontoxpathParser implements SourceParser {
  private readonly docArray: any[];

  public constructor(source: Document, iterator: string) {
    this.docArray = evaluateXPathToNodes(
      iterator,
      source,
      null,
      null,
      { language: evaluateXPath.XPATH_3_1_LANGUAGE },
    );
  }

  public getCount(): number {
    return this.docArray.length;
  }

  public getData(index: number, selector: string): any[] {
    if (selector.startsWith('PATH~')) {
      selector = `${selector.slice(5)}/path()`;
    }
    const object = this.docArray[index];
    const strings = evaluateXPathToStrings(
      selector,
      object,
      null,
      null,
      { language: evaluateXPath.XPATH_3_1_LANGUAGE },
    );
    return strings;
  }
}
