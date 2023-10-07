/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeObject } from 'jsonld';
import type { FunctionExecutor } from '../FunctionExecutor';
import type { SourceParser } from '../input-parser/SourceParser';
import type { MappingProcessor } from '../MappingProcessor';
import { addArray } from './ArrayUtil';
import { getAllOcurrences } from './StringUtil';
import type {
  JSONArray,
  JSONObject,
  ObjectMap,
  OrArray,
  PredicateMap,
  PredicateObjectMap,
  ReferenceNodeObject,
  SubjectMap,
  TermMap,
  ValueObject,
} from './Types';
import { toURIComponent, unescapeCurlyBrackets } from './UriUtil';
import { FNML, FNO, FNO_HTTPS, RDF, RML, RR, XSD } from './Vocabulary';

export function addToObj(obj: Record<string, any>, pred: string, data: any): void {
  if (obj[pred]) {
    const dataAsArray = Array.isArray(data) ? data : [ data ];
    if (Array.isArray(obj[pred])) {
      obj[pred].push(...dataAsArray);
    } else {
      obj[pred] = [ obj[pred], ...dataAsArray ];
    }
  } else {
    obj[pred] = data;
  }
}

export function addToObjAsReference(obj: Record<string, any>, pred: string, data: string): void {
  const dataAsNode: ReferenceNodeObject = { '@id': data };
  addToObj(obj, pred, dataAsNode);
}

export function getValue<T extends string | boolean | number | JSONObject | JSONArray>(
  fieldValue: ValueObject<T> | T,
): T {
  if (fieldValue && typeof fieldValue === 'object' && '@value' in (fieldValue as ValueObject<T>)) {
    return (fieldValue as ValueObject<T>)['@value'] as unknown as T;
  }
  return fieldValue as unknown as T;
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
    return jsonLd.reduce((arr: NodeObject[], subDoc): NodeObject[] => {
      if (subDoc) {
        arr.push(removeEmptyFromAllKeysOfNodeObject(subDoc));
      }
      return arr;
    }, []) as RemoveEmptyReturnType<T>;
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
        addToObj(obj, '@type', types);
      } else {
        const type = obj[key];
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete obj[key];
        addToObj(obj, '@type', type);
      }
    } else if (obj[key] && typeof obj[key] === 'object') {
      convertRdfTypeToJsonldType(obj[key]);
    }
  });
}

export function getConstant<T extends string | number | boolean>(
  constant: TermMap[typeof RR.constant],
): T {
  if (typeof constant === 'object') {
    if ('@id' in constant) {
      return constant['@id'] as T;
    }
    if ('@value' in constant) {
      if (constant['@type'] === XSD.integer) {
        return Number.parseInt(constant['@value'] as string, 10) as T;
      }
      if (constant['@type'] === XSD.double) {
        return Number.parseFloat(constant['@value'] as string) as T;
      }
      if (constant['@type'] === XSD.boolean) {
        return (constant['@value'] === true || constant['@value'] === 'true') as T;
      }
      return constant['@value'] as T;
    }
  }
  return constant as T;
}

function getPredicateValue(predicate: OrArray<ReferenceNodeObject>): OrArray<string> {
  if (Array.isArray(predicate)) {
    return predicate.map((predicateItem: ReferenceNodeObject): string => predicateItem['@id']);
  }
  if (typeof predicate === 'object') {
    return predicate['@id'];
  }
  return predicate;
}

function getFunctionNameFromObject(object: OrArray<ReferenceNodeObject>): string {
  if (Array.isArray(object)) {
    if (object.length === 1) {
      return getIdFromNodeObjectIfDefined(object[0])!;
    }
    throw new Error('Only one function may be specified per PredicateObjectMap');
  }
  return getIdFromNodeObjectIfDefined(object)!;
}

function getFunctionNameFromObjectMap(objectMap: OrArray<ObjectMap>): string {
  const isArray = Array.isArray(objectMap);
  if (isArray && objectMap.length > 1) {
    throw new Error('Only one function may be specified per PredicateObjectMap');
  }
  if (isArray && objectMap[0][RR.constant]) {
    return getConstant(objectMap[0][RR.constant]);
  }
  if (!isArray && objectMap[RR.constant]) {
    return getConstant(objectMap[RR.constant]);
  }
  throw new Error('Object must be specified through constant');
}

export function getFunctionNameFromPredicateObjectMap(predicateObjectMap: PredicateObjectMap): string | undefined {
  const { [RR.objectMap]: objectMap, [RR.object]: object } = predicateObjectMap;
  if (object) {
    return getFunctionNameFromObject(object);
  }
  if (objectMap) {
    return getFunctionNameFromObjectMap(objectMap);
  }
  throw new Error('No object specified in PredicateObjectMap');
}

export function isFnoExecutesPredicate(predicate: string): boolean {
  return predicate === FNO.executes || predicate === FNO_HTTPS.executes;
}

function hasLogicalSource(node: NodeObject): boolean {
  return RML.logicalSource in node;
}

