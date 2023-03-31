/* eslint-disable @typescript-eslint/naming-convention */
import type { ValueObject } from 'jsonld';
import { addToObj, getConstant } from './input-parser/helper';
import type { SourceParser } from './input-parser/SourceParser';
import type { MappingProcessor } from './MappingProcessor';
import { predefinedFunctions } from './PredefinedFunctions';
import { returnFirstItemInArrayOrValue, addArray } from './util/ArrayUtil';
import { getIdFromNodeObjectIfDefined, getValueIfDefined } from './util/ObjectUtil';
import type {
  FnoFunctionParameter,
  FunctionValue,
  ObjectMap,
  OrArray,
  PredicateMap,
  PredicateObjectMap,
  ReferenceNodeObject,
  TriplesMap,
} from './util/Types';
import { FNML, FNO, FNO_HTTPS, RML, RR } from './util/Vocabulary';

type FnoFunction = (parameters: any) => Promise<any> | any;

const templateRegex = /(?:\{(.*?)\})/ug;

interface FunctionExecutorArgs {
  parser: SourceParser;
  functions?: Record<string, FnoFunction>;
}

export class FunctionExecutor {
  private readonly parser: SourceParser;
  private readonly functions?: Record<string, FnoFunction>;

  public constructor(args: FunctionExecutorArgs) {
    this.functions = args.functions;
    this.parser = args.parser;
  }

