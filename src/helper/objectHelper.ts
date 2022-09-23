import type { NodeObject } from 'jsonld';
import helper from '../input-parser/helper.js';
import type { OrArray } from '../util/Types';
import { RDF } from '../util/Vocabulary';
import { replacePrefixWithURL } from './prefixHelper.js';

export function findIdinObjArr(
  objArr: any[],
  id: string,
  prefixes: Record<string, string>,
): any | undefined {
  return objArr.find((obj: any): boolean =>
    replacePrefixWithURL(obj['@id'], prefixes) === replacePrefixWithURL(id, prefixes));
}

function removeEmptyFromAllKeysOfNodeObject(nodeObject: NodeObject): NodeObject {
  return Object.keys(nodeObject)
    .reduce((obj: NodeObject, subNodeKey: string): NodeObject => {
      if (obj[subNodeKey] && typeof obj[subNodeKey] === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        obj[subNodeKey] = removeEmptyFromAllNodes(obj[subNodeKey] as NodeObject);
      } else if (obj[subNodeKey] === null || obj[subNodeKey] === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete obj[subNodeKey];
      }
      return obj;
    }, nodeObject);
}

type RemoveEmptyReturnType<T extends OrArray<NodeObject>> = T extends NodeObject[] ? NodeObject[] : NodeObject;

export function removeEmptyFromAllNodes<T extends OrArray<NodeObject>>(jsonLd: T): RemoveEmptyReturnType<T> {
  if (Array.isArray(jsonLd)) {
    return jsonLd.map((subDoc): NodeObject => removeEmptyFromAllKeysOfNodeObject(subDoc)) as RemoveEmptyReturnType<T>;
  }
  return removeEmptyFromAllKeysOfNodeObject(jsonLd) as RemoveEmptyReturnType<T>;
}

function removeMetaFromNode(nodeObject: NodeObject): NodeObject {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $parentTriplesMap, $parentPaths, ...nodeObjectWithoutMeta } = nodeObject;
  return nodeObjectWithoutMeta;
}

export function removeMetaFromAllNodes(jsonLd: NodeObject[]): NodeObject[] {
  return jsonLd.map((subDoc): NodeObject => removeMetaFromNode(subDoc));
}

export function convertRdfTypeToJsonldType(obj: Record<string, any>): void {
  Object.keys(obj).forEach((key): void => {
    if (key === 'rdf:type' || key === RDF.type) {
      const temp = helper.addArray(obj[key]);
      if (temp?.[0] && typeof temp[0] === 'object') {
        return;
      }
      const type = obj[key];
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete obj[key];
      helper.addToObj(obj, '@type', type);
    } else if (obj[key] && typeof obj[key] === 'object') {
      convertRdfTypeToJsonldType(obj[key]);
    }
  });
}
