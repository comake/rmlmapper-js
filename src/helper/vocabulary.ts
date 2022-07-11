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
]);

export const RDF = createNamespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#', [
  'type',
]);

export const GREL = createNamespace('http://users.ugent.be/~bjdmeest/function/grel.ttl#', [
  'valueParameter',
  'param_int_i_from',
  'param_int_i_opt_to',
]);
