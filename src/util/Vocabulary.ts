type Namespace<T extends string, TBase extends string> = {
  [key in T]: `${TBase}${key}`
};

function createNamespace<T extends string, TBase extends string>(
  baseUri: TBase,
  localNames: T[],
): Namespace<T, TBase> {
  return localNames.reduce((obj: Namespace<T, TBase>, localName): Namespace<T, TBase> => (
    { ...obj, [localName]: `${baseUri}${localName}` }
  // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
  ), {} as Namespace<T, TBase>);
}

export const RR = createNamespace('http://www.w3.org/ns/r2rml#', [
  'BlankNode',
  'IRI',
  'Literal',
  'constant',
  'parentTriplesMap',
  'object',
  'objectMap',
  'parentTriplesMap',
  'class',
  'termType',
  'template',
  'datatype',
  'subject',
  'subjectMap',
  'predicateObjectMap',
  'predicate',
  'predicateMap',
  'joinCondition',
  'child',
  'parent',
  'language',
  'graph',
  'PredicateObjectMap',
  'PredicateMap',
  'ObjectMap',
  'SubjectMap',
  'Join',
  'TriplesMap',
]);

export const RML = createNamespace('http://semweb.mmlab.be/ns/rml#', [
  'reference',
  'logicalSource',
  'source',
  'referenceFormulation',
  'iterator',
  'languageMap',
  'LogicalSource',
]);

export const FNO = createNamespace('http://w3id.org/function/ontology#', [
  'executes',
]);

export const FNML = createNamespace('http://semweb.mmlab.be/ns/fnml#', [
  'functionValue',
  'FunctionValue',
]);

export const FNO_HTTPS = createNamespace('https://w3id.org/function/ontology#', [
  'executes',
]);

export const XSD = createNamespace('http://www.w3.org/2001/XMLSchema#', [
  'boolean',
  'integer',
  'double',
  'string',
]);

export const RDF = createNamespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#', [
  'type',
  'first',
  'rest',
  'datatype',
  'JSON',
]);

export const RDFS = createNamespace('http://www.w3.org/2000/01/rdf-schema#', [
  'subClassOf',
  'label',
  'range',
]);

export const OWL = createNamespace('http://www.w3.org/2002/07/owl#', [
  'Restriction',
  'onProperty',
  'allValuesFrom',
  'Class',
  'intersectionOf',
  'someValuesFrom',
  'ObjectProperty',
]);

export const SHACL = createNamespace('http://www.w3.org/ns/shacl#', [
  'targetClass',
  'targetNode',
]);

export const GREL = createNamespace('http://users.ugent.be/~bjdmeest/function/grel.ttl#', [
  'array_join',
  'controls_if',
  'bool_b',
  'any_true',
  'any_false',
  'array_sum',
  'array_product',
  'p_array_a',
  'string_endsWith',
  'valueParameter',
  'valueParameter2',
  'string_sub',
  'string_replace',
  'p_string_find',
  'p_string_replace',
  'date_now',
  'boolean_not',
  'array_get',
  'param_int_i_from',
  'param_int_i_opt_to',
  'string_split',
  'p_string_sep',
  'date_inc',
  'p_date_d',
  'p_dec_n',
  'param_n2',
  'p_string_unit',
  'math_max',
  'math_min',
  'boolean_and',
  'boolean_or',
  'param_rep_b',
  'toUpperCase',
  'string_toString',
  'string_toNumber',
  'p_any_e',
  'string_contains',
  'string_length',
  'array_length',
  'math_ceil',
]);

export const IDLAB = createNamespace('http://example.com/idlab/function/', [
  'equal',
  'notEqual',
  'getMIMEType',
  'str',
  'otherStr',
  'isNull',
  'random',
  'concat',
  'delimiter',
  'listContainsElement',
  'list',
  'trueCondition',
  'strBoolean',
]);

export const QL = createNamespace('http://semweb.mmlab.be/ns/ql#', [
  'JSONPath',
  'XPath',
  'CSV',
]);
