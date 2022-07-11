/* eslint-disable
  @typescript-eslint/no-require-imports,
  @typescript-eslint/no-var-requires,
  unicorn/prefer-object-has-own,
  @typescript-eslint/naming-convention,
  no-console
*/
import * as jsonld from 'jsonld';
const objectHelper = require('./helper/objectHelper');
const prefixhelper = require('./helper/prefixHelper');
const replaceHelper = require('./helper/replace');
const helper = require('./input-parser/helper');
const logicalSource = require('./input-parser/logicalSourceParser');
const parser = require('./input-parser/parser');
const mapfile = require('./mapfile/mapfileParser');

export interface ParseOptions {
  // Jsonld @context for json-ld compress
  compress?: any;
  // Output triples instead of json-ld
  toRDF?: boolean;
  // Jsonld only: replace @ids with elements
  replace?: boolean;
  // Remove xmlns in xml documents (for easier xPaths)
  removeNameSpace?: Record<string, string>;
  // Xpath evaluator library
  xpathLib?: 'default' | 'xpath' | 'pugixml' | 'fontoxpath';
  // Functions
  functions?: Record<string, (args: any | any[]) => any>;
  // Add no triples for empty strings
  ignoreEmptyStrings?: boolean;
  // Ignore values from the input
  ignoreValues?: string[];
  // CSV options
  csv?: {
    delimiter?: string;
  };
  // ???
  xmlPerformanceMode?: boolean;
}

interface ProcessOptions extends ParseOptions {
  inputFiles: Record<string, string>;
}

interface ProcessOptionsWithMetadata extends ProcessOptions {
  $metadata: {
    inputFiles: Record<string, string>;
  };
}

interface Res {
  prefixes: Record<string, string>;
  data: jsonld.NodeObject;
  topLevelMappings: string[];
}

function mergeJoin(output: Record<string, any>, res: Res, options: ProcessOptions): Record<string, any> {
  helper.consoleLogIf('Perform joins..', options);
  for (const key in output) {
    if (Object.prototype.hasOwnProperty.call(output, key)) {
      output[key] = helper.addArray(output[key]);
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
                let parentId = prefixhelper.checkAndRemovePrefixesFromObject(
                  objectHelper.findIdinObjArr(res.data, singleJoin.mapID, res.prefixes), res.prefixes,
                );
                parentId = parentId.parentTriplesMap['@id'];

                const toMapData = helper.addArray(output[parentId]);

                if (singleJoin.joinCondition) {
                  const cache: Record<string, any> = {};
                  singleJoin.joinCondition.forEach(({ parentPath }: Record<string, any>): void => {
                    cache[parentPath] = {};
                    for (const tmd of toMapData) {
                      let parentData = tmd.$parentPaths[parentPath];
                      parentData = helper.addArray(parentData);
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
                      childData = helper.addArray(childData);
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

export async function process(res: Res, options: ProcessOptions): Promise<any> {
  let output: Record<string, any> = {};
  const optionsWithMetadata = helper.createMeta(options) as ProcessOptionsWithMetadata;
  for (const id of res.topLevelMappings) {
    let obj = objectHelper.findIdinObjArr(res.data, id, res.prefixes);
    obj = prefixhelper.checkAndRemovePrefixesFromObject(obj, res.prefixes);
    const source = logicalSource.parseLogicalSource(res.data, res.prefixes, obj.logicalSource['@id']);
    switch (source.referenceFormulation) {
      case 'XPath': {
        helper.consoleLogIf('Processing with XPath', optionsWithMetadata);
        let resultXML = await parser.parseFile(
          res.data, obj, res.prefixes, source.source, source.iterator, optionsWithMetadata, 'XPath',
        );
        resultXML = resultXML.length === 1 ? resultXML[0] : resultXML;
        output[id] = resultXML;
        optionsWithMetadata.$metadata.inputFiles[id] = source.source;
        helper.consoleLogIf('Done', optionsWithMetadata);
        break;
      }
      case 'JSONPath': {
        helper.consoleLogIf('Processing with JSONPath', optionsWithMetadata);
        let resultJSON = await parser.parseFile(
          res.data, obj, res.prefixes, source.source, source.iterator, optionsWithMetadata, 'JSONPath',
        );
        resultJSON = resultJSON.length === 1 ? resultJSON[0] : resultJSON;
        output[id] = resultJSON;
        optionsWithMetadata.$metadata.inputFiles[id] = source.source;
        helper.consoleLogIf('Done', optionsWithMetadata);
        break;
      }
      case 'CSV': {
        helper.consoleLogIf('Processing with CSV', optionsWithMetadata);
        let resultCSV = await parser.parseFile(
          res.data, obj, res.prefixes, source.source, source.iterator, optionsWithMetadata, 'CSV',
        );
        resultCSV = resultCSV.length === 1 ? resultCSV[0] : resultCSV;
        output[id] = resultCSV;
        optionsWithMetadata.$metadata.inputFiles[id] = source.source;
        helper.consoleLogIf('Done', optionsWithMetadata);
        break;
      }
      default:
        throw new Error(`Error during processing logicalsource: ${source.referenceFormulation} not supported!`);
    }
  }
  output = mergeJoin(output, res, optionsWithMetadata);
  return output;
}

export async function clean(output: any, options: any): Promise<any> {
  output = objectHelper.removeMeta(output);
  objectHelper.removeEmpty(output);

  objectHelper.convertRdfTypeToJsonldType(output);

  if (options?.replace && options.replace === true) {
    helper.consoleLogIf('Replacing BlankNodes..', options);
    output = replaceHelper.replace(output);
  }
  if (options?.compress) {
    const compacted = await jsonld.compact(output, options.compress);
    const context = compacted['@context'];
    const graph = compacted['@graph'];
    if (graph && Array.isArray(graph)) {
      (context as jsonld.ContextDefinition)['@language'] = options.language;
      graph.forEach((nodeObject: jsonld.NodeObject): void => {
        nodeObject['@context'] = context;
      });
      return graph;
    }
    (compacted['@context'] as jsonld.ContextDefinition)['@language'] = options.language;
    return compacted;
  }
  if (options?.language) {
    if (Array.isArray(output)) {
      output.forEach((subOutput: Record<string, any>): void => {
        subOutput['@context'] = { '@language': options.language };
      });
    } else {
      output['@context'] = {
        '@language': options.language,
      };
    }
  }
  helper.consoleLogIf('FINISHED', options);
  return output;
}

export function cleanCache(data: Record<string, any>): void {
  if (data?.cache) {
    delete data.cache;
  }
}

export async function parse(
  mapping: string,
  inputFiles: Record<string, string>,
  options: ParseOptions = {},
): Promise<string | jsonld.NodeObject | jsonld.NodeObject[]> {
  cleanCache(options);
  const res = await mapfile.expandedJsonMap(mapping) as Res;
  const output = await process(res, { ...options, inputFiles });
  const out = await clean(output, options);
  if (options.toRDF) {
    return await jsonld.toRDF(out, { format: 'application/n-quads' }) as unknown as string;
  }
  return out;
}