export function isFunctionValuedSubjectMap(subjectMap: SubjectMap): boolean {
  return typeof subjectMap === 'object' && FNML.functionValue in subjectMap;
}

export function predicateContainsFnoExecutes(predicate: OrArray<string>): boolean {
  if (Array.isArray(predicate)) {
    return predicate.some((predicateItem): boolean => isFnoExecutesPredicate(predicateItem));
  }
  return isFnoExecutesPredicate(predicate);
}

function isJsonLDReference(obj: any): boolean {
  return typeof obj === 'object' && '@id' in obj && Object.keys(obj).length === 1;
}

// May create circular data-structure (probably not common in RML though)
export function jsonLDGraphToObj(graph: NodeObject[], deleteReplaced = false): NodeObject[] {
  const graphHasNodeWithoutId = graph.some((node): boolean => !node['@id']);
  if (graphHasNodeWithoutId) {
    throw new Error('node without id');
  }

  const graphById = graph.reduce((object: Record<string, NodeObject>, node): Record<string, NodeObject> => {
    object[node['@id']!] = node;
    return object;
  }, {});

  const replacedIds = [];
  for (const id of Object.keys(graphById)) {
    const node = graphById[id];
    for (const key of Object.keys(node)) {
      const fieldValue = node[key];
      if (Array.isArray(fieldValue)) {
        fieldValue.forEach((value, index): void => {
          if (isJsonLDReference(value) && (value as ReferenceNodeObject)['@id'] in graphById) {
            replacedIds.push((value as ReferenceNodeObject)['@id']);
            (graphById[id][key] as NodeObject[])[index] = graphById[(value as ReferenceNodeObject)['@id']];
          }
        });
      } else if (isJsonLDReference(fieldValue) && (fieldValue as ReferenceNodeObject)['@id'] in graphById) {
        replacedIds.push((fieldValue as ReferenceNodeObject)['@id']);
        graphById[id][key] = graphById[(fieldValue as ReferenceNodeObject)['@id']];
      }
    }
  }
  if (deleteReplaced) {
    for (const deleteId of replacedIds) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete graphById[deleteId];
    }
  }
  return Object.values(graphById);
}

export function replaceReferences(graph: NodeObject[]): NodeObject[] {
  const connectedGraph = jsonLDGraphToObj(graph, true);
  // Test for circular deps & remove links
  try {
    return JSON.parse(JSON.stringify(connectedGraph));
  } catch {
    // eslint-disable-next-line no-console
    console.error('Could not replace, circular dependencies when replacing nodes');
    return graph;
  }
}

function setValueAtPredicate(
  obj: Record<string, any>,
  predicate: string,
  data: any,
  language?: string,
  datatype?: ReferenceNodeObject | string,
): void {
  if (language !== undefined || datatype !== undefined) {
    if (obj[predicate]) {
      const newValue = {
        '@type': datatype,
        '@value': data,
        '@language': language,
      };
      if (typeof obj[predicate] === 'object' && obj[predicate]['@value']) {
        obj[predicate] = [ obj[predicate], newValue ];
      } else if (Array.isArray(obj[predicate])) {
        obj[predicate].push(newValue);
      } else {
        const previousValue = {
          '@value': obj[predicate],
        };
        obj[predicate] = [ previousValue, newValue ];
      }
    } else {
      obj[predicate] = {
        '@value': data,
        '@type': datatype,
        '@language': language,
      };
    }
  } else if (obj[predicate]) {
    obj[predicate] = addArray(obj[predicate]);
    obj[predicate].push(data);
  } else {
    obj[predicate] = data;
  }
}

export function setObjPredicate(
  obj: Record<string, any>,
  predicate: string,
  dataSet: any,
  language?: string,
  datatype?: ReferenceNodeObject | string,
): void {
  if (datatype) {
    datatype = typeof datatype === 'object' ? datatype['@id'] : datatype;
  }
  if (datatype === RDF.JSON) {
    datatype = '@json';
  }

  if (datatype === '@json') {
    setValueAtPredicate(obj, predicate, dataSet, language, datatype);
  } else {
    dataSet = addArray(dataSet).filter((data): boolean => data !== undefined);
    for (const data of dataSet) {
      setValueAtPredicate(obj, predicate, data, language, datatype);
    }
  }
}

export function setObjPredicateWithTermType(
  obj: Record<string, any>,
  predicate: string,
  dataSet: any,
  termType: string,
  language?: string,
  datatype?: ReferenceNodeObject | string,
): void {
  let result: OrArray<ReferenceNodeObject | string>;
  switch (termType) {
    case RR.BlankNode:
      if (Array.isArray(dataSet)) {
        result = dataSet.map((item): ReferenceNodeObject => ({ '@id': `_:${item}` }));
      } else {
        result = { '@id': `_:${dataSet}` };
      }
      break;
    case RR.IRI:
      if (Array.isArray(dataSet)) {
        result = dataSet.map((item): ReferenceNodeObject => ({ '@id': item }));
      } else {
        result = { '@id': dataSet };
      }
      break;
    case RR.Literal:
      result = dataSet;
      break;
    default:
      throw new Error(`Invalid rr:termType: ${termType}`);
  }
  setObjPredicate(obj, predicate, result, language, datatype);
}

