import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import type { SourceParserArgs } from './SourceParser';
import { SourceParser } from './SourceParser';

// Adapted from https://stackoverflow.com/a/30227178
function getPathToElem(element: xpath.SelectedValue): string {
  if (typeof element !== 'string' && typeof element !== 'number' && typeof element !== 'boolean') {
    if (!element.parentNode) {
      return '';
    }
    let ix = 0;
    // eslint-disable-next-line unicorn/prefer-spread
    for (const child of Array.from(element.parentNode.childNodes)) {
      if (child === element) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore
        return `${getPathToElem(element.parentNode)}/${element.tagName}[${ix + 1}]`;
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore
      if (child.nodeType === 1 && child.tagName === element.tagName) {
        ix += 1;
      }
    }
  }
  return '';
}

export class XmlParser extends SourceParser<Document> {
  private readonly parser = new DOMParser();
  private readonly docArray: any[];

  public constructor(args: SourceParserArgs) {
    super(args);
    const source = this.readSourceWithCache();
    this.docArray = xpath.select(args.iterator, source);
  }

  protected parseSource(source: string): Document {
    if (this.options.removeNameSpace) {
      for (const key in this.options.removeNameSpace) {
        // eslint-disable-next-line unicorn/prefer-object-has-own
        if (Object.prototype.hasOwnProperty.call(this.options.removeNameSpace, key)) {
          const toDelete = `${key}="${this.options.removeNameSpace[key]}"`;
          source = source.replace(toDelete, '');
        }
      }
    }
    return this.parser.parseFromString(source);
  }

  public getCount(): number {
    return this.docArray.length;
  }

  protected getRawData(index: number, path: string): any[] {
    const object = this.docArray[index];
    const temp = xpath.select(path.replace(/^PATH~/u, ''), object);
    const arr: string[] = [];
    if (path.startsWith('PATH~') && Array.isArray(temp)) {
      return temp.map(getPathToElem);
    }
    if (typeof temp === 'string') {
      return [ temp ];
    }
    temp.forEach((node: xpath.SelectedValue): void => {
      if (typeof node !== 'string' && typeof node !== 'number' && typeof node !== 'boolean') {
        if (node.nodeValue) {
          arr.push(node.nodeValue);
        } else {
          const children = node.childNodes;
          if (children) {
            // eslint-disable-next-line unicorn/prefer-spread
            Array.from(children).forEach((child: ChildNode): void => {
              if ('data' in child) {
                arr.push((child as ChildNode & { data: string }).data);
              }
            });
          }
        }
      }
    });
    return arr;
  }
}
