import type { NodeObject, ValueObject } from 'jsonld';
import helper from '../input-parser/helper.js';
import { addArray } from './ArrayUtil';
import type { JSONArray, JSONObject, OrArray, ReferenceNodeObject } from './Types';
import { RDF } from './Vocabulary';

export function getValueIfDefined<T>(
  fieldValue?: ValueObject | string | boolean | number | JSONObject | JSONArray,
): OrArray<T> | undefined {
  if (fieldValue && Array.isArray(fieldValue)) {
    return fieldValue.map((valueItem): T => getValueIfDefined<T>(valueItem) as T);
  }
  if (fieldValue && typeof fieldValue === 'object' && '@value' in fieldValue) {
    return fieldValue['@value'] as unknown as T;
  }
  if (fieldValue !== undefined && fieldValue !== null) {
    return fieldValue as unknown as T;
  }
}

export function getIdFromNodeObjectIfDefined(nodeObject?: ReferenceNodeObject | string): string | undefined {
  if (nodeObject && typeof nodeObject === 'object') {
    return nodeObject['@id'];
  }
  if (nodeObject) {
    return nodeObject;
  }
}

export function findObjectWithIdInArray<T>(
  objArr: T[],
  id: string,
): T | undefined {
  return objArr.find((obj: any): boolean => obj['@id'] === id) as T;
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
      const temp = addArray(obj[key]);
      if (temp?.[0] && typeof temp[0] === 'object') {
        const types = temp.map((tempItem): string => tempItem['@id']);
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete obj[key];
        helper.addToObj(obj, '@type', types);
      } else {
        const type = obj[key];
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete obj[key];
        helper.addToObj(obj, '@type', type);
      }
    } else if (obj[key] && typeof obj[key] === 'object') {
      convertRdfTypeToJsonldType(obj[key]);
    }
  });
}
