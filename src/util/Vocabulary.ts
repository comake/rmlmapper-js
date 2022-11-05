function createNamespace(baseUri: string, localNames: string[]): Record<string, string> {
  const namespace: Record<string, string> = {};
  for (const localName of localNames) {
    namespace[localName] = `${baseUri}${localName}`;
  }
  return namespace;
}

export const RR = createNamespace('http://www.w3.org/ns/r2rml#', [
  'BlankNode',
  'IRI',
  'Literal',
  'constant',
  'parentTriplesMap',
  'object',
  'objectMap',
]);

export const RML = createNamespace('http://semweb.mmlab.be/ns/rml#', [
  'reference',
]);

export const FNO = createNamespace('http://w3id.org/function/ontology#', [
  'executes',
]);

export const FNML = createNamespace('http://semweb.mmlab.be/ns/fnml#', [
  'functionValue',
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
  'p_any_e',
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
]);
