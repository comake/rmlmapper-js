/* eslint-disable @typescript-eslint/naming-convention */
import tags from 'language-tags';
import { FunctionExecutor } from './FunctionExecutor';
import prefixhelper from './helper/prefixHelper';
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
import { addArray } from './util/ArrayUtil';
import type { ProcessOptions, Prefixes, ReferenceNodeObject, TermMap } from './util/Types';
import { RDF, RR } from './util/Vocabulary';

export interface MappingProcessorArgs {
  referenceFormulation: string;
  options: ProcessOptions;
  sourceCache: Record<string, any>;
  prefixes: Prefixes;
  iterator: string;
  source: string;
  mapping: any;
  data: any[];
}

export class MappingProcessor {
  private readonly prefixes: Prefixes;
  private readonly sourceParser: SourceParser;
  private readonly functionExecutor: FunctionExecutor;
  private readonly mapping: any;
  private readonly data: any[];
  private count = 0;
  private processed = false;
  private returnValue: any;

  public constructor(args: MappingProcessorArgs) {
    this.prefixes = args.prefixes;
    this.mapping = args.mapping;
    this.data = args.data;

    switch (args.referenceFormulation) {
      case 'XPath': {
        if (args.options.xpathLib === 'fontoxpath') {
          const reader = new FontoxpathSourceReader(args.sourceCache, args.options);
          const source = reader.readSourceWithCache(args.source);
          this.sourceParser = new FontoxpathParser(source, args.iterator);
        } else {
          const reader = new XmlSourceReader(args.sourceCache, args.options);
          const source = reader.readSourceWithCache(args.source);
          this.sourceParser = new XmlParser(source, args.iterator);
        }
        break;
      } case 'JSONPath': {
        const reader = new JsonSourceReader(args.sourceCache, args.options);
        const source = reader.readSourceWithCache(args.source);
        this.sourceParser = new JsonParser(source, args.iterator);
        break;
      } case 'CSV': {
        const reader = new CsvSourceReader(args.sourceCache, args.options);
        const source = reader.readSourceWithCache(args.source);
        this.sourceParser = new CsvParser(source, args.options);
        break;
      } default:
        throw new Error(`Cannot process: ${args.referenceFormulation}`);
    }

    this.functionExecutor = new FunctionExecutor({
      parser: this.sourceParser,
      options: args.options,
      prefixes: args.prefixes,
    });
  }

  public hasProcessed(): boolean {
    return this.processed;
  }

  public getReturnValue(): any {
    return this.returnValue;
  }

