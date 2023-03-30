import type { ContextDefinition } from 'jsonld';

export type OrArray<T> = T | T[];

export type JSONObject = Record<string, JSONValue>;

export type JSONValue =
  | string
  | number
  | boolean
  | {[x: string]: JSONValue }
  | JSONValue[];

export interface ReferenceNodeObject {
  ['@id']: string;
}

export interface TriplesMap {
  ['@id']: string;
  ['@type']: string;
  logicalSource: OrArray<any>;
  subjectMap: OrArray<SubjectMap>;
  predicateObjectMap: OrArray<PredicateObjectMap>;
}

export interface TermMap {
  constant?: ReferenceNodeObject | string;
  reference?: string;
  template?: string;
  termType?: string;
  datatype?: string;
}

export interface ObjectMap extends TermMap {
  functionValue?: FunctionValue;
  parentTriplesMap?: TriplesMap;
}

export interface SubjectMap extends TermMap {}

export interface PredicateMap extends TermMap {}

export interface PredicateObjectMap {
  object?: OrArray<ReferenceNodeObject>;
  objectMap?: OrArray<ObjectMap>;
  predicate?: OrArray<ReferenceNodeObject>;
  predicateMap?: OrArray<PredicateMap>;
}

export interface FunctionValue {
  predicateObjectMap: OrArray<PredicateObjectMap>;
}

export interface LogicalSource {
  iterator: string;
  referenceFormulation: string | ReferenceNodeObject;
  source: string;
}

export type Prefixes = Record<string, string>;

export interface ParseOptions {
  /**
   * A JSON-LD context for json-ld compress
   */
  compress?: ContextDefinition;
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
