/* eslint-disable
  unicorn/prefer-object-has-own,
  @typescript-eslint/naming-convention,
  no-console
*/
import * as jsonld from 'jsonld';
import type { NodeObject } from 'jsonld';
import type { ParsedMappingResult } from './MappingProcessor';
import { MappingProcessor } from './MappingProcessor';
import { addArray, intersection } from './util/ArrayUtil';
import {
  findObjectWithIdInArray,
  removeMetaFromAllNodes,
  removeEmptyFromAllNodes,
  convertRdfTypeToJsonldType,
  getIdFromNodeObjectIfDefined,
  getValue,
  isTriplesMap,
  replaceReferences,
  jsonLDGraphToObj,
  addToObjAsReference,
} from './util/ObjectUtil';
import { ttlToJson } from './util/TurtleUtil';
import type { LogicalSource, ParseOptions, ProcessOptions, ReferenceNodeObject } from './util/Types';
import { RML, RR } from './util/Vocabulary';

export class RmlMapper {
  private readonly sourceCache = {};
  private readonly options: ProcessOptions;

  public constructor(options: ProcessOptions) {
    this.options = options;
  }

  public async parseJsonLd(mapping: NodeObject): Promise<NodeObject[] | string> {
    const flattenedMapping = await jsonld.flatten(mapping, {});
    return await this.processAndCleanJsonLdMapping(flattenedMapping);
  }

  public async parseTurtle(mapping: string): Promise<NodeObject[] | string> {
    const response = await ttlToJson(mapping);
    return await this.processAndCleanJsonLdMapping(response);
  }

  private async processAndCleanJsonLdMapping(mapping: NodeObject): Promise<NodeObject[] | string> {
    const output = await this.processMapping(mapping);
    const out = await this.clean(output);
    if (this.options.toRDF) {
      return await jsonld.toRDF(out, { format: 'application/n-quads' }) as unknown as string;
    }
    return out;
  }

  private async processMapping(mapping: NodeObject): Promise<Record<string, NodeObject[]>> {
    const graph = mapping['@graph'] as NodeObject[];
    const connectedGraph = jsonLDGraphToObj(graph);
    const output = await this.processTopLevelMappings(connectedGraph);
    return this.mergeJoin(output, connectedGraph);
  }

  private async processTopLevelMappings(graph: NodeObject[]): Promise<Record<string, ParsedMappingResult[]>> {
    const topLevelMappingProcessors = graph
      .reduce((obj: Record<string, MappingProcessor>, node: NodeObject): Record<string, MappingProcessor> => {
        if (isTriplesMap(node)) {
          obj[node['@id']!] = this.createProcessorForMapping(graph, node);
        }
        return obj;
      }, {});
    if (Object.keys(topLevelMappingProcessors).length === 0) {
      throw new Error('No top level mapping found');
    }
    const output: Record<string, ParsedMappingResult[]> = {};
    for (const [ mappingId, proccessor ] of Object.entries(topLevelMappingProcessors)) {
      if (proccessor.hasProcessed()) {
        output[mappingId] = proccessor.getReturnValue();
      } else {
        output[mappingId] = await proccessor.processMapping(topLevelMappingProcessors);
      }
    }
    return output;
  }

  private createProcessorForMapping(
    data: NodeObject[],
    mapping: any,
  ): MappingProcessor {
    const logicalSource = findObjectWithIdInArray(data, mapping[RML.logicalSource]['@id']) as unknown as LogicalSource;
    const referenceFormulation = this.getReferenceFormulationFromLogicalSource(logicalSource);
    const iterator = this.getIteratorFromLogicalSource(logicalSource, referenceFormulation);
    const source = this.getSourceFromLogicalSource(logicalSource);
    return new MappingProcessor({
      source,
      referenceFormulation,
      options: this.options,
      sourceCache: this.sourceCache,
      iterator,
      mapping,
      data,
    });
  }

  private getReferenceFormulationFromLogicalSource(logicalSource: LogicalSource): string {
    const referenceFormulation = logicalSource[RML.referenceFormulation];
    if (Array.isArray(referenceFormulation)) {
      if (referenceFormulation.length === 1) {
        return getIdFromNodeObjectIfDefined(referenceFormulation[0])!;
      }
      throw new Error('Only one rml:referenceFormulations may be supplied. Found multiple.');
    }
    return getIdFromNodeObjectIfDefined(referenceFormulation)!;
  }

  private getSourceFromLogicalSource(logicalSource: LogicalSource): string {
    const source = logicalSource[RML.source];
    if (Array.isArray(source)) {
      if (source.length === 1) {
        return getValue<string>(source[0]);
      }
      throw new Error('Exactly one rml:source must be supplied. Found multiple.');
    }
    return getValue(source);
  }

  private getIteratorFromLogicalSource(logicalSource: LogicalSource, referenceFormulation: string): string {
    if (referenceFormulation === 'CSV') {
      return '$';
    }
    return getValue<string>(logicalSource[RML.iterator]);
  }

