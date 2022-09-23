import { registerCustomXPathFunction, evaluateXPathToNodes, evaluateXPath, evaluateXPathToStrings } from 'fontoxpath';
import type { Document } from 'slimdom';
import { DOMParser } from 'slimdom';
import helper from './helper.js';
import type { Parser } from './Parser';

function parseXml(xml: string): any {
  return new DOMParser().parseFromString(xml, 'text/xml');
}

registerCustomXPathFunction(
  'fn:parse-xml',
  [ 'xs:string' ],
  'item()',
  (context, xml): Document => parseXml(xml),
);

export class FontoxpathParser implements Parser {
  private readonly docArray: any[];

  public constructor(inputPath: string, iterator: string, options: Record<string, any>) {
    const doc = helper.readFileString(inputPath, options);
    this.docArray = evaluateXPathToNodes(
      iterator,
      parseXml(doc),
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
