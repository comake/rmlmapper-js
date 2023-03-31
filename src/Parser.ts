/* eslint-disable
  unicorn/prefer-object-has-own,
  @typescript-eslint/naming-convention,
  no-console
*/
import * as jsonld from 'jsonld';
import type { NodeObject } from 'jsonld';
import replaceHelper, { jsonLDGraphToObj } from './helper/replace';
import helper from './input-parser/helper';
import { getTopLevelMappings, replaceConstantShortProps, ttlToJson } from './mapfile/mapfileParser';
import type { ParsedMappingResult } from './MappingProcessor';
import { MappingProcessor } from './MappingProcessor';
import { addArray } from './util/ArrayUtil';
import {
  findObjectWithIdInArray,
  removeMetaFromAllNodes,
  removeEmptyFromAllNodes,
  convertRdfTypeToJsonldType,
  getValueIfDefined,
  getIdFromNodeObjectIfDefined,
} from './util/ObjectUtil';
import type { LogicalSource, ParseOptions, ProcessOptions, ReferenceNodeObject } from './util/Types';
import { RML, RR } from './util/Vocabulary';

export class RmlMapper {
  private readonly sourceCache = {};
  private readonly options: ProcessOptions;
  private readonly topLevelMappingProcessors: Record<string, MappingProcessor> = {};

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

  private async processMapping(mapping: NodeObject): Promise<Record<string, jsonld.NodeObject[]>> {
    const graph = mapping['@graph'];
    replaceConstantShortProps(graph);
    const connectedGraph = jsonLDGraphToObj(graph);
    const topLevelMappings = getTopLevelMappings(connectedGraph);
    const output: Record<string, ParsedMappingResult[]> = {};
    for (const mappingId of topLevelMappings) {
      const topLevelMapping = findObjectWithIdInArray(connectedGraph, mappingId);
      if (topLevelMapping) {
        this.topLevelMappingProcessors[mappingId] = this.createProcessorForMapping(connectedGraph, topLevelMapping);
      }
    }

    for (const [ mappingId, proccessor ] of Object.entries(this.topLevelMappingProcessors)) {
      if (proccessor.hasProcessed()) {
        output[mappingId] = proccessor.getReturnValue();
      } else {
        output[mappingId] = await proccessor.processMapping(this.topLevelMappingProcessors);
      }
    }
    return this.mergeJoin(output, connectedGraph);
  }

  private createProcessorForMapping(
    data: any[],
    mapping: any,
  ): MappingProcessor {
    const logicalSource = findObjectWithIdInArray(
      data,
      mapping[RML.logicalSource]['@id'],
    ) as unknown as LogicalSource;
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
    return getIdFromNodeObjectIfDefined(logicalSource[RML.referenceFormulation])!;
  }

  private getSourceFromLogicalSource(logicalSource: LogicalSource): string {
    return getValueIfDefined(logicalSource[RML.source]) as string;
  }

  private getIteratorFromLogicalSource(logicalSource: LogicalSource, referenceFormulation: string): string {
    if (referenceFormulation === 'CSV') {
      return '$';
    }
    return getValueIfDefined(logicalSource[RML.iterator]) as string;
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
                    const cache: Record<string, any> = {};
                    singleJoin.joinCondition.forEach(({ parentPath }: Record<string, any>): void => {
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
                          cache[parentPath][firstParentData].push(tmd['@id']);
                        }
                      }
                    });

                    for (const entry of output[key]) {
                      const joinConditions = entry.$parentTriplesMap?.[predicate]?.[i]?.joinCondition ?? [];
                      const childrenMatchingCondition = joinConditions.map((cond: any): any => {
                        let childData = cond.child;
                        childData = addArray(childData);
                        if (childData.length !== 1) {
                          console.warn(`joinConditions child must return only one value! Child: ${childData}`);
                        }
                        childData = childData[0];

                        const matchingChildren = cache[cond.parentPath][childData];
                        return matchingChildren || [];
                      });

                      const childrenMatchingAllCondition = helper.intersection(childrenMatchingCondition);

                      for (const child of childrenMatchingAllCondition) {
                        helper.addToObjInId(entry, predicate, child);
                      }
                    }
                  } else {
                    for (const tmd of toMapData) {
                      for (const entry of output[key]) {
                        helper.addToObjInId(entry, predicate, tmd['@id']);
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
      output = replaceHelper.replace(output);
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
