/* eslint-disable unicorn/expiring-todo-comments */
/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeObject } from 'jsonld';
import tags, { languages } from 'language-tags';
import { FunctionExecutor } from './FunctionExecutor';
import { CsvParser } from './input-parser/CsvParser';
import { FontoxpathParser } from './input-parser/FontoxpathParser';
import { JsonParser } from './input-parser/JsonParser';
import type { SourceParser, SourceParserArgs } from './input-parser/SourceParser';
import { XmlParser } from './input-parser/XmlParser';
import { addArray, cutArray } from './util/ArrayUtil';
import {
  getIdFromNodeObjectIfDefined,
  getValue,
  getConstant,
  isFunctionValuedSubjectMap,
  setObjPredicate,
  setObjPredicateWithTermType,
  calculateTemplate,
  getValueOfTermMap,
  getPredicateValueFromPredicateObjectMap,
} from './util/ObjectUtil';
import type {
  FunctionValuedClass,
  JoinCondition,
  ObjectMap,
  OrArray,
  PredicateObjectMap,
  ProcessOptions,
  ReferenceNodeObject,
  SubjectMap,
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
    const iteratorNumber = this.sourceParser.getCount();
    const parentPaths = this.getParentPaths();
    const subjectMap = this.getSubjectMapFromMapping();
    const classes = this.getNonFunctionClassFromSubjectMap(subjectMap);
    let result = [];
    if (RML.reference in subjectMap) {
      result = await this.processMappingWithSubjectMap(
        subjectMap,
        topLevelMappingProcessors,
        iteratorNumber,
        parentPaths,
        classes,
      );
    } else if (RR.template in subjectMap) {
      result = await this.processMappingWithTemplate(
        subjectMap,
        topLevelMappingProcessors,
        iteratorNumber,
        parentPaths,
        classes,
      );
    } else if (FNML.functionValue in subjectMap) {
      result = await this.processMappingWithFunctionValue(
        subjectMap,
        topLevelMappingProcessors,
        iteratorNumber,
        parentPaths,
        classes,
      );
    } else if (
      RR.constant in subjectMap ||
      getIdFromNodeObjectIfDefined(subjectMap[RR.termType]) === RR.BlankNode
    ) {
      result = await this.processMappingWithConstantOrTermType(
        subjectMap,
        topLevelMappingProcessors,
        iteratorNumber,
        parentPaths,
        classes,
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

  private getSubjectMapFromMapping(): SubjectMap {
    if (RR.subject in this.mapping) {
      return {
        '@type': RR.SubjectMap,
        [RR.constant]: this.mapping[RR.subject],
      };
    }
    const subjectMap = this.mapping[RR.subjectMap];
    if (subjectMap) {
      if (Array.isArray(subjectMap)) {
        throw new Error('Exactly one subjectMap needed');
      }
      return subjectMap;
    }
    throw new Error(`No subjectMap supplied for mapping ${this.mapping['@id']}`);
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

  private getNonFunctionClassFromSubjectMap(subjectMap: SubjectMap): OrArray<string> | undefined {
    if (subjectMap[RR.class] && !isFunctionValuedSubjectMap(subjectMap)) {
      if (Array.isArray(subjectMap[RR.class])) {
        return (subjectMap[RR.class] as ReferenceNodeObject[]).map((sm: ReferenceNodeObject): string => sm['@id']);
      }
      return (subjectMap[RR.class] as ReferenceNodeObject)['@id'];
    }
  }

  private async processMappingWithSubjectMap(
    subjectMap: SubjectMap,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
    iteratorNumber: number,
    parentPaths: string[],
    type?: OrArray<string>,
  ): Promise<any[]> {
    const subjectFunctionValue = (subjectMap[RR.class] as FunctionValuedClass)?.[FNML.functionValue];
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
    type?: OrArray<string>,
  ): Promise<any[]> {
    const subjectFunctionValue = (subjectMap[RR.class] as FunctionValuedClass)?.[FNML.functionValue];
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
      const template = getValue<string>(subjectMap[RR.template]!);
      const ids = calculateTemplate(template, i, this.sourceParser);
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
              throw new Error(`Invalid rr:termType: ${getIdFromNodeObjectIfDefined(subjectMap[RR.termType])}`);
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
    type?: OrArray<string>,
  ): Promise<any[]> {
    const subjectFunctionValue = (subjectMap[RR.class] as FunctionValuedClass)?.[FNML.functionValue];
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
        obj['@id'] = getConstant<string>(subjectMap[RR.constant]);
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
      const objectMapArray = addArray(this.mapping[RR.predicateObjectMap]);
      for (const mapping of objectMapArray) {
        const predicate = await getPredicateValueFromPredicateObjectMap(
          mapping,
          index,
          topLevelMappingProcessors,
          this.sourceParser,
          this.functionExecutor,
        );
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
    if (RR.object in mapping) {
      if (Array.isArray(mapping[RR.object])) {
        (mapping[RR.object] as ReferenceNodeObject[]).forEach((objectItem): void => {
          setObjPredicate(obj, predicate, objectItem['@id']);
        });
      } else {
        setObjPredicate(obj, predicate, (mapping[RR.object] as ReferenceNodeObject)['@id']);
      }
    } else if (RR.objectMap in mapping) {
      let objectmaps: ObjectMap[] | undefined;
      if (Array.isArray(mapping[RR.objectMap])) {
        objectmaps = mapping[RR.objectMap] as ObjectMap[];
      } else {
        objectmaps = [ mapping[RR.objectMap] as ObjectMap ];
      }
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
            const languageMapResult = await getValueOfTermMap(
              languageMap,
              index,
              this.sourceParser,
              topLevelMappingProcessors,
              this.functionExecutor,
            );
            if (Array.isArray(languageMapResult)) {
              languageString = languageMapResult[0];
            } else {
              languageString = languageMapResult;
            }
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
            const templateResults = calculateTemplate(
              templateValue,
              index,
              this.sourceParser,
              termTypeValue,
            );
            templateResults.forEach((result: string): void => {
              if (termTypeValue) {
                setObjPredicateWithTermType(obj, predicate, result, termTypeValue, languageString, datatype);
              } else {
                const templateReference = { '@id': result };
                setObjPredicate(obj, predicate, templateReference, languageString, datatype);
              }
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
              setObjPredicate(obj, predicate, cutArray(arr), languageString, datatype);
            }
          } else if (constant) {
            const nonArrayConstantValue = cutArray(constant);
            const singularConstantValue = getConstant(nonArrayConstantValue);
            if (predicate !== RDF.type && termTypeValue === RR.IRI) {
              setObjPredicate(obj, predicate, { '@id': singularConstantValue }, languageString, datatype);
            } else {
              setObjPredicate(obj, predicate, singularConstantValue, languageString, datatype);
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
            if (termTypeValue) {
              setObjPredicateWithTermType(obj, predicate, result, termTypeValue, languageString, datatype);
            } else {
              setObjPredicate(obj, predicate, result, languageString, datatype);
            }
          }
        }),
      );
    }
  }
}
