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

  inputFiles?: Record<string, string>;

  language?: string;
}

export interface ProcessOptions extends ParseOptions {
  inputFiles: Record<string, string>;
}
