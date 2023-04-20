/* eslint-disable unicorn/expiring-todo-comments */
/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeObject } from 'jsonld';
import tags from 'language-tags';
import { FunctionExecutor } from './FunctionExecutor';
import { CsvParser } from './input-parser/CsvParser';
import { FontoxpathParser } from './input-parser/FontoxpathParser';
import helper from './input-parser/helper';
import { JsonParser } from './input-parser/JsonParser';
import type { SourceParser, SourceParserArgs } from './input-parser/SourceParser';
import { XmlParser } from './input-parser/XmlParser';
import { addArray, cutArray } from './util/ArrayUtil';
import {
  getIdFromNodeObjectIfDefined,
  getValue,
  getConstant,
  getPredicateValueFromPredicateObjectMap,
} from './util/ObjectUtil';
import type {
  FunctionValue,
  FunctionValuedClass,
  JoinCondition,
  ObjectMap,
  OrArray,
  PredicateObjectMap,
  ProcessOptions,
  ReferenceNodeObject,
  SubjectMap,
  TermMap,
  TriplesMap,
} from './util/Types';
import { toURIComponent, unescapeCurlyBrackets } from './util/UriUtil';
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
  data: NodeObject[];
}

export class MappingProcessor {
  private readonly sourceParser: SourceParser<any>;
  private readonly functionExecutor: FunctionExecutor;
  private readonly mapping: TriplesMap;
  private readonly data: NodeObject[];
  private processed = false;
  private returnValue: any;

  public constructor(args: MappingProcessorArgs) {
    this.mapping = args.mapping;
    this.data = args.data;
    this.sourceParser = this.createSourceParser(args);
    this.functionExecutor = new FunctionExecutor({
      parser: this.sourceParser,
      functions: args.options.functions,
    });
  }