  public async processMapping(topLevelMappingProcessors: Record<string, MappingProcessor>): Promise<any[]> {
    const { subjectMap } = this.mapping;
    const iteratorNumber = this.sourceParser.getCount();
    const parents = [];
    for (const nodeObject of this.data) {
      const { joinCondition, parentTriplesMap } = nodeObject;
      if (parentTriplesMap?.['@id'] === this.mapping['@id'] && joinCondition) {
        const parentPaths = addArray(joinCondition).map(({ parent }): string => parent);
        parents.push(...parentPaths);
      }
    }

    if (!subjectMap || Array.isArray(subjectMap)) {
      throw new Error('Exactly one subjectMap needed');
    }

    let type;
    if (subjectMap.class) {
      if (Array.isArray(subjectMap.class)) {
        type = [];
        subjectMap.class.forEach((sm: ReferenceNodeObject): void => {
          type.push(prefixhelper.replacePrefixWithURL(sm['@id'], this.prefixes));
        });
      } else {
        type = prefixhelper.replacePrefixWithURL(subjectMap.class['@id'], this.prefixes);
      }
    }
    const functionClassMap = subjectMap.class?.functionValue ? subjectMap.class : undefined;

    let result = [];
    if (subjectMap.reference) {
      for (let i = 0; i < iteratorNumber; i++) {
        if (functionClassMap) {
          type = await this.functionExecutor.executeFunctionFromValue(
            functionClassMap.functionValue,
            i,
            topLevelMappingProcessors,
          );
        }
        let obj: Record<string, any> = {};
        this.count += 1;
        let nodes = this.functionExecutor.getDataFromParser(i, subjectMap.reference);
        nodes = addArray(nodes);
        // Needs to be done in sequence, since result.push() is done.
        // for await ()  is bad practice when we use it with something other than an asynchronous iterator - https://stackoverflow.com/questions/59694309/for-await-of-vs-promise-all
        for (let temp of nodes) {
          if (type) {
            obj['@type'] = type;
          }
          temp = helper.isURL(temp) ? temp : helper.addBase(temp, this.prefixes);
          if (temp.includes(' ')) {
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
    } else if (subjectMap.template) {
      this.count += 1;
      for (let i = 0; i < iteratorNumber; i++) {
        if (functionClassMap) {
          type = await this.functionExecutor.executeFunctionFromValue(
            functionClassMap.functionValue,
            i,
            topLevelMappingProcessors,
          );
        }
        let obj: Record<string, any> = {};
        const ids = this.calculateTemplate(i, subjectMap.template);
        for (let id of ids) {
          if (subjectMap.termType) {
            const template = prefixhelper.replacePrefixWithURL(subjectMap.termType['@id'], this.prefixes);
            switch (template) {
              case RR.BlankNode:
                id = `_:${id}`;
                break;
              case RR.IRI:
                if ((!subjectMap.template && !subjectMap.reference) || (subjectMap.template && subjectMap.reference)) {
                  throw new Error('Must use exactly one of - rr:template and rr:reference in SubjectMap!');
                }
                if (!helper.isURL(id)) {
                  id = helper.addBase(id, this.prefixes);
                }
                break;
              case RR.Literal:
                break;
              default:
                throw new Error(`Don't know: ${subjectMap.termType['@id']}`);
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
    } else if (subjectMap.functionValue) {
      for (let i = 0; i < iteratorNumber; i++) {
        this.count += 1;
        let obj: Record<string, any> = {};
        const subjVal = await this.functionExecutor.executeFunctionFromValue(
          subjectMap.functionValue,
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
    } else if (subjectMap.constant || (
      subjectMap.termType &&
      prefixhelper.replacePrefixWithURL(subjectMap.termType['@id'], this.prefixes) === RR.BlankNode
    )) {
      // BlankNode with no template or id
      for (let i = 0; i < iteratorNumber; i++) {
        if (functionClassMap) {
          type = await this.functionExecutor.executeFunctionFromValue(
            functionClassMap.functionValue,
            i,
            topLevelMappingProcessors,
          );
        }
        this.count += 1;
        let obj: Record<string, any> = {};
        if (subjectMap.constant) {
          obj['@id'] = helper.getConstant(subjectMap.constant, this.prefixes);
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

    result = helper.cutArray(result);
    const nonSingleValueArrayResult = result.length === 1 ? result[0] : result;
    this.processed = true;
    this.returnValue = nonSingleValueArrayResult;
    return nonSingleValueArrayResult;
  }

  private writeParentPath(index: number, parents: string[], obj: Record<string, any>): void {
    if (!obj.$parentPaths && parents.length > 0) {
      obj.$parentPaths = {};
    }
    for (const parent of parents) {
      if (!obj.$parentPaths[parent]) {
        obj.$parentPaths[parent] = this.functionExecutor.getDataFromParser(index, parent);
      }
    }
  }

  private async doObjectMappings(
    index: number,
    obj: Record<string, any>,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<any> {
    if (this.mapping.predicateObjectMap) {
      let objectMapArray = this.mapping.predicateObjectMap;
      objectMapArray = addArray(objectMapArray);
      for (const mapping of objectMapArray) {
        const predicate = helper.getPredicate(mapping, this.prefixes);
        if (Array.isArray(predicate)) {
          for (const predicateItem of predicate) {
            await this.handleSingleMapping(index, obj, mapping, predicateItem, topLevelMappingProcessors);
          }
        } else {
          await this.handleSingleMapping(index, obj, mapping, predicate, topLevelMappingProcessors);
        }
      }
    }
    obj = helper.cutArray(obj);
    return obj;
  }

  private async handleSingleMapping(
    index: number,
    obj: Record<string, any>,
    mapping: any,
    predicate: string,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<void> {
    predicate = prefixhelper.replacePrefixWithURL(predicate, this.prefixes);
    let object;
    if (mapping.object) {
      object = {
        '@id': prefixhelper.replacePrefixWithURL(mapping.object['@id'], this.prefixes),
      };
    }
    const objectmaps = [];
    if (mapping.objectMap) {
      if (Array.isArray(mapping.objectMap)) {
        for (const t of mapping.objectMap) {
          objectmaps.push(t);
        }
      } else {
        objectmaps.push(mapping.objectMap);
      }
    }

    if (object) {
      helper.addToObj(obj, predicate, object);
    } else {
      await Promise.all(
        objectmaps.map(async(objectmap): Promise<void> => {
          const {
            functionValue,
            parentTriplesMap,
            joinCondition,
            reference,
            template,
            languageMap,
          } = objectmap;
          let {
            constant,
            language,
            termType,
          } = objectmap;
          const datatype = helper.isURL(objectmap.datatype)
            ? objectmap.datatype
            : prefixhelper.replacePrefixWithURL(objectmap.datatype, this.prefixes);

          if (languageMap) {
            language = this.useLanguageMap(index, languageMap);
          }

          if (language && !tags(language).valid()) {
            throw new Error(`Language tag: ${language} invalid!`);
          }

          if (template) {
            // We have a template definition
            const temp = this.calculateTemplate(index, template, termType);
            temp.forEach((te: string): void => {
              let teRef: ReferenceNodeObject | string;
              if (termType) {
                termType = prefixhelper.replacePrefixWithURL(termType, this.prefixes);
                switch (termType) {
                  case RR.BlankNode:
                    teRef = { '@id': `_:${te}` };
                    break;
                  case RR.IRI:
                    if (!helper.isURL(te)) {
                      teRef = { '@id': helper.addBase(te, this.prefixes) };
                    } else {
                      teRef = { '@id': te };
                    }
                    break;
                  case RR.Literal:
                    teRef = te;
                    break;
                  default:
                    throw new Error(`Don't know: ${termType['@id']}`);
                }
              } else {
                teRef = { '@id': te };
              }
              teRef = helper.cutArray(teRef);
              helper.setObjPredicate(obj, predicate, teRef, language, datatype);
            });
          } else if (reference) {
            // We have a reference definition
            let ns = this.functionExecutor.getDataFromParser(index, reference);
            let arr: any[] = [];
            ns = addArray(ns);
            ns.forEach((en): void => {
              arr.push(en);
            });
            if (prefixhelper.replacePrefixWithURL(termType, this.prefixes) === RR.IRI) {
              arr = arr.map((val): ReferenceNodeObject => {
                if (!helper.isURL(val)) {
                  return { '@id': helper.addBase(val, this.prefixes) };
                }
                return { '@id': val };
              });
            }
            if (arr?.length > 0) {
              arr = helper.cutArray(arr);
              helper.setObjPredicate(obj, predicate, arr, language, datatype);
            }
          } else if (constant) {
            // We have a constant definition
            constant = helper.cutArray(constant);
            constant = helper.getConstant(constant, this.prefixes);

            if (prefixhelper.replacePrefixWithURL(predicate, this.prefixes) !== RDF.type &&
              termType &&
              prefixhelper.replacePrefixWithURL(termType, this.prefixes) === RR.IRI
            ) {
              if (!helper.isURL(constant)) {
                constant = { '@id': helper.addBase(constant, this.prefixes) };
              } else {
                constant = { '@id': constant };
              }
            }
            helper.setObjPredicate(obj, predicate, constant, language, datatype);
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
                  parentPath: cond.parent,
                  child: this.functionExecutor.getDataFromParser(index, cond.child),
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
            helper.setObjPredicate(obj, predicate, result, language, datatype);
          }
        }),
      );
    }
  }

  private calculateTemplate(index: number, template: string, termType?: string): string[] {
    if (termType) {
      termType = prefixhelper.replacePrefixWithURL(termType, this.prefixes);
    }

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
      const temp = addArray(this.functionExecutor.getDataFromParser(index, word));
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
      templates.push(finTemp);
    });
    templates.forEach((thisTemplate: string, idx: number): void => {
      templates[idx] = helper.replaceEscapedChar(prefixhelper.replacePrefixWithURL(thisTemplate, this.prefixes));
    });
    return templates;
  }

  private useLanguageMap(index: number, termMap: TermMap): any {
    if (termMap.constant) {
      return termMap.constant;
    }
    if (termMap.reference) {
      const vals = this.functionExecutor.getDataFromParser(index, termMap.reference);
      return addArray(vals)[0];
    }
    if (termMap.template) {
      const temp = this.calculateTemplate(index, termMap.template);
      return addArray(temp)[0];
    }
    throw new Error('TermMap has neither constant, reference or template');
  }
}