  private mergeJoin(
    output: Record<string, ParsedMappingResult[]>,
    data: any[],
  ): Record<string, any> {
    for (const key in output) {
      if (Object.prototype.hasOwnProperty.call(output, key)) {
        output[key] = addArray(output[key]);
        const firstentry = output[key][0];
        // Every entry in a mapping will have the same join properties, thus take join paths from first entry
        if (firstentry?.$parentTriplesMap) {
          const parentTriplesMap = firstentry.$parentTriplesMap;
          for (const predicate in parentTriplesMap) {
            if (Object.prototype.hasOwnProperty.call(parentTriplesMap, predicate)) {
              const predicateData = parentTriplesMap[predicate];
              // eslint-disable-next-line @typescript-eslint/no-for-in-array
              for (const i in predicateData) {
                if (Object.prototype.hasOwnProperty.call(predicateData, i)) {
                  const singleJoin = predicateData[i];
                  const record = findObjectWithIdInArray(data, singleJoin.mapID);
                  const parentId = (record[RR.parentTriplesMap] as ReferenceNodeObject)['@id'];
                  const toMapData = addArray(output[parentId]);

                  if (singleJoin.joinCondition) {
                    const cache: Record<string, Record<string, string[]>> = {};
                    singleJoin.joinCondition.forEach(({ parentPath }): void => {
                      cache[parentPath] = {};
                      for (const tmd of toMapData) {
                        if (tmd.$parentPaths) {
                          const parentData = tmd.$parentPaths[parentPath];
                          const parentDataArr = addArray(parentData);
                          if (parentDataArr.length !== 1) {
                            console.warn(`joinConditions parent must return only one value! Parent: ${parentDataArr}`);
                            break;
                          }
                          const firstParentData = parentDataArr[0];
                          if (!cache[parentPath][firstParentData]) {
                            cache[parentPath][firstParentData] = [];
                          }
                          cache[parentPath][firstParentData].push(tmd['@id']!);
                        }
                      }
                    });

                    for (const entry of output[key]) {
                      const joinConditions = entry.$parentTriplesMap?.[predicate]?.[i]?.joinCondition ?? [];
                      const childrenMatchingCondition = joinConditions.map((joinCondition): string[] => {
                        let firstChild: string;
                        if (Array.isArray(joinCondition.child)) {
                          if (joinCondition.child.length !== 1) {
                            console.warn(
                              `joinCoinConditionitions child must return only one value! Child: ${joinCondition.child}`,
                            );
                          }
                          firstChild = joinCondition.child[0];
                        } else {
                          firstChild = joinCondition.child;
                        }

                        const matchingChildren = cache[joinCondition.parentPath][firstChild];
                        return matchingChildren || [];
                      });

                      const childrenMatchingAllCondition = intersection(childrenMatchingCondition);
                      for (const child of childrenMatchingAllCondition) {
                        addToObjAsReference(entry, predicate, child);
                      }
                    }
                  } else {
                    for (const tmd of toMapData) {
                      for (const entry of output[key]) {
                        addToObjAsReference(entry, predicate, tmd['@id']!);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return output;
  }

  private async clean(
    outputByMapping: Record<string, jsonld.NodeObject[]>,
  ): Promise<jsonld.NodeObject[]> {
    let output = Object.values(outputByMapping).flat();
    output = removeMetaFromAllNodes(output);
    output = removeEmptyFromAllNodes(output);
    convertRdfTypeToJsonldType(output);

    if (this.options?.replace) {
      output = replaceReferences(output);
    }

    if (this.options?.compact) {
      const compacted = await jsonld.compact(output, this.options.compact);
      const context = compacted['@context'];
      const graph = compacted['@graph'];
      if (graph && Array.isArray(graph)) {
        (context as jsonld.ContextDefinition)['@language'] = this.options.language;
        graph.forEach((nodeObject: jsonld.NodeObject): void => {
          nodeObject['@context'] = context;
        });
        return graph;
      }
      (compacted['@context'] as jsonld.ContextDefinition)['@language'] = this.options.language;
      return [ compacted ];
    }

    if (this.options?.language) {
      output.forEach((subOutput: Record<string, any>): void => {
        subOutput['@context'] = { '@language': this.options.language };
      });
    }

    return Array.isArray(output) ? output : [ output ];
  }
}

export async function parseTurtle(
  mapping: string,
  inputFiles: Record<string, string>,
  options: ParseOptions = {},
): Promise<string | jsonld.NodeObject[]> {
  const rmlMapper = new RmlMapper({ ...options, inputFiles });
  return await rmlMapper.parseTurtle(mapping);
}

export async function parseJsonLd(
  mapping: NodeObject,
  inputFiles: Record<string, string>,
  options: ParseOptions = {},
): Promise<string | jsonld.NodeObject[]> {
  const rmlMapper = new RmlMapper({ ...options, inputFiles });
  return await rmlMapper.parseJsonLd(mapping);
}

/**
 * @deprecated The method should not be used. Please use parseTurtle or parseJsonLd instead.
 */
export async function parse(
  mapping: string,
  inputFiles: Record<string, string>,
  options: ParseOptions = {},
): Promise<string | jsonld.NodeObject[]> {
  return parseTurtle(mapping, inputFiles, options);
}
