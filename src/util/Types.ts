import type { ContextDefinition, NodeObject } from 'jsonld';
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

export interface ValueObject<T extends string | boolean | number | JSONObject | JSONArray> {
  ['@type']: string;
  ['@value']: T;
  ['@language']?: string;
  ['@direction']?: string;
}

export interface ReferenceNodeObject extends NodeObject {
  ['@id']: string;
}

export interface LogicalSource extends NodeObject {
  ['@type']: typeof RML.LogicalSource;
  [RML.iterator]: string | ValueObject<string>;
  [RML.referenceFormulation]: OrArray<string> | OrArray<ReferenceNodeObject>;
  [RML.source]: OrArray<string> | OrArray<ValueObject<string>>;
}

export interface JoinCondition extends NodeObject {
  ['@type']: typeof RR.Join;
  [RR.child]: string | ValueObject<string>;
  [RR.parent]: string | ValueObject<string>;
}

export interface TriplesMap extends NodeObject {
  ['@type']: typeof RR.TriplesMap;
  [RML.logicalSource]: LogicalSource;
  [RR.subjectMap]?: OrArray<SubjectMap>;
  [RR.subject]?: ReferenceNodeObject;
  [RR.predicateObjectMap]: OrArray<PredicateObjectMap>;
}

export type ValueOf<T> = T[keyof T];

export interface TermMap extends NodeObject {
  ['@type']?: string;
  [RR.constant]?: ValueObject<string | boolean | number> | string | ReferenceNodeObject;
  [RML.reference]?: ValueObject<string> | string;
  [RR.template]?: ValueObject<string> | string;
  [RR.termType]?: ReferenceNodeObject;
  [FNML.functionValue]?: FunctionValue;
}

export interface ObjectMap extends TermMap {
  ['@type']: typeof RR.ObjectMap;
  [RR.parentTriplesMap]?: TriplesMap;
  [RR.joinCondition]?: JoinCondition;
  [RML.languageMap]?: TermMap;
  [RR.language]?: string | ValueObject<string>;
  [RR.datatype]?: ReferenceNodeObject;
}

export interface SubjectMap extends TermMap {
  ['@type']: typeof RR.SubjectMap;
  [RR.class]?: OrArray<ReferenceNodeObject> | FunctionValuedClass;
}

export interface FunctionValuedClass extends NodeObject {
  [FNML.functionValue]: FunctionValue;
}

export interface PredicateMap extends TermMap {
  ['@type']: typeof RR.PredicateMap;
}

export interface PredicateObjectMap extends NodeObject {
  ['@type']: typeof RR.PredicateObjectMap;
  [RR.object]?: OrArray<ReferenceNodeObject>;
  [RR.objectMap]?: OrArray<ObjectMap>;
  [RR.predicate]?: OrArray<ReferenceNodeObject>;
  [RR.predicateMap]?: OrArray<PredicateMap>;
}

export interface FunctionValue extends NodeObject {
  ['@type']: typeof FNML.FunctionValue;
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
