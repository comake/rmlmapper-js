/* eslint-disable unicorn/expiring-todo-comments */
/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeObject } from 'jsonld';
import tags from 'language-tags';
import { FunctionExecutor } from './FunctionExecutor';
import { CsvParser } from './input-parser/CsvParser';
import { FontoxpathParser } from './input-parser/FontoxpathParser';
import helper from './input-parser/helper';
import { JsonParser } from './input-parser/JsonParser';
import type { SourceParser } from './input-parser/SourceParser';
import { XmlParser } from './input-parser/XmlParser';
import { CsvSourceReader } from './source-reader/CsvSourceReader';
import { FontoxpathSourceReader } from './source-reader/FontoxpathSourceReader';
import { JsonSourceReader } from './source-reader/JsonSourceReader';
import { XmlSourceReader } from './source-reader/XmlSourceReader';
import { addArray, cutArray } from './util/ArrayUtil';
import { getIdFromNodeObjectIfDefined, getValueIfDefined } from './util/ObjectUtil';
import type {
  FunctionValuedClass,
  ObjectMap,
  PredicateObjectMap,
  ProcessOptions,
  ReferenceNodeObject,
  TermMap,
  TriplesMap,
} from './util/Types';
import { FNML, QL, RDF, RML, RR } from './util/Vocabulary';

export interface ParsedParentTriplesMap {
  mapID: string;
  joinCondition: { parentPath: string; child: any[] }[];
}

export type ParsedMappingResult = (NodeObject & {
  $parentPaths?: Record<string, string[]>;
  $parentTriplesMap?: Record<string, ParsedParentTriplesMap[]>;
});

export interface MappingProcessorArgs {
  referenceFormulation: string;
  options: ProcessOptions;
  sourceCache: Record<string, any>;
  iterator: string;
  source: string;
  mapping: TriplesMap;
  data: any[];
}

export class MappingProcessor {
  private readonly sourceParser: SourceParser;
  private readonly functionExecutor: FunctionExecutor;
  private readonly mapping: TriplesMap;
  private readonly data: any[];
  private count = 0;
  private processed = false;
  private returnValue: any;

  public constructor(args: MappingProcessorArgs) {
    this.mapping = args.mapping;
    this.data = args.data;
    switch (args.referenceFormulation) {
      case QL.XPath: {
        if (args.options.xpathLib === 'fontoxpath') {
          const reader = new FontoxpathSourceReader(args.sourceCache, args.options);
          const source = reader.readSourceWithCache(args.source);
          this.sourceParser = new FontoxpathParser({ source, iterator: args.iterator, options: args.options });
        } else {
          const reader = new XmlSourceReader(args.sourceCache, args.options);
          const source = reader.readSourceWithCache(args.source);
          this.sourceParser = new XmlParser({ source, iterator: args.iterator, options: args.options });
        }
        break;
      } case QL.JSONPath: {
        const reader = new JsonSourceReader(args.sourceCache, args.options);
        const source = reader.readSourceWithCache(args.source);
        this.sourceParser = new JsonParser({ source, iterator: args.iterator, options: args.options });
        break;
      } case QL.CSV: {
        const reader = new CsvSourceReader(args.sourceCache, args.options);
        const source = reader.readSourceWithCache(args.source);
        this.sourceParser = new CsvParser({ source, iterator: args.iterator, options: args.options });
        break;
      } default:
        throw new Error(`Cannot process: ${args.referenceFormulation}`);
    }

    this.functionExecutor = new FunctionExecutor({
      parser: this.sourceParser,
      functions: args.options.functions,
    });
  }

  public hasProcessed(): boolean {
    return this.processed;
  }

  public getReturnValue(): any {
    return this.returnValue;
  }