  public async executeFunctionFromValue(
    functionValue: FunctionValue,
    index: number,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<any> {
    const functionName = this.getFunctionName(functionValue[RR.predicateObjectMap]);
    const parameters = this.getFunctionParameters(functionValue[RR.predicateObjectMap]);
    const params = await this.calculateFunctionParams(parameters, index, topLevelMappingProcessors);
    return await this.executeFunction(functionName, params);
  }

  private getFunctionName(predicateObjectMapField: OrArray<Record<string, any>>): string {
    const predicateObjectMaps = addArray(predicateObjectMapField) as PredicateObjectMap[];
    for (const predicateObjectMap of predicateObjectMaps) {
      const predicate = this.getPredicateValueFromPredicateObjectMap(predicateObjectMap);
      if (this.predicateContainsFnoExecutes(predicate)) {
        const functionName = this.getFunctionNameFromPredicateObjectMap(predicateObjectMap);
        if (functionName) {
          return functionName;
        }
      }
    }
    throw new Error('Failed to find function name in predicatePbjectMap');
  }

  private getPredicateValueFromPredicateObjectMap(mapping: PredicateObjectMap): OrArray<string> {
    const { [RR.predicate]: predicate, [RR.predicateMap]: predicateMap } = mapping;
    if (predicate) {
      return this.getPredicateValue(predicate);
    }
    if (predicateMap) {
      return this.getPredicateValueFromPredicateMap(predicateMap);
    }
    throw new Error('No predicate specified in PredicateObjectMap');
  }

  private getPredicateValue(predicate: OrArray<ReferenceNodeObject>): OrArray<string> {
    if (Array.isArray(predicate)) {
      return predicate.map((predicateItem: ReferenceNodeObject): string => predicateItem['@id']);
    }
    return predicate['@id'];
  }

  private getPredicateValueFromPredicateMap(predicateMap: OrArray<PredicateMap>): OrArray<string> {
    // TODO [>=1.0.0]: add support for reference and template here
    if (Array.isArray(predicateMap)) {
      return predicateMap.map((predicateMapItem): string => getConstant(predicateMapItem[RR.constant]));
    }
    return getConstant(predicateMap[RR.constant]);
  }

  private predicateContainsFnoExecutes(predicate: OrArray<string>): boolean {
    if (Array.isArray(predicate)) {
      return predicate.some((predicateItem): boolean => this.isFnoExecutesPredicate(predicateItem));
    }
    return this.isFnoExecutesPredicate(predicate);
  }

  private getFunctionNameFromPredicateObjectMap(predicateObjectMap: PredicateObjectMap): string | undefined {
    const { [RR.objectMap]: objectMap, [RR.object]: object } = predicateObjectMap;
    if (object) {
      return this.getFunctionNameFromObject(object);
    }
    if (objectMap) {
      return this.getFunctionNameFromObjectMap(objectMap);
    }
    throw new Error('No object specified in PredicateObjectMap');
  }

  private getFunctionNameFromObject(object: OrArray<ReferenceNodeObject>): string {
    if (Array.isArray(object)) {
      if (object.length === 1) {
        return getConstant(object[0]);
      }
      throw new Error('Only one function may be specified per PredicateObjectMap');
    }
    return getConstant(object);
  }

  private getFunctionNameFromObjectMap(objectMap: OrArray<ObjectMap>): string {
    const isArray = Array.isArray(objectMap);
    if (isArray && objectMap.length > 1) {
      throw new Error('Only one function may be specified per PredicateObjectMap');
    }
    if (isArray && objectMap[0][RR.constant]) {
      return getConstant(objectMap[0][RR.constant]!);
    }
    if (!isArray && objectMap[RR.constant]) {
      return getConstant(objectMap[RR.constant]!);
    }
    throw new Error('Object must be specified through constant');
  }

  private getFunctionParameters(predicateObjectMapField: OrArray<PredicateObjectMap>): FnoFunctionParameter[] {
    if (Array.isArray(predicateObjectMapField)) {
      return this.getParametersFromPredicateObjectMaps(predicateObjectMapField);
    }
    return this.getParametersFromPredicateObjectMap(predicateObjectMapField);
  }

  private getParametersFromPredicateObjectMaps(
    predicateObjectMaps: PredicateObjectMap[],
  ): FnoFunctionParameter[] {
    return predicateObjectMaps.reduce((
      arr: FnoFunctionParameter[],
      predicateObjectMap: PredicateObjectMap,
    ): FnoFunctionParameter[] => {
      const parameters = this.getParametersFromPredicateObjectMap(predicateObjectMap);
      return [ ...arr, ...parameters ];
    }, []);
  }

  private getParametersFromPredicateObjectMap(predicateObjectMap: PredicateObjectMap): FnoFunctionParameter[] {
    const predicate = this.getPredicateValueFromPredicateObjectMap(predicateObjectMap) as string;
    if (!this.isFnoExecutesPredicate(predicate)) {
      const { [RR.objectMap]: objectMap } = predicateObjectMap;
      // TODO [>=1.0.0]: add support for object here?
      if (objectMap) {
        return this.getParametersFromObjectMap(objectMap, predicate);
      }
    }
    return [];
  }

  private isFnoExecutesPredicate(predicate: string): boolean {
    return predicate === FNO.executes || predicate === FNO_HTTPS.executes;
  }

  private getParametersFromObjectMap(objectMap: OrArray<ObjectMap>, predicate: string): FnoFunctionParameter[] {
    if (Array.isArray(objectMap)) {
      return objectMap.map((objectMapItem: ObjectMap): FnoFunctionParameter =>
        ({ [RR.predicate]: { '@id': predicate }, ...objectMapItem }));
    }
    return [{
      [RR.predicate]: { '@id': predicate },
      ...objectMap,
    }];
  }

  private async calculateFunctionParams(
    parameters: FnoFunctionParameter[],
    index: number,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<Record<string | number, any>> {
    const result: Record<string | number, any> = [];
    await Promise.all(
      parameters.map(async(parameter): Promise<void> => {
        // Adds parameters both by their predicates and as array values
        const value = await this.getParameterValue(parameter, index, topLevelMappingProcessors);
        addToObj(result, parameter[RR.predicate]['@id'], value);
        result.push(value);
      }),
    );
    return result;
  }

  private async getParameterValue(
    parameter: FnoFunctionParameter,
    index: number,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<any> {
    if (parameter[RR.constant]) {
      return getConstant(parameter[RR.constant]);
    }
    if (parameter[RML.reference]) {
      return this.getValueOfReference(parameter[RML.reference]!, index, parameter[RR.datatype]);
    }
    if (parameter[RR.template]) {
      return this.resolveTemplate(parameter[RR.template]!, index);
    }
    if (parameter[FNML.functionValue]) {
      return await this.resolveFunctionValue(parameter[FNML.functionValue]!, index, topLevelMappingProcessors);
    }
    if (parameter[RR.parentTriplesMap]) {
      return await this.resolveTriplesMap(parameter[RR.parentTriplesMap]!, topLevelMappingProcessors);
    }
  }

  private getValueOfReference(
    reference: string | ValueObject,
    index: number,
    datatype?: string | ReferenceNodeObject,
  ): OrArray<any> {
    const data = this.parser.getData(
      index,
      getValueIfDefined(reference) as string,
      getIdFromNodeObjectIfDefined(datatype),
    );
    return returnFirstItemInArrayOrValue(data);
  }

  private resolveTemplate(template: string | ValueObject, index: number): string {
    let resolvedTemplate = getValueIfDefined(template) as string;
    let match = templateRegex.exec(resolvedTemplate);
    while (match) {
      const variableValue = this.parser.getData(index, match[1]);
      resolvedTemplate = resolvedTemplate.replace(`{${match[1]}}`, variableValue.toString());
      match = templateRegex.exec(resolvedTemplate);
    }
    return resolvedTemplate;
  }

  private async resolveFunctionValue(
    functionValue: FunctionValue,
    index: number,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<any> {
    const returnValue = await this.executeFunctionFromValue(functionValue, index, topLevelMappingProcessors);
    return returnFirstItemInArrayOrValue(returnValue);
  }

  private async resolveTriplesMap(
    triplesMap: TriplesMap,
    topLevelMappingProcessors: Record<string, MappingProcessor>,
  ): Promise<any> {
    const processor = topLevelMappingProcessors[triplesMap['@id']];
    if (processor) {
      if (processor.hasProcessed()) {
        return processor.getReturnValue();
      }
      return await processor.processMapping(topLevelMappingProcessors);
    }
    throw new Error('Could not resolve value of parentTriplesMap in function parameter');
  }

  private async executeFunction(
    functionName: string,
    parameters: Record<string | number, any>,
  ): Promise<any> {
    if (this.functions && functionName in this.functions) {
      return await this.functions[functionName](parameters);
    }
    if (functionName in predefinedFunctions) {
      return predefinedFunctions[functionName as keyof typeof predefinedFunctions](parameters);
    }
    throw new Error(`Could not find function ${functionName}`);
  }
}
