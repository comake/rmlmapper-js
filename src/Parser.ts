/* eslint-disable
  unicorn/prefer-object-has-own,
  @typescript-eslint/naming-convention,
  no-console
*/
import * as jsonld from 'jsonld';
import type { NodeObject } from 'jsonld';
import prefixhelper from './helper/prefixHelper';
import replaceHelper from './helper/replace';
import helper from './input-parser/helper';
import mapfile from './mapfile/mapfileParser';
import { MappingProcessor } from './MappingProcessor';
import { addArray } from './util/ArrayUtil';
import {
  findObjectWithIdInArray,
  removeMetaFromAllNodes,
  removeEmptyFromAllNodes,
  convertRdfTypeToJsonldType,
} from './util/ObjectUtil';
import type { LogicalSource, Prefixes, ParseOptions, ProcessOptions } from './util/Types';

interface Res {
  prefixes: Record<string, string>;
  data: jsonld.NodeObject[];
  topLevelMappings: string[];
}

export class RmlMapper {
  private readonly sourceCache = {};
  private readonly options: ProcessOptions;
  private readonly topLevelMappingProcessors: Record<string, MappingProcessor> = {};

  public constructor(options: ProcessOptions) {
    this.options = options;
  }

  public async parseJsonLd(mapping: NodeObject): Promise<NodeObject[] | string> {
    const res = await mapfile.expandedJsonMapFromJsonLd(mapping) as unknown as Res;
    const output = await this.process(res);
    const out = await this.clean(output);
    if (this.options.toRDF) {
      return await jsonld.toRDF(out, { format: 'application/n-quads' }) as unknown as string;
    }
    return out;
  }

  public async parseTurtle(mapping: string): Promise<NodeObject[] | string> {
    const res = await mapfile.expandedJsonMapFromTurtle(mapping) as unknown as Res;
    const output = await this.process(res);
    const out = await this.clean(output);
    if (this.options.toRDF) {
      return await jsonld.toRDF(out, { format: 'application/n-quads' }) as unknown as string;
    }
    return out;
  }

  private async process(res: Res): Promise<Record<string, jsonld.NodeObject[]>> {
    let output: Record<string, jsonld.NodeObject[]> = {};
    for (const mappingId of res.topLevelMappings) {
      let mapping = findObjectWithIdInArray(res.data, mappingId, res.prefixes);
      if (mapping) {
        mapping = prefixhelper.checkAndRemovePrefixesFromObject(mapping, res.prefixes) as NodeObject;
        this.topLevelMappingProcessors[mappingId] = this.createProcessorForMapping(res, mapping);
      }
    }

    for (const [ mappingId, proccessor ] of Object.entries(this.topLevelMappingProcessors)) {
      if (proccessor.hasProcessed()) {
        output[mappingId] = proccessor.getReturnValue();
      } else {
        output[mappingId] = await proccessor.processMapping(this.topLevelMappingProcessors);
      }
    }
    output = this.mergeJoin(output, res);
    return output;
  }

  private createProcessorForMapping(
    res: Res,
    mapping: any,
  ): MappingProcessor {
    const logicalSource = findObjectWithIdInArray(
      res.data,
      mapping.logicalSource['@id'],
      res.prefixes,
    ) as LogicalSource;
    const referenceFormulation = this.getReferenceFormulationFromLogicalSource(logicalSource, res.prefixes);
    const iterator = this.getIteratorFromLogicalSource(logicalSource, referenceFormulation);
    return new MappingProcessor({
      source: logicalSource.source,
      referenceFormulation,
      options: this.options,
      prefixes: res.prefixes,
      sourceCache: this.sourceCache,
      iterator,
      mapping,
      data: res.data,
    });
  }

  private getReferenceFormulationFromLogicalSource(logicalSource: LogicalSource, prefixes: Prefixes): string {
    switch (typeof logicalSource.referenceFormulation) {
      case 'string':
        return prefixhelper.checkAndRemovePrefixesFromString(logicalSource.referenceFormulation, prefixes);
      case 'object':
        if (logicalSource.referenceFormulation['@id']) {
          return prefixhelper.checkAndRemovePrefixesFromString(logicalSource.referenceFormulation['@id'], prefixes);
        }
        throw new Error('referenceFormulation of logicalSource has no @id field');
      default:
        throw new Error('referenceFormulation of logicalSource has invalid format');
    }
  }

  private getIteratorFromLogicalSource(logicalSource: LogicalSource, referenceFormulation: string): string {
    if (referenceFormulation === 'CSV') {
      return '$';
    }
    return logicalSource.iterator;
  }

  private mergeJoin(
    output: Record<string, any[]>,
    res: Res,
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
              for (const i in predicateData) {
                if (Object.prototype.hasOwnProperty.call(predicateData, i)) {
                  const singleJoin = predicateData[i];
                  const record: Record<string, any> = prefixhelper.checkAndRemovePrefixesFromObject(
                    findObjectWithIdInArray(res.data, singleJoin.mapID, res.prefixes), res.prefixes,
                  );
                  const parentId = record.parentTriplesMap['@id'];
                  const toMapData = addArray(output[parentId]);

                  if (singleJoin.joinCondition) {
                    const cache: Record<string, any> = {};
                    singleJoin.joinCondition.forEach(({ parentPath }: Record<string, any>): void => {
                      cache[parentPath] = {};
                      for (const tmd of toMapData) {
                        let parentData = tmd.$parentPaths[parentPath];
                        parentData = addArray(parentData);
                        if (parentData.length !== 1) {
                          console.warn(`joinConditions parent must return only one value! Parent: ${parentData}`);
                          break;
                        }
                        parentData = parentData[0];
                        if (!cache[parentPath][parentData]) {
                          cache[parentPath][parentData] = [];
                        }
                        cache[parentPath][parentData].push(tmd['@id']);
                      }
                    });

                    for (const entry of output[key]) {
                      const joinConditions = entry.$parentTriplesMap[predicate][i].joinCondition;

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

                      for (const data of childrenMatchingAllCondition) {
                        helper.addToObjInId(entry, predicate, data);
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