export function allCombinationsOfArray(arr: any[][]): string[][] {
  if (arr.length === 0) {
    return [];
  }
  if (arr.length === 1) {
    return arr[0].map((item): any[] => [ item ]);
  }
  const result = [];
  const firstElement = arr[0];
  const allCombinationsOfRest = allCombinationsOfArray(arr.slice(1));
  for (const combinination of allCombinationsOfRest) {
    for (const element of firstElement) {
      result.push([ element, ...combinination ]);
    }
  }
  return result;
}

export function calculateTemplate(
  template: string,
  index: number,
  sourceParser: SourceParser<any>,
  termType?: string,
): string[] {
  const openBracketIndicies = getAllOcurrences('{', template);
  const closedBracketIndicies = getAllOcurrences('}', template);
  if (openBracketIndicies.length === 0 || openBracketIndicies.length !== closedBracketIndicies.length) {
    return [ template ];
  }
  const selectorsInTemplate = openBracketIndicies.map((beginningValue: number, idx: number): string =>
    template.slice(beginningValue + 1, closedBracketIndicies[idx]));
  const dataToInsert = selectorsInTemplate.map((selector): any[] =>
    addArray(sourceParser.getData(index, selector)));
  const allDataCombinations = allCombinationsOfArray(dataToInsert);
  return allDataCombinations.reduce((templates: string[], combinination: any[]): string[] => {
    const finalTemplate = combinination.reduce((resolvedTemplate: string, word: string, idxB: number): string => {
      if (!termType || termType !== RR.Literal) {
        word = toURIComponent(word);
      }
      return resolvedTemplate.replace(`{${selectorsInTemplate[idxB]}}`, word);
    }, template);
    if (finalTemplate.length > 0) {
      templates.push(unescapeCurlyBrackets(finalTemplate));
    }
    return templates;
  }, []);
}

export async function getValueOfTermMap(
  termMap: TermMap,
  index: number,
  sourceParser: SourceParser<any>,
  topLevelMappingProcessors: Record<string, MappingProcessor>,
  functionExecutor: FunctionExecutor,
): Promise<OrArray<string>> {
  if (RR.constant in termMap) {
    return getConstant<string>(termMap[RR.constant]);
  }
  if (RML.reference in termMap) {
    return sourceParser.getData(index, getValue<string>(termMap[RML.reference]!));
  }
  if (RR.template in termMap) {
    const template = getValue<string>(termMap[RR.template]!);
    return calculateTemplate(
      template,
      index,
      sourceParser,
    );
  }
  if (FNML.functionValue in termMap) {
    return await functionExecutor.executeFunctionFromValue(
      termMap[FNML.functionValue]!,
      index,
      topLevelMappingProcessors,
    );
  }
  throw new Error('TermMap has neither constant, reference or template');
}

async function getPredicateValueFromPredicateMap(
  predicateMap: OrArray<PredicateMap>,
  index: number,
  topLevelMappingProcessors: Record<string, MappingProcessor>,
  sourceParser: SourceParser<any>,
  functionExecutor: FunctionExecutor,
): Promise<OrArray<string>> {
  if (Array.isArray(predicateMap)) {
    const predicateArrays = await Promise.all(
      predicateMap.map((predicateMapItem): Promise<OrArray<string>> =>
        getValueOfTermMap(
          predicateMapItem,
          index,
          sourceParser,
          topLevelMappingProcessors,
          functionExecutor,
        )),
    );
    return predicateArrays.flat();
  }
  return await getValueOfTermMap(
    predicateMap,
    index,
    sourceParser,
    topLevelMappingProcessors,
    functionExecutor,
  );
}

export async function getPredicateValueFromPredicateObjectMap(
  mapping: PredicateObjectMap,
  index: number,
  topLevelMappingProcessors: Record<string, MappingProcessor>,
  sourceParser: SourceParser<any>,
  functionExecutor: FunctionExecutor,
): Promise<OrArray<string>> {
  const { [RR.predicate]: predicate, [RR.predicateMap]: predicateMap } = mapping;
  if (predicate) {
    return getPredicateValue(predicate);
  }
  if (predicateMap) {
    return await getPredicateValueFromPredicateMap(
      predicateMap,
      index,
      topLevelMappingProcessors,
      sourceParser,
      functionExecutor,
    );
  }
  throw new Error('No predicate specified in PredicateObjectMap');
}

function hasSubjectMap(node: NodeObject): boolean {
  return RR.subject in node || RR.subjectMap in node;
}

export function isTriplesMap(node: NodeObject): boolean {
  return hasLogicalSource(node) && hasSubjectMap(node);
}
