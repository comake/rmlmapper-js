import type { ContextDefinition, ValueObject } from 'jsonld';
import type { FNML, RML, RR } from './Vocabulary';

export type OrArray<T> = T | T[];

export type JSONObject = Record<string, JSONValue>;

export type JSONArray = JSONValue[];

export type JSONValue =
  | string
  | number
  | boolean
  | {[x: string]: JSONValue }
  | JSONArray;

export interface ReferenceNodeObject {
  ['@id']: string;
}

export interface LogicalSource {
  [RML.iterator]: string | ValueObject;
  [RML.referenceFormulation]: string | ReferenceNodeObject;
  [RML.source]: string | ValueObject;
}

export interface JoinCondition {
  [RR.child]: string | ValueObject;
  [RR.parent]: string | ValueObject;
}

export interface TriplesMap {
  ['@id']: string;
  ['@type']: string;
  [RML.logicalSource]: LogicalSource;
  [RR.subjectMap]: OrArray<SubjectMap>;
  [RR.predicateObjectMap]: OrArray<PredicateObjectMap>;
}

export type ValueOf<T> = T[keyof T];

export interface TermMap {
  ['@id']?: string;
  ['@type']?: string;
  [RR.constant]?: ValueObject | string;
  [RML.reference]?: ValueObject | string;
  [RR.template]?: ValueObject | string;
  [RR.termType]?: ReferenceNodeObject;
  [RR.datatype]?: ReferenceNodeObject;
}

export interface ObjectMap extends TermMap {
  [FNML.functionValue]?: FunctionValue;
  [RR.parentTriplesMap]?: TriplesMap;
  [RR.joinCondition]: JoinCondition;
  [RML.languageMap]: TermMap;
  [RR.language]: string | ValueObject;
}

export interface SubjectMap extends TermMap {
  [RR.class]: OrArray<ReferenceNodeObject> | FunctionValuedClass;
  [FNML.functionValue]?: FunctionValue;
}

export interface FunctionValuedClass {
  [FNML.functionValue]: FunctionValue;
}

export interface PredicateMap extends TermMap {}

export interface PredicateObjectMap {
  [RR.object]?: OrArray<ReferenceNodeObject>;
  [RR.objectMap]?: OrArray<ObjectMap>;
  [RR.predicate]?: OrArray<ReferenceNodeObject>;
  [RR.predicateMap]?: OrArray<PredicateMap>;
}

export interface FunctionValue {
  [RR.predicateObjectMap]: OrArray<PredicateObjectMap>;
}

export type FnoFunctionParameter = ObjectMap & { [RR.predicate]: ReferenceNodeObject };

export interface ParseOptions {
  /**
   * A JSON-LD context to compact the output with
   */
  compact?: ContextDefinition;
  /**
   * Option to output triples as N-Quads instead of JSON-LD
   */
  toRDF?: boolean;
  /**
   * Replaces "\@id" references with nested elements. JSON-LD only.
   */
  replace?: boolean;
  /**
   * Remove xmlns in xml documents (for easier xPaths)
   */
  removeNameSpace?: Record<string, string>;
  /**
   * Xpath evaluator library
   */
  xpathLib?: 'default' | 'xpath' | 'pugixml' | 'fontoxpath';
  /**
   * Predefined functions which can be used in mappings
   */
  functions?: Record<string, (args: any | any[]) => any>;
  /**
   * Do not add triples for empty strings
   */
  ignoreEmptyStrings?: boolean;
  /**
   * Ignore values from the input
   */
  ignoreValues?: string[];
  /**
   * CSV options
   */
  csv?: {
    delimiter?: string;
  };
  /**
   * The default "\@language" to use in the output
   */
  language?: string;
}

export interface ProcessOptions extends ParseOptions {
  inputFiles: Record<string, string>;
}