  public async processMapping(
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<ParsedMappingResult[]> {
    const { [RR.subjectMap]: subjectMap } = this.mapping;
    const iteratorNumber = this.sourceParser.getCount();
    const parents = [];
    for (const nodeObject of this.data) {
      const { [RR.joinCondition]: joinCondition, [RR.parentTriplesMap]: parentTriplesMap } = nodeObject;
      if (parentTriplesMap?.['@id'] === this.mapping['@id'] && joinCondition) {
        const parentPaths = addArray(joinCondition).map(({ [RR.parent]: parent }): string => parent);
        parents.push(...parentPaths);
      }
    }

    if (!subjectMap || Array.isArray(subjectMap)) {
      throw new Error('Exactly one subjectMap needed');
    }

    let type;
    if (subjectMap[RR.class]) {
      if (Array.isArray(subjectMap[RR.class])) {
        type = (subjectMap[RR.class] as ReferenceNodeObject[]).map((sm: ReferenceNodeObject): string => sm['@id']);
      } else {
        type = (subjectMap[RR.class] as ReferenceNodeObject)['@id'];
      }
    }
    const subjectFunctionValue = (subjectMap[RR.class] as FunctionValuedClass)?.[FNML.functionValue];

    const result = [];
    if (RML.reference in subjectMap) {
      for (let i = 0; i < iteratorNumber; i++) {
        if (subjectFunctionValue) {
          type = await this.functionExecutor.executeFunctionFromValue(
            subjectFunctionValue,
            i,
            topLevelMappingProcessors,
          );
        }
        let obj: ParsedMappingResult = {};
        this.count += 1;
        let nodes = this.sourceParser.getData(i, getValueIfDefined(subjectMap[RML.reference]) as string);
        nodes = addArray(nodes);
        // Needs to be done in sequence, since result.push() is done.
        // for await ()  is bad practice when we use it with something other than an asynchronous iterator - https://stackoverflow.com/questions/59694309/for-await-of-vs-promise-all
        for (const temp of nodes) {
          if (type) {
            obj['@type'] = type;
          }
          if (!temp.includes(' ')) {
            obj['@id'] = temp;
            obj = await this.doObjectMappings(i, obj, topLevelMappingProcessors);

            if (!obj['@id']) {
              obj['@id'] = `${this.mapping['@id']}_${this.count}`;
            }
            this.writeParentPath(i, parents, obj);
            result.push(obj);
          }
        }
      }
    } else if (RR.template in subjectMap) {
      this.count += 1;
      for (let i = 0; i < iteratorNumber; i++) {
        if (subjectFunctionValue) {
          type = await this.functionExecutor.executeFunctionFromValue(
            subjectFunctionValue,
            i,
            topLevelMappingProcessors,
          );
        }
        let obj: ParsedMappingResult = {};
        const ids = this.calculateTemplate(i, getValueIfDefined(subjectMap[RR.template]) as string);
        for (let id of ids) {
          if (subjectMap[RR.termType]) {
            const termType = getIdFromNodeObjectIfDefined(subjectMap[RR.termType]);
            switch (termType) {
              case RR.BlankNode:
                id = `_:${id}`;
                break;
              case RR.IRI:
                if (
                  (!subjectMap[RR.template] && !subjectMap[RML.reference]) ||
                  (subjectMap[RR.template] && subjectMap[RML.reference])
                ) {
                  throw new Error('Must use exactly one of - rr:template and rml:reference in SubjectMap!');
                }
                // TODO: needed?
                // if (!helper.isURL(id)) {
                //   id = helper.addBase(id, this.prefixes);
                // }
                break;
              case RR.Literal:
                break;
              default:
                throw new Error(`Don't know: ${getIdFromNodeObjectIfDefined(subjectMap[RR.termType])}`);
            }
          }
          obj['@id'] = id;
          if (type) {
            obj['@type'] = type;
          }
          obj = await this.doObjectMappings(i, obj, topLevelMappingProcessors);
          if (!obj['@id']) {
            obj['@id'] = `${this.mapping['@id']}_${this.count}`;
          }
          this.writeParentPath(i, parents, obj);
          result.push(obj);
        }
      }
    } else if (FNML.functionValue in subjectMap) {
      for (let i = 0; i < iteratorNumber; i++) {
        this.count += 1;
        let obj: ParsedMappingResult = {};
        const subjVal = await this.functionExecutor.executeFunctionFromValue(
          subjectMap[FNML.functionValue]!,
          i,
          topLevelMappingProcessors,
        );
        obj['@id'] = subjVal;
        if (type) {
          obj['@type'] = type;
        }
        obj = await this.doObjectMappings(i, obj, topLevelMappingProcessors);
        this.writeParentPath(i, parents, obj);
        result.push(obj);
      }
    } else if (RR.constant in subjectMap || getIdFromNodeObjectIfDefined(subjectMap[RR.termType]) === RR.BlankNode) {
      // BlankNode with no template or id
      for (let i = 0; i < iteratorNumber; i++) {
        if (subjectFunctionValue) {
          type = await this.functionExecutor.executeFunctionFromValue(
            subjectFunctionValue,
            i,
            topLevelMappingProcessors,
          );
        }
        this.count += 1;
        let obj: ParsedMappingResult = {};
        if (RR.constant in subjectMap) {
          obj['@id'] = helper.getConstant(subjectMap[RR.constant]);
        }
        if (type) {
          obj['@type'] = type;
        }
        obj = await this.doObjectMappings(i, obj, topLevelMappingProcessors);
        if (!obj['@id']) {
          obj['@id'] = `_:${encodeURIComponent(`${this.mapping['@id']}_${this.count}`)}`;
        }
        this.writeParentPath(i, parents, obj);
        result.push(obj);
      }
    } else {
      throw new Error('Unsupported subjectmap');
    }

    // TODO: wtf is this...
    // const firstResult = cutArray(result);
    // const nonSingleValueArrayResult = Array.isArray(firstResult) && firstResult.length === 1
    //   ? firstResult[0]
    //   : firstResult;
    this.processed = true;
    this.returnValue = result;
    return result;
  }

  private writeParentPath(index: number, parents: string[], obj: Record<string, any>): void {
    if (!obj.$parentPaths && parents.length > 0) {
      obj.$parentPaths = {};
    }
    for (const parent of parents) {
      if (!obj.$parentPaths[parent]) {
        obj.$parentPaths[parent] = this.sourceParser.getData(index, parent);
      }
    }
  }

  private async doObjectMappings(
    index: number,
    obj: Record<string, any>,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<any> {
    if (this.mapping[RR.predicateObjectMap]) {
      let objectMapArray = this.mapping[RR.predicateObjectMap];
      objectMapArray = addArray(objectMapArray);
      for (const mapping of objectMapArray) {
        const predicate = helper.getPredicate(mapping);
        if (Array.isArray(predicate)) {
          for (const predicateItem of predicate) {
            await this.handleSingleMapping(index, obj, mapping, predicateItem, topLevelMappingProcessors);
          }
        } else {
          await this.handleSingleMapping(index, obj, mapping, predicate, topLevelMappingProcessors);
        }
      }
    }
    return cutArray(obj);
  }

  private async handleSingleMapping(
    index: number,
    obj: Record<string, any>,
    mapping: PredicateObjectMap,
    predicate: string,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<void> {
    let objects: ReferenceNodeObject[] | undefined;
    if (RR.object in mapping) {
      if (Array.isArray(mapping[RR.object])) {
        objects = mapping[RR.object] as ReferenceNodeObject[];
      } else {
        objects = [ mapping[RR.object] as ReferenceNodeObject ];
      }
    }
    let objectmaps: ObjectMap[] | undefined;
    if (RR.objectMap in mapping) {
      if (Array.isArray(mapping[RR.objectMap])) {
        objectmaps = mapping[RR.objectMap] as ObjectMap[];
      } else {
        objectmaps = [ mapping[RR.objectMap] as ObjectMap ];
      }
    }

    if (objects) {
      helper.addToObj(obj, predicate, objects);
    } else if (objectmaps) {
      await Promise.all(
        objectmaps.map(async(objectmap): Promise<void> => {
          const {
            [FNML.functionValue]: functionValue,
            [RR.parentTriplesMap]: parentTriplesMap,
            [RR.joinCondition]: joinCondition,
            [RML.reference]: reference,
            [RR.template]: template,
            [RML.languageMap]: languageMap,
            [RR.datatype]: datatype,
            [RR.termType]: termType,
            [RR.language]: language,
            [RR.constant]: constant,
          } = objectmap;

          let languageString: string | undefined;
          if (languageMap) {
            languageString = this.useLanguageMap(index, languageMap);
          } else if (language) {
            languageString = getValueIfDefined(language) as string;
          }

          if (languageString && !tags(languageString).valid()) {
            throw new Error(`Language tag: ${languageString} invalid!`);
          }

          const templateValue = getValueIfDefined(template) as string;
          const termTypeValue = getIdFromNodeObjectIfDefined(termType);
          const referenceValue = getValueIfDefined(reference) as string;
          const datatypeValue = getIdFromNodeObjectIfDefined(datatype);

          if (template) {
            // We have a template definition
            const temp = this.calculateTemplate(index, templateValue, termTypeValue);
            temp.forEach((te: string): void => {
              let teRef: ReferenceNodeObject | string;
              if (termTypeValue) {
                switch (termTypeValue) {
                  case RR.BlankNode:
                    teRef = { '@id': `_:${te}` };
                    break;
                  case RR.IRI:
                    teRef = { '@id': te };
                    break;
                  case RR.Literal:
                    teRef = te;
                    break;
                  default:
                    throw new Error(`Don't know: ${termTypeValue}`);
                }
              } else {
                teRef = { '@id': te };
              }
              helper.setObjPredicate(obj, predicate, cutArray(teRef), languageString, datatype);
            });
          } else if (reference) {
            // We have a reference definition
            let ns = this.sourceParser.getData(index, referenceValue, datatypeValue);
            let arr: any[] = [];
            ns = addArray(ns);
            ns.forEach((en): void => {
              arr.push(en);
            });
            if (termTypeValue === RR.IRI) {
              arr = arr.map((val): ReferenceNodeObject => ({ '@id': val }));
            }
            if (arr?.length > 0) {
              helper.setObjPredicate(obj, predicate, cutArray(arr), languageString, datatype);
            }
          } else if (constant) {
            const nonArrayConstantValue = cutArray(constant);
            const singularConstantValue = helper.getConstant(nonArrayConstantValue);
            if (predicate !== RDF.type && termTypeValue === RR.IRI) {
              helper.setObjPredicate(obj, predicate, { '@id': singularConstantValue }, languageString, datatype);
            } else {
              helper.setObjPredicate(obj, predicate, singularConstantValue, languageString, datatype);
            }
          } else if (parentTriplesMap?.['@id']) {
            if (!obj.$parentTriplesMap) {
              obj.$parentTriplesMap = {};
            }
            if (joinCondition) {
              const joinConditions = addArray(joinCondition);

              if (!obj.$parentTriplesMap[predicate]) {
                obj.$parentTriplesMap[predicate] = [];
              }
              obj.$parentTriplesMap[predicate].push({
                joinCondition: joinConditions.map((cond): any => ({
                  parentPath: getValueIfDefined(cond[RR.parent]) as string,
                  child: this.sourceParser.getData(index, getValueIfDefined(cond[RR.child]) as string),
                })),
                mapID: objectmap['@id'],
              });
            } else if (obj.$parentTriplesMap[predicate]) {
              obj.$parentTriplesMap[predicate].push({
                mapID: objectmap['@id'],
              });
            } else {
              obj.$parentTriplesMap[predicate] = [];
              obj.$parentTriplesMap[predicate].push({
                mapID: objectmap['@id'],
              });
            }
          } else if (functionValue) {
            const result = await this.functionExecutor.executeFunctionFromValue(
              functionValue,
              index,
              topLevelMappingProcessors,
            );
            helper.setObjPredicate(obj, predicate, result, languageString, datatype);
          }
        }),
      );
    }
  }

  private calculateTemplate(index: number, template: string, termType?: string): string[] {
    const openBracketIndicies = helper.locations('{', template);
    const closedBracketIndicies = helper.locations('}', template);
    const words: string[] = [];
    const toInsert: any[][] = [];
    const templates: string[] = [];
    if (openBracketIndicies.length === 0 || openBracketIndicies.length !== closedBracketIndicies.length) {
      return [ template ];
    }
    openBracketIndicies.forEach((beginningValue: number, idx: number): void => {
      words.push(template.slice(beginningValue + 1, closedBracketIndicies[idx]));
    });
    words.forEach((word): void => {
      const temp = addArray(this.sourceParser.getData(index, word));
      toInsert.push(temp);
    });
    const allCombinations = helper.allPossibleCases(toInsert) as string[][];
    allCombinations.forEach((combinination: any, idxA: number): void => {
      let finTemp = template;
      combinination.forEach((word: string, idxB: number): void => {
        if (!termType || termType !== RR.Literal) {
          allCombinations[idxA][idxB] = helper.toURIComponent(allCombinations[idxA][idxB]);
        }
        finTemp = finTemp.replace(`{${words[idxB]}}`, allCombinations[idxA][idxB]);
      });
      if (finTemp.length > 0) {
        templates.push(finTemp);
      }
    });
    templates.forEach((thisTemplate: string, idx: number): void => {
      templates[idx] = helper.replaceEscapedChar(thisTemplate);
    });
    return templates;
  }

  private useLanguageMap(index: number, termMap: TermMap): string {
    if (termMap[RR.constant]) {
      return helper.getConstant(termMap[RR.constant]);
    }
    if (termMap[RML.reference]) {
      const vals = this.sourceParser.getData(index, getValueIfDefined(termMap[RML.reference]) as string);
      return addArray(vals)[0];
    }
    if (termMap[RR.template]) {
      const temp = this.calculateTemplate(index, getValueIfDefined(termMap[RR.template]) as string);
      return addArray(temp)[0];
    }
    throw new Error('TermMap has neither constant, reference or template');
  }
}