  private createSourceParser(args: MappingProcessorArgs): SourceParser<any> {
    const sourceParserArgs: SourceParserArgs = {
      source: args.source,
      sourceCache: args.sourceCache,
      iterator: args.iterator,
      options: args.options,
    };
    switch (args.referenceFormulation) {
      case QL.XPath:
        if (args.options.xpathLib === 'fontoxpath') {
          return new FontoxpathParser(sourceParserArgs);
        }
        return new XmlParser(sourceParserArgs);
      case QL.JSONPath:
        return new JsonParser(sourceParserArgs);
      case QL.CSV:
        return new CsvParser(sourceParserArgs);
      default:
        throw new Error(`Cannot process: ${args.referenceFormulation}`);
    }
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
    const parentPaths = this.getParentPaths();

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

    let result = [];
    if (RML.reference in subjectMap) {
      result = await this.processMappingWithSubjectMap(
        subjectMap,
        topLevelMappingProcessors,
        iteratorNumber,
        parentPaths,
        subjectFunctionValue,
        type,
      );
    } else if (RR.template in subjectMap) {
      result = await this.processMappingWithTemplate(
        subjectMap,
        topLevelMappingProcessors,
        iteratorNumber,
        parentPaths,
        subjectFunctionValue,
        type,
      );
    } else if (FNML.functionValue in subjectMap) {
      result = await this.processMappingWithFunctionValue(
        subjectMap,
        topLevelMappingProcessors,
        iteratorNumber,
        parentPaths,
        subjectFunctionValue,
        type,
      );
    } else if (RR.constant in subjectMap || getIdFromNodeObjectIfDefined(subjectMap[RR.termType]) === RR.BlankNode) {
      result = await this.processMappingWithConstantOrTermType(
        subjectMap,
        topLevelMappingProcessors,
        iteratorNumber,
        parentPaths,
        subjectFunctionValue,
        type,
      );
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

  private getParentPaths(): string[] {
    return this.data.reduce((arr: string[], nodeObject: NodeObject): string[] => {
      const {
        [RR.joinCondition]: joinCondition,
        [RR.parentTriplesMap]: parentTriplesMap,
      } = nodeObject;

      if (parentTriplesMap) {
        const parentTriplesMapId = getIdFromNodeObjectIfDefined(parentTriplesMap as ReferenceNodeObject);
        const parentTriplesMapIsThisMapping = parentTriplesMapId === this.mapping['@id'];
        if (parentTriplesMapIsThisMapping && joinCondition) {
          const parentPaths = addArray<JoinCondition>(joinCondition as unknown as OrArray<JoinCondition>)
            .map((joinConditionItem): string => getValue<string>(joinConditionItem[RR.parent]));
          return [ ...arr, ...parentPaths ];
        }
      }
      return arr;
    }, []);
  }

  private async processMappingWithSubjectMap(
    subjectMap: SubjectMap,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
    iteratorNumber: number,
    parentPaths: string[],
    subjectFunctionValue?: FunctionValue,
    type?: OrArray<string>,
  ): Promise<any[]> {
    const results: any[] = [];
    for (let i = 0; i < iteratorNumber; i++) {
      if (subjectFunctionValue) {
        type = await this.functionExecutor.executeFunctionFromValue(
          subjectFunctionValue,
          i,
          topLevelMappingProcessors,
        );
      }
      let obj: ParsedMappingResult = {};
      let nodes = this.sourceParser.getData(i, getValue<string>(subjectMap[RML.reference]!));
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
            obj['@id'] = `${this.mapping['@id']}_${i + 1}`;
          }
          this.writeParentPath(i, parentPaths, obj);
          results.push(obj);
        }
      }
    }
    return results;
  }

  private async processMappingWithTemplate(
    subjectMap: SubjectMap,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
    iteratorNumber: number,
    parentPaths: string[],
    subjectFunctionValue?: FunctionValue,
    type?: OrArray<string>,
  ): Promise<any[]> {
    const results: any[] = [];
    for (let i = 0; i < iteratorNumber; i++) {
      if (subjectFunctionValue) {
        type = await this.functionExecutor.executeFunctionFromValue(
          subjectFunctionValue,
          i,
          topLevelMappingProcessors,
        );
      }
      let obj: ParsedMappingResult = {};
      const ids = this.calculateTemplate(i, getValue<string>(subjectMap[RR.template]!));
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
          obj['@id'] = `${this.mapping['@id']}_1`;
        }
        this.writeParentPath(i, parentPaths, obj);
        results.push(obj);
      }
    }
    return results;
  }

  private async processMappingWithFunctionValue(
    subjectMap: SubjectMap,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
    iteratorNumber: number,
    parentPaths: string[],
    subjectFunctionValue?: FunctionValue,
    type?: OrArray<string>,
  ): Promise<any[]> {
    const results: any[] = [];
    for (let i = 0; i < iteratorNumber; i++) {
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
      this.writeParentPath(i, parentPaths, obj);
      results.push(obj);
    }
    return results;
  }

  private async processMappingWithConstantOrTermType(
    subjectMap: SubjectMap,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
    iteratorNumber: number,
    parentPaths: string[],
    subjectFunctionValue?: FunctionValue,
    type?: OrArray<string>,
  ): Promise<any[]> {
    const results: any[] = [];
    // BlankNode with no template or id
    for (let i = 0; i < iteratorNumber; i++) {
      if (subjectFunctionValue) {
        type = await this.functionExecutor.executeFunctionFromValue(
          subjectFunctionValue,
          i,
          topLevelMappingProcessors,
        );
      }
      let obj: ParsedMappingResult = {};
      if (RR.constant in subjectMap) {
        obj['@id'] = getConstant<string>(subjectMap[RR.constant]!);
      }
      if (type) {
        obj['@type'] = type;
      }
      obj = await this.doObjectMappings(i, obj, topLevelMappingProcessors);
      if (!obj['@id']) {
        obj['@id'] = `_:${encodeURIComponent(`${this.mapping['@id']}_${i + 1}`)}`;
      }
      this.writeParentPath(i, parentPaths, obj);
      results.push(obj);
    }
    return results;
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
        const predicate = getPredicateValueFromPredicateObjectMap(mapping);
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
            languageString = this.getValueOfTermMap(index, languageMap);
          } else if (language) {
            languageString = getValue<string>(language);
          }

          if (languageString && !tags(languageString).valid()) {
            throw new Error(`Language tag: ${languageString} invalid!`);
          }

          const termTypeValue = getIdFromNodeObjectIfDefined(termType);
          const datatypeValue = getIdFromNodeObjectIfDefined(datatype);

          if (template) {
            const templateValue = getValue<string>(template);
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
            const referenceValue = getValue<string>(reference);
            // We have a reference definition
            let ns = this.sourceParser.getData(index, referenceValue, datatypeValue);
            let arr: any[] = [];
            ns = addArray(ns);
            ns.forEach((en: any): void => {
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
            const singularConstantValue = getConstant(nonArrayConstantValue);
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
                  parentPath: getValue<string>(cond[RR.parent]),
                  child: this.sourceParser.getData(index, getValue<string>(cond[RR.child])),
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
          allCombinations[idxA][idxB] = toURIComponent(allCombinations[idxA][idxB]);
        }
        finTemp = finTemp.replace(`{${words[idxB]}}`, allCombinations[idxA][idxB]);
      });
      if (finTemp.length > 0) {
        templates.push(finTemp);
      }
    });
    templates.forEach((thisTemplate: string, idx: number): void => {
      templates[idx] = unescapeCurlyBrackets(thisTemplate);
    });
    return templates;
  }

  private getValueOfTermMap(index: number, termMap: TermMap): string {
    if (RR.constant in termMap) {
      return getConstant<string>(termMap[RR.constant]!);
    }
    if (RML.reference in termMap) {
      const vals = this.sourceParser.getData(index, getValue<string>(termMap[RML.reference]!));
      return addArray(vals)[0];
    }
    if (RR.template in termMap) {
      const temp = this.calculateTemplate(index, getValue<string>(termMap[RR.template]!));
      return addArray(temp)[0];
    }
    throw new Error('TermMap has neither constant, reference or template');
  }
}
