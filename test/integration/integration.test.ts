/* eslint-disable
  @typescript-eslint/naming-convention,
  no-console,
  operator-linebreak
*/
import * as assert from 'assert';
import { promises as fs } from 'fs';
import type { NodeObject } from 'jsonld';
import { parseTurtle, parseJsonLd, cutArray } from '../../src';
import type { ParseOptions, ReferenceNodeObject } from '../../src';
import { findObjectWithIdInArray } from '../../src/util/ObjectUtil';
import { GREL } from '../../src/util/Vocabulary';

async function readInputFiles(inputFileNames: string[]): Promise<Record<string, string>> {
  return await inputFileNames.reduce(async(
    previousPromise: Promise<Record<string, string>>,
    inputFileName: string,
  ): Promise<Record<string, string>> => {
    const obj = await previousPromise;
    return new Promise((resolve): void => {
      fs.readFile(inputFileName, 'utf8')
        .then((contents): void => {
          obj[inputFileName] = contents;
          return resolve(obj);
        })
        .catch((): void => {
          // Do nothing...
        });
    });
  }, Promise.resolve({} as Record<string, string>));
}

async function parseFileJsonLd(
  pathInput: string,
  inputFileNames: string[],
  pathOutput: string,
  options: ParseOptions = {},
): Promise<string | NodeObject | NodeObject[]> {
  const mapFile = await fs.readFile(pathInput, 'utf8');
  const mappingJsonLd = JSON.parse(mapFile);
  const inputFiles = await readInputFiles(inputFileNames);
  const out = await parseJsonLd(mappingJsonLd, inputFiles, options);
  if (options.toRDF) {
    await fs.writeFile(pathOutput, out as string);
    return out as string;
  }
  await fs.writeFile(pathOutput, JSON.stringify(out, null, 2));
  return out;
}

async function parseFileTurtle(
  pathInput: string,
  inputFileNames: string[],
  pathOutput: string,
  options: ParseOptions = {},
): Promise<string | NodeObject | NodeObject[]> {
  const mapFile = await fs.readFile(pathInput, 'utf8');
  const inputFiles = await readInputFiles(inputFileNames);
  const out = await parseTurtle(mapFile, inputFiles, options);
  if (options.toRDF) {
    await fs.writeFile(pathOutput, out as string);
    return out as string;
  }
  await fs.writeFile(pathOutput, JSON.stringify(out, null, 2));
  return out;
}

describe('Parsing', (): void => {
  describe('with turtle mappings', (): void => {
    it('Basic straight mapping.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/straightMapping/mapping.ttl',
        [ './test/assets/straightMapping/input.json' ],
        './test/assets/straightMapping/out.json',
      );
      const firstResult = cutArray(result) as NodeObject;
      assert.equal(firstResult['https://schema.org/name'], 'Tom A.');
      assert.equal(firstResult['https://schema.org/age'], 15);
      assert.equal(firstResult['@type'], 'https://schema.org/Person');
      assert.equal(Object.keys(firstResult).length, 4);
    });

    it('Basic straight double mapping.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/straightDoubleMapping/mapping.ttl',
        [ './test/assets/straightDoubleMapping/input.json' ],
        './test/assets/straightDoubleMapping/out.json',
      ) as NodeObject[];
      assert.equal(result.length, 2);
    });

    it('Constant subject mapping.', async(): Promise<void> => {
      let result = await parseFileTurtle(
        './test/assets/constantSubjectMapping/mapping.ttl',
        [ './test/assets/constantSubjectMapping/input.json' ],
        './test/assets/constantSubjectMapping/out.json',
      );
      result = cutArray(result) as NodeObject;
      assert.equal(result['https://schema.org/name'], 'Tom A.');
      assert.equal(result['@type'], 'https://schema.org/Person');
      assert.equal(result['@id'], 'http://example.com/data/1234');
    });

    it('Array Value mapping.', async(): Promise<void> => {
      const options = {};
      let result = await parseFileTurtle(
        './test/assets/arrayValueMapping/mapping.ttl',
        [ './test/assets/arrayValueMapping/input.json' ],
        './test/assets/arrayValueMapping/out.json',
        options,
      );
      result = cutArray(result) as NodeObject;
      assert.equal(result['https://schema.org/name'], 'Tom A.');
      assert.equal((result['http://example.com/favorite-numbers'] as NodeObject[]).length, 3);
      assert.equal((result['http://example.com/favorite-numbers'] as NodeObject[])[0]['@value'], '3');
      assert.equal((result['http://example.com/favorite-numbers'] as NodeObject[])[0]['@type'], 'http://www.w3.org/2001/XMLSchema#integer');
      assert.equal((result['http://example.com/favorite-numbers'] as NodeObject[])[1]['@value'], '33');
      assert.equal((result['http://example.com/favorite-numbers'] as NodeObject[])[1]['@type'], 'http://www.w3.org/2001/XMLSchema#integer');
      assert.equal((result['http://example.com/favorite-numbers'] as NodeObject[])[2]['@value'], '13');
      assert.equal((result['http://example.com/favorite-numbers'] as NodeObject[])[2]['@type'], 'http://www.w3.org/2001/XMLSchema#integer');
      assert.equal(result['@type'], 'https://schema.org/Person');
      assert.equal(Object.keys(result).length, 4);
    });

    it('Live mapping.', async(): Promise<void> => {
      const mapFile = '@prefix rr: <http://www.w3.org/ns/r2rml#> .\n'
            + '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n'
            + '@prefix rml: <http://semweb.mmlab.be/ns/rml#> .\n'
            + '@prefix prefix: <http://mytestprefix.org/> .\n'
            + '@prefix ql: <http://semweb.mmlab.be/ns/ql#> .\n'
            + '@base <http://example.test/> . #the base for the classes\n'
            + '\n'
            + '\n'
            + '<#LOGICALSOURCE>\n'
            + 'rml:source "./input.json";\n'
            + 'rml:referenceFormulation ql:JSONPath;\n'
            + 'rml:iterator "$.*".\n'
            + '\n'
            + '<#SPORTSSOURCE>\n'
            + 'rml:source "./input.json";\n'
            + 'rml:referenceFormulation ql:JSONPath;\n'
            + 'rml:iterator "$.*.sports.School.*".\n'
            + '\n'
            + '<#REQUIRESSOURCE>\n'
            + 'rml:source "./input.json";\n'
            + 'rml:referenceFormulation ql:JSONPath;\n'
            + 'rml:iterator "$.*.sports.School.*.requires.*".\n'
            + '\n'
            + '\n'
            + '<#Mapping>\n'
            + 'rml:logicalSource <#LOGICALSOURCE>;\n'
            + '\n'
            + ' rr:subjectMap [\n'
            + '    rr:termType rr:BlankNode;\n'
            + '    rr:class prefix:Person;\n'
            + ' ];\n'
            + '\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:name;\n'
            + '    rr:objectMap [ rml:reference "name" ];\n'
            + '];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:age;\n'
            + '    rr:objectMap [ rml:reference "age" ];\n'
            + '];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:likesSports;\n'
            + '    rr:objectMap  [\n'
            + '           rr:parentTriplesMap <#SPORTSmapping>;\n'
                        + 'rr:joinCondition [\n'
                            + 'rr:child "name" ;\n'
                            + 'rr:parent "^^^.name";\n'
                        + ']\n'
            + '        ];\n'
            + '].\n'
            + '\n'
            + '<#SPORTSmapping>\n'
            + 'rml:logicalSource <#SPORTSSOURCE>;\n'
            + '\n'
            + ' rr:subjectMap [\n'
            + '    rr:termType rr:BlankNode;\n'
            + '    rr:class prefix:Sport;\n'
            + ' ];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:name;\n'
            + '    rr:objectMap [ rml:reference "name" ];\n'
            + '];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:requires;\n'
            + '    rr:objectMap  [\n'
            + '           rr:parentTriplesMap <#REQmapping>;\n'
                            + 'rr:joinCondition [\n'
                            + 'rr:child "name" ;\n'
                            + 'rr:parent "^^.name";\n'
            + ']\n'
            + '        ];\n'
            + '].\n'
            + '\n'
            + '<#REQmapping>\n'
            + 'rml:logicalSource <#REQUIRESSOURCE>;\n'
            + 'rr:subjectMap [\n'
            + '    rr:termType rr:BlankNode;\n'
            + '    rr:class prefix:Requirement;\n'
            + '];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:thing;\n'
            + '    rr:objectMap [ rml:reference "thing" ];\n'
            + '].\n'
            + '\n'
            + '\n'
            + '\n'
            + '\n'
            + '\n'
            + '\n';
      const inputFiles = {
        './input.json': '[\n'
                + '  {\n'
                + '    "name": "Tom A.",\n'
                + '    "age": 15,\n'
                + '    "sports": {\n'
                + '      "School":\n'
                + '      [\n'
                + '        {\n'
                + '          "name": "Basketball",\n'
                + '          "requires": [\n'
                + '            {\n'
                + '              "thing":"ball"\n'
                + '            },{\n'
                + '              "thing":"basket"\n'
                + '            }\n'
                + '          ]\n'
                + '        }\n'
                + '      ]\n'
                + '    }\n'
                + '  },\n'
                + '  {\n'
                + '    "name": "Tom B.",\n'
                + '    "age": 16,\n'
                + '    "sports": {\n'
                + '      "School":\n'
                + '      [\n'
                + '        {\n'
                + '          "name": "Football",\n'
                + '          "requires": [\n'
                + '            {\n'
                + '              "thing":"ball"\n'
                + '            }\n'
                + '          ]\n'
                + '        }\n'
                + '      ]\n'
                + '    }\n'
                + '  }\n'
                + ']',
      };
      const result = await parseTurtle(mapFile, inputFiles, {})
        .catch((err: any): void => {
          console.log(err);
        }) as NodeObject[];
      assert.equal(result[0]['http://mytestprefix.org/name'], 'Tom A.');
      assert.equal(result[1]['http://mytestprefix.org/name'], 'Tom B.');

      assert.equal(result[5]['http://mytestprefix.org/name'], 'Basketball');
      assert.equal(result[6]['http://mytestprefix.org/name'], 'Football');

      assert.equal((result[5]['http://mytestprefix.org/requires'] as NodeObject).length, 2);
      assert.equal((result[6]['http://mytestprefix.org/requires'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23REQmapping_3');
    });

    it('Nested mapping.', async(): Promise<void> => {
      const options = {
      };
      const result = await parseFileTurtle(
        './test/assets/nestedMapping/mapping.ttl',
        [ './test/assets/nestedMapping/input.json' ],
        './test/assets/nestedMapping/out.json',
        options,
      ).catch((err): void => {
        console.log(err);
      }) as NodeObject[];
      assert.equal((result[0]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_1');
      assert.equal((result[1]['http://mytestprefix.org/name'] as string[])[1], 'Football');
    });

    it('Test with deleting prefixes.', async(): Promise<void> => {
      const options = {
      };
      const result = await parseFileTurtle(
        './test/assets/straightMapping/mapping.ttl',
        [ './test/assets/straightMapping/input.json' ],
        './test/assets/straightMapping/out.json',
        options,
      ).catch((err): void => {
        console.log(err);
      }) as NodeObject[];
      const firstValue = result[0];
      assert.equal(firstValue['https://schema.org/name'], 'Tom A.');
      assert.equal(firstValue['https://schema.org/age'], 15);
      assert.equal(firstValue['@type'], 'https://schema.org/Person');
      assert.equal(Object.keys(firstValue).length, 4);
    });

    it('Basic straight mapping with array of input.', async(): Promise<void> => {
      const options = {
      };
      const result = await parseFileTurtle(
        './test/assets/straightMappingArray/mapping.ttl',
        [ './test/assets/straightMappingArray/input.json' ],
        './test/assets/straightMappingArray/out.json',
        options,
      ).catch((err): void => {
        console.log(err);
      }) as NodeObject[];
      assert.equal(result[0]['https://schema.org/name'], 'Ben A.');
      assert.equal(result[0]['https://schema.org/age'], 15);
      assert.equal(result[0]['@type'], 'https://schema.org/Person');
      assert.equal(result[1]['https://schema.org/name'], 'Tom B.');
      assert.equal(result[1]['https://schema.org/age'], 16);
      assert.equal(result[1]['@type'], 'https://schema.org/Person');
      assert.equal(Object.keys(result).length, 2);
    });

    it('Nested mapping with array of input.', async(): Promise<void> => {
      const options = {
      };
      const result = await parseFileTurtle(
        './test/assets/nestedMappingArray/mapping.ttl',
        [ './test/assets/nestedMappingArray/input.json' ],
        './test/assets/nestedMappingArray/out.json',
        options,
      ).catch((err): void => {
        console.log(err);
      }) as NodeObject[];
      assert.equal(result[0]['https://schema.org/name'], 'Ben A.');
      assert.equal((result[0]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_1');
      assert.equal(result[1]['https://schema.org/name'], 'Tom B.');
      assert.equal((result[1]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_2');
      assert.equal(Object.keys(result).length, 4);
    });

    it('Double-nested mapping.', async(): Promise<void> => {
      const options = {
        compact: {
          '@vocab': 'http://mytestprefix.org/',
        },
        language: 'de',
      };
      const result = await parseFileTurtle(
        './test/assets/doubleNestedMapping/mapping.ttl',
        [ './test/assets/doubleNestedMapping/input.json' ],
        './test/assets/doubleNestedMapping/out.json',
        options,
      ).catch((err): void => {
        console.log(err);
      }) as NodeObject[];
      assert.equal(result[0].name, 'Tom A.');
      assert.equal(result[0].age, '15');
      assert.equal(result[0]['@type'], 'Person');
      const sportId = (result[0].likesSports as NodeObject)['@id']!;
      const likesSport = findObjectWithIdInArray(result, sportId)!;
      assert.equal(likesSport.name, 'Basketball');
      assert.equal(
        (likesSport.requires as ReferenceNodeObject)['@id'],
        '_:http%3A%2F%2Fexample.test%2F%23REQmapping_1',
      );
    });

    it('Async function mapping.', async(): Promise<void> => {
      const options = {
        functions: {
          'http://users.ugent.be/~bjdmeest/function/grel.ttl#asyncFunc': async function createDescription(data: any[]): Promise<string> {
            await new Promise((resolve): void => {
              setTimeout(resolve, 1000);
            });
            return `${data[1]} likes the sports: ${data[0][0]} and ${data[0][1]}`;
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/asyncFunctionMapping/mapping.ttl',
        [ './test/assets/asyncFunctionMapping/input.json' ],
        './test/assets/asyncFunctionMapping/out.json',
        options,
      ).catch((err): void => {
        console.log(err);
      }) as NodeObject[];
      const testString = 'Tom A. likes the sports: Tennis and Football';
      assert.equal(result[1]['http://mytestprefix.org/description'], testString);
    });

    it('Predefined function mapping.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/predefinedFunctionMapping/mapping.ttl',
        [ './test/assets/predefinedFunctionMapping/input.json' ],
        './test/assets/predefinedFunctionMapping/out.json',
        {},
      ).catch((err): void => {
        console.log(err);
      }) as NodeObject[];
      const testString = 'TOM A.';
      assert.equal(result[0]['http://mytestprefix.org/name'], testString);
    });

    it('Non Array Predicate Object Mapping.', async(): Promise<void> => {
      const options = {
        functions: {
          'http://example.com/idlab/function/random'(): string {
            return '42';
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/nonArrayPredicateObjectMap/mapping.ttl',
        [ './test/assets/nonArrayPredicateObjectMap/input.json' ],
        './test/assets/nonArrayPredicateObjectMap/out.json',
        options,
      ).catch((err): void => {
        console.log(err);
      }) as NodeObject[];
      assert.equal(Object.keys(result[0]).includes('http://example.com/uuid'), true);
      assert.equal(result[0]['http://example.com/uuid'], '42');
    });

    it('Predefined option parameter function mapping.', async(): Promise<void> => {
      const options = {
        functions: {
          'http://users.ugent.be/~bjdmeest/function/grel.ttl#toLowerCase'(data: string): string {
            return data.toString().toLowerCase();
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/optionParameterFunctionMapping/mapping.ttl',
        [ './test/assets/optionParameterFunctionMapping/input.json' ],
        './test/assets/optionParameterFunctionMapping/out.json',
        options,
      ).catch((err): void => {
        console.log(err);
      }) as NodeObject[];
      const testString = 'tom a.';
      assert.equal(result[0]['http://mytestprefix.org/name'], testString);
    });

    it('Nested predefined function mapping.', async(): Promise<void> => {
      const options = {
        functions: {
          'http://users.ugent.be/~bjdmeest/function/grel.ttl#string_substring'(data: Record<string, any>): string {
            const value = data[GREL.valueParameter] as string;
            const from = Number.parseInt(data[GREL.param_int_i_from], 10);
            const to = Number.parseInt(data[GREL.param_int_i_opt_to], 10);
            return value.slice(from, to);
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/nestedPredefinedFunctionMapping/mapping.ttl',
        [ './test/assets/nestedPredefinedFunctionMapping/input.json' ],
        './test/assets/nestedPredefinedFunctionMapping/out.json',
        options,
      ) as NodeObject[];
      assert.equal(result[0]['http://mytestprefix.org/name'], 'TOM');
    });

    it('Triple nested mapping.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/tripleNestedMapping/mapping.ttl',
        [ './test/assets/tripleNestedMapping/input.json' ],
        './test/assets/tripleNestedMapping/out.json',
        {},
      ) as NodeObject[];
      assert.equal(result[0]['http://mytestprefix.org/name'], 'Tom A.');
      assert.equal(result[1]['http://mytestprefix.org/name'], 'Tom B.');

      assert.equal(Object.keys(result[0]['http://mytestprefix.org/likesSports'] as NodeObject).length, 1);
      assert.equal(Object.keys(result[1]['http://mytestprefix.org/likesSports'] as NodeObject).length, 1);

      assert.equal((result[5]['http://mytestprefix.org/requires'] as NodeObject).length, 2);
      assert.equal((result[6]['http://mytestprefix.org/requires'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23REQmapping_3');
    });

    it('Reference valued predicate mapping.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/referencePredicateMapping/mapping.ttl',
        [ './test/assets/referencePredicateMapping/input.json' ],
        './test/assets/referencePredicateMapping/out.json',
        {},
      ) as NodeObject[];
      assert.equal(result[0]['https://example.com/3'], true);
      assert.equal(result[0]['https://example.com/4'], true);
      assert.equal(result[0]['https://example.com/5'], true);
    });

    it('Template valued predicate mapping.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/templatePredicateMapping/mapping.ttl',
        [ './test/assets/templatePredicateMapping/input.json' ],
        './test/assets/templatePredicateMapping/out.json',
        {},
      ) as NodeObject[];
      assert.equal(result[0]['https://example.com/3'], true);
      assert.equal(result[0]['https://example.com/4'], true);
      assert.equal(result[0]['https://example.com/5'], true);
    });

    it('function valued predicate mapping.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/functionPredicateMapping/mapping.ttl',
        [ './test/assets/functionPredicateMapping/input.json' ],
        './test/assets/functionPredicateMapping/out.json',
        {},
      ) as NodeObject[];
      assert.equal(result[0]['https://example.com/12'], true);
    });

    // TESTS FOR XML

    it('Basic straight mapping XML.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/straightMappingXML/mapping.ttl',
        [ './test/assets/straightMappingXML/input.xml' ],
        './test/assets/straightMappingXML/out.json',
      ) as NodeObject[];
      const firstResult = result[0];
      assert.equal(firstResult['https://schema.org/name'], 'Tom A.');
      assert.equal(firstResult['https://schema.org/age'], 15);
      assert.equal(firstResult['@type'], 'https://schema.org/Person');
      assert.equal(Object.keys(firstResult).length, 4);
    });

    it('Basic straight double mapping XML.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/straightDoubleMappingXML/mapping.ttl',
        [ './test/assets/straightDoubleMappingXML/input.xml' ],
        './test/assets/straightDoubleMappingXML/out.json',
      );
      assert.equal(result.length, 2);
    });

    it('Nested mapping XML.', async(): Promise<void> => {
      const options = {
      };
      const result = await parseFileTurtle(
        './test/assets/nestedMappingXML/mapping.ttl',
        [ './test/assets/nestedMappingXML/input.xml' ],
        './test/assets/nestedMappingXML/out.json',
        options,
      ) as NodeObject[];
      assert.equal((result[0]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_1');
    });

    it('Test with deleting prefixes XML.', async(): Promise<void> => {
      const options = {};
      const result = await parseFileTurtle(
        './test/assets/straightMappingXML/mapping.ttl',
        [ './test/assets/straightMappingXML/input.xml' ],
        './test/assets/straightMappingXML/out.json',
        options,
      ) as NodeObject[];
      const firstResult = result[0];
      assert.equal(firstResult['https://schema.org/name'], 'Tom A.');
      assert.equal(firstResult['https://schema.org/age'], 15);
      assert.equal(firstResult['@type'], 'https://schema.org/Person');
      assert.equal(Object.keys(firstResult).length, 4);
    });

    it('Basic straight mapping with array of input XML.', async(): Promise<void> => {
      const options = {};
      const result = await parseFileTurtle(
        './test/assets/straightMappingArrayXML/mapping.ttl',
        [ './test/assets/straightMappingArrayXML/input.xml' ],
        './test/assets/straightMappingArrayXML/out.json',
        options,
      ) as NodeObject[];
      assert.equal(result[0]['https://schema.org/name'], 'Ben A.');
      assert.equal(result[0]['https://schema.org/age'], 15);
      assert.equal(result[0]['@type'], 'https://schema.org/Person');
      assert.equal(result[1]['https://schema.org/name'], 'Tom B.');
      assert.equal(result[1]['https://schema.org/age'], 16);
      assert.equal(result[1]['@type'], 'https://schema.org/Person');
      assert.equal(Object.keys(result).length, 2);
    });

    it('Nested mapping with array of input XML.', async(): Promise<void> => {
      const options = {};
      const result = await parseFileTurtle(
        './test/assets/nestedMappingArrayXML/mapping.ttl',
        [ './test/assets/nestedMappingArrayXML/input.xml' ],
        './test/assets/nestedMappingArrayXML/out.json',
        options,
      ) as NodeObject[];
      assert.equal(result[0]['https://schema.org/name'], 'Ben A.');
      assert.equal((result[0]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_1');
      assert.equal(result[1]['https://schema.org/name'], 'Tom B.');
      assert.equal((result[1]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_2');
      assert.equal(Object.keys(result).length, 4);
    });

    it('Double-nested mapping XML.', async(): Promise<void> => {
      const options = {
      };
      const result = await parseFileTurtle(
        './test/assets/doubleNestedMappingXML/mapping.ttl',
        [ './test/assets/doubleNestedMappingXML/input.xml' ],
        './test/assets/doubleNestedMappingXML/out.json',
        options,
      ) as NodeObject[];
      assert.equal(result[0]['http://mytestprefix.org/name'], 'Tom A.');
      assert.equal(result[0]['http://mytestprefix.org/age'], '15');
      assert.equal(result[0]['@type'], 'http://mytestprefix.org/Person');
      const sportId = (result[0]['http://mytestprefix.org/likesSports'] as NodeObject)['@id']!;
      const likesSport = findObjectWithIdInArray(result, sportId)!;
      assert.equal(likesSport['http://mytestprefix.org/name'], 'Basketball');
      assert.equal((likesSport['http://mytestprefix.org/requires'] as ReferenceNodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23REQmapping_1');
    });

    it('subject mapping XML.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/subjectMappingXML/mapping.ttl',
        [ './test/assets/subjectMappingXML/input.xml' ],
        './test/assets/subjectMappingXML/out.json',
        {},
      ) as NodeObject[];
      assert.equal(result[0]['@id'], 'http://mytestprefix.org/Tiger');
    });

    it('Triple nested mapping XML.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/tripleNestedMappingXML/mapping.ttl',
        [ './test/assets/tripleNestedMappingXML/input.xml' ],
        './test/assets/tripleNestedMappingXML/out.json',
      ) as NodeObject[];
      assert.equal(result[0]['http://mytestprefix.org/name'], 'Tom A.');
      assert.equal(result[1]['http://mytestprefix.org/name'], 'Tom B.');

      assert.equal((result[0]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_1');
      assert.equal((result[1]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_2');

      assert.equal((result[5]['http://mytestprefix.org/requires'] as NodeObject).length, 2);
    });

    it('Live mapping XML.', async(): Promise<void> => {
      const options = {
      };

      const mapFile = '@prefix rr: <http://www.w3.org/ns/r2rml#> .\n'
            + '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n'
            + '@prefix rml: <http://semweb.mmlab.be/ns/rml#> .\n'
            + '@prefix prefix: <http://mytestprefix.org/> .\n'
            + '@prefix ql: <http://semweb.mmlab.be/ns/ql#> .\n'
            + '@base <http://example.test/> . #the base for the classes\n'
            + '\n'
            + '\n'
            + '<#LOGICALSOURCE>\n'
            + 'rml:source "./input.xml";\n'
            + 'rml:referenceFormulation ql:XPath;\n'
            + 'rml:iterator "/root/*".\n'
            + '\n'
            + '<#SPORTSSOURCE>\n'
            + 'rml:source "./input.xml";\n'
            + 'rml:referenceFormulation ql:XPath;\n'
            + 'rml:iterator "/root/*/sports/School/*".\n'
            + '\n'
            + '<#REQUIRESSOURCE>\n'
            + 'rml:source "./input.xml";\n'
            + 'rml:referenceFormulation ql:XPath;\n'
            + 'rml:iterator "/root/*/sports/School/*/requires/*".\n'
            + '\n'
            + '\n'
            + '<#Mapping>\n'
            + 'rml:logicalSource <#LOGICALSOURCE>;\n'
            + '\n'
            + ' rr:subjectMap [\n'
            + '    rr:termType rr:BlankNode;\n'
            + '    rr:class prefix:Person;\n'
            + ' ];\n'
            + '\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:name;\n'
            + '    rr:objectMap [ rml:reference "name" ];\n'
            + '];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:age;\n'
            + '    rr:objectMap [ rml:reference "age" ];\n'
            + '];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:likesSports;\n'
            + '    rr:objectMap  [\n'
            + '           rr:parentTriplesMap <#SPORTSmapping>;\n'
                          + 'rr:joinCondition [\n'
                          + 'rr:child "name" ;\n'
                          + 'rr:parent "../../../name";\n'
                          + ']\n'
            + '        ];\n'
            + '].\n'
            + '\n'
            + '<#SPORTSmapping>\n'
            + 'rml:logicalSource <#SPORTSSOURCE>;\n'
            + '\n'
            + ' rr:subjectMap [\n'
            + '    rr:termType rr:BlankNode;\n'
            + '    rr:class prefix:Sport;\n'
            + ' ];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:name;\n'
            + '    rr:objectMap [ rml:reference "name" ];\n'
            + '];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:requires;\n'
            + '    rr:objectMap  [\n'
            + '           rr:parentTriplesMap <#REQmapping>;\n'
                          + 'rr:joinCondition [\n'
                          + 'rr:child "name" ;\n'
                          + 'rr:parent "../../name";\n'
          + ']\n'
            + '        ];\n'
            + '].\n'
            + '\n'
            + '<#REQmapping>\n'
            + 'rml:logicalSource <#REQUIRESSOURCE>;\n'
            + 'rr:subjectMap [\n'
            + '    rr:termType rr:BlankNode;\n'
            + '    rr:class prefix:Requirement;\n'
            + '];\n'
            + '\n'
            + 'rr:predicateObjectMap [\n'
            + '    rr:predicate prefix:thing;\n'
            + '    rr:objectMap [ rml:reference "thing" ];\n'
            + '].\n'
            + '\n'
            + '\n'
            + '\n'
            + '\n'
            + '\n'
            + '\n';
      const inputFiles = {
        './input.xml': '<?xml version="1.0" encoding="UTF-8"?>\n'
                + '<root>\n'
                + '    <element>\n'
                + '        <age>15</age>\n'
                + '        <name>Tom A.</name>\n'
                + '        <sports>\n'
                + '            <School>\n'
                + '                <element>\n'
                + '                    <name>Basketball</name>\n'
                + '                    <requires>\n'
                + '                        <element>\n'
                + '                            <thing>ball</thing>\n'
                + '                        </element>\n'
                + '                        <element>\n'
                + '                            <thing>basket</thing>\n'
                + '                        </element>\n'
                + '                    </requires>\n'
                + '                </element>\n'
                + '            </School>\n'
                + '        </sports>\n'
                + '    </element>\n'
                + '    <element>\n'
                + '        <age>16</age>\n'
                + '        <name>Tom B.</name>\n'
                + '        <sports>\n'
                + '            <School>\n'
                + '                <element>\n'
                + '                    <name>Football</name>\n'
                + '                    <requires>\n'
                + '                        <element>\n'
                + '                            <thing>ball</thing>\n'
                + '                        </element>\n'
                + '                    </requires>\n'
                + '                </element>\n'
                + '            </School>\n'
                + '        </sports>\n'
                + '    </element>\n'
                + '</root>',
      };

      const result = await parseTurtle(mapFile, inputFiles, options) as NodeObject[];
      assert.equal(result[0]['http://mytestprefix.org/name'], 'Tom A.');
      assert.equal(result[1]['http://mytestprefix.org/name'], 'Tom B.');
      assert.equal((result[0]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_1');
      assert.equal((result[1]['http://mytestprefix.org/likesSports'] as NodeObject)['@id'], '_:http%3A%2F%2Fexample.test%2F%23SPORTSmapping_2');
      assert.equal((result[5]['http://mytestprefix.org/requires'] as NodeObject).length, 2);
    });

    it('template mapping XML.', async(): Promise<void> => {
      const options = { replace: true };
      const result = await parseFileTurtle(
        './test/assets/templateMappingXml/mapping.ttl',
        [ './test/assets/templateMappingXml/input.xml' ],
        './test/assets/templateMappingXml/out.json',
        options,
      ) as NodeObject[];
      assert.equal((result[0]['http://mytestprefix.org/name'] as NodeObject[])[0]['@id'], 'http://foo.com/1');
    });

    //* ******************CSV Tests

    it('CSV test.', async(): Promise<void> => {
      const options = { toRDF: true };
      const result = await parseFileTurtle(
        './test/assets/csvMappingTest/mapping.ttl',
        [ './test/assets/csvMappingTest/input.csv' ],
        './test/assets/csvMappingTest/out.nq',
        options,
      ).catch((err): void => {
        console.log(err);
      });
      assert.equal(result, '<http://example.com/Student10> <http://xmlns.com/foaf/0.1/name> "Venus Williams" .\n<http://example.com/Student12> <http://xmlns.com/foaf/0.1/name> "Bernd Marc" .\n');
    });

    it('CSV semi column.', async(): Promise<void> => {
      const options = {
        toRDF: true,
        csv: {
          delimiter: ';',
        },
      };
      const result = await parseFileTurtle(
        './test/assets/csvSemiColumn/mapping.ttl',
        [ './test/assets/csvSemiColumn/input.csv' ],
        './test/assets/csvSemiColumn/out.nq',
        options,
      ).catch((err): void => {
        console.log(err);
      });
      assert.equal(result, '<http://example.com/Student10> <http://xmlns.com/foaf/0.1/name> "Venus Williams" .\n<http://example.com/Student12> <http://xmlns.com/foaf/0.1/name> "Bernd Marc" .\n');
    });

    it('datatype test.', async(): Promise<void> => {
      let result = await parseFileTurtle(
        './test/assets/datatype/mapping.ttl',
        [ './test/assets/datatype/input.json' ],
        './test/assets/datatype/out.json',
        {},
      ) as NodeObject[];
      assert.equal((result[0]['http://mytestprefix.org/name'] as NodeObject)['@value'], 'Tom A.');
      assert.equal((result[0]['http://mytestprefix.org/name'] as NodeObject)['@type'], 'http://www.w3.org/2001/XMLSchema#string');
      assert.equal((result[0]['http://mytestprefix.org/age'] as NodeObject)['@value'], '15');
      assert.equal((result[0]['http://mytestprefix.org/age'] as NodeObject)['@type'], 'http://www.w3.org/2001/XMLSchema#integer');
      assert.equal((result[0]['http://mytestprefix.org/url'] as NodeObject)['@value'], 'http://example.com/foo');
      assert.equal((result[0]['http://mytestprefix.org/url'] as NodeObject)['@type'], 'http://www.w3.org/2001/XMLSchema#anyURI');

      const stringResult = await parseFileTurtle(
        './test/assets/datatype/mapping.ttl',
        [ './test/assets/datatype/input.json' ],
        './test/assets/datatype/out.nq',
        { toRDF: true },
      ) as string;

      assert.equal(stringResult, [
        `_:b0 <http://mytestprefix.org/age> "15"^^<http://www.w3.org/2001/XMLSchema#integer> .`,
        `_:b0 <http://mytestprefix.org/name> "Tom A." .`,
        `_:b0 <http://mytestprefix.org/url> "http://example.com/foo"^^<http://www.w3.org/2001/XMLSchema#anyURI> .`,
        `_:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://mytestprefix.org/Person> .`,
        '',
      ].join('\n'));

      result = await parseFileTurtle(
        './test/assets/datatype/mapping.ttl',
        [ './test/assets/datatype/input.json' ],
        './test/assets/datatype/out.json',
        { compact: { xsd: 'http://www.w3.org/2001/XMLSchema#' }},
      ) as NodeObject[];

      assert.equal((result[0]['http://mytestprefix.org/name'] as NodeObject)['@type'], 'xsd:string');
      assert.equal((result[0]['http://mytestprefix.org/age'] as NodeObject)['@type'], 'xsd:integer');
      assert.equal((result[0]['http://mytestprefix.org/url'] as NodeObject)['@type'], 'xsd:anyURI');
    });

    // ******************* MISC
    it('pathJsonJoin.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/pathJsonJoin/mapping.ttl',
        [ './test/assets/pathJsonJoin/input.json' ],
        './test/assets/pathJsonJoin/out.json',
        { replace: true },
      ) as NodeObject[];
      assert.deepEqual(result[0], {
        '@type': 'http://mytestprefix.org/Hotel',
        'http://mytestprefix.org/name': 'Hotel A',
        'http://mytestprefix.org/path': '/0/name',
        'http://mytestprefix.org/path2': '/0',
        '@id': '_:http%3A%2F%2Fexample.test%2F%23Mapping_1',
        'http://mytestprefix.org/geo': {
          '@type': 'http://mytestprefix.org/GeoCoordinates',
          'http://mytestprefix.org/elevation': '1500m',
          '@id': '_:http%3A%2F%2Fexample.test%2F%23Elevation_1',
        },
      });
    });

    it('pathXmlJoin.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/pathXmlJoin/mapping.ttl',
        [ './test/assets/pathXmlJoin/input.xml' ],
        './test/assets/pathXmlJoin/out.json',
        { replace: true },
      ) as NodeObject[];
      assert.deepEqual(result[0], {
        '@type': 'http://mytestprefix.org/Hotel',
        'http://mytestprefix.org/name': 'Hotel A',
        '@id': '_:http%3A%2F%2Fexample.test%2F%23Mapping_1',
        'http://mytestprefix.org/geo': {
          '@type': 'http://mytestprefix.org/GeoCoordinates',
          'http://mytestprefix.org/elevation': '1500m',
          '@id': '_:http%3A%2F%2Fexample.test%2F%23Elevation_1',
        },
      });
    });

    it('pathCsvJoin.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/pathCsvJoin/mapping.ttl',
        [ './test/assets/pathCsvJoin/input.csv' ],
        './test/assets/pathCsvJoin/out.json',
        { replace: true },
      ) as NodeObject[];
      assert.deepEqual(result[0], {
        '@type': 'http://mytestprefix.org/Hotel',
        'http://mytestprefix.org/name': 'Hotel A',
        'http://mytestprefix.org/path': '0',
        'http://mytestprefix.org/path2': '0',
        '@id': '_:http%3A%2F%2Fexample.test%2F%23Mapping_1',
        'http://mytestprefix.org/geo': {
          '@type': 'http://mytestprefix.org/GeoCoordinates',
          'http://mytestprefix.org/elevation': '1500m',
          '@id': '_:http%3A%2F%2Fexample.test%2F%23Elevation_1',
        },
      });
    });

    it('escapedXml.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/escapedXml/mapping.ttl',
        [ './test/assets/escapedXml/input.xml' ],
        './test/assets/escapedXml/out.json',
        { replace: true, xpathLib: 'fontoxpath' },
      ) as NodeObject[];
      assert.deepEqual(result, [
        {
          '@type': 'http://mytestprefix.org/Person',
          'http://mytestprefix.org/name': 'Tom A.',
          '@id': '_:http%3A%2F%2Fexample.test%2F%23Mapping_1',
        },
        {
          '@type': 'http://mytestprefix.org/Person',
          'http://mytestprefix.org/name': 'Tom B.',
          '@id': '_:http%3A%2F%2Fexample.test%2F%23Mapping_2',
        },
      ]);
    });

    it('doubleJoinCondition.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/doubleJoinCondition/mapping.ttl',
        [ './test/assets/doubleJoinCondition/data.csv', './test/assets/doubleJoinCondition/data2.csv' ],
        './test/assets/doubleJoinCondition/out.json',
        { replace: true },
      );
      assert.deepEqual(result, [
        {
          '@id': 'http://example.com/1',
          '@type': 'http://www.example.com/Example',
          'http://www.example.com/relation': { '@id': 'http://second-example.com/1' },
        },
        {
          '@id': 'http://example.com/2',
          '@type': 'http://www.example.com/Example',
          'http://www.example.com/relation': { '@id': 'http://second-example.com/2' },
        },
        {
          '@id': 'http://example.com/3',
          '@type': 'http://www.example.com/Example',
          'http://www.example.com/relation': { '@id': 'http://second-example.com/3' },
        },
      ]);
    });

    it('subject as functionMapping.', async(): Promise<void> => {
      let i = 0;
      const options = {
        functions: {
          'http://example.com/UUID'(): string {
            i += 1;
            return `http://example.com/${i}`;
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/subjFuncMap/mapping.ttl',
        [ './test/assets/subjFuncMap/input.json' ],
        './test/assets/subjFuncMap/out.json',
        options,
      ) as NodeObject[];

      assert.equal(result[0]['@id'], 'http://example.com/1');
      assert.equal(result[1]['@id'], 'http://example.com/2');
    });

    it('constant Iri.', async(): Promise<void> => {
      let i = 0;
      const options = {
        functions: {
          'http://example.com/UUID'(): string {
            i += 1;
            return `http://example.com/${i}`;
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/constantIri/mapping.ttl',
        [ './test/assets/constantIri/input.json' ],
        './test/assets/constantIri/out.json',
        options,
      ) as NodeObject[];
      assert.deepEqual(result[0]['http://mytestprefix.org/url'], { '@id': 'http://ex.com' });
      assert.equal(result[0]['@type'], 'http://type.com');
    });

    it('language.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/language/mapping.ttl',
        [ './test/assets/language/input.json' ],
        './test/assets/language/out.json',
        {},
      ) as NodeObject[];
      assert.deepStrictEqual((result[0]['https://schema.org/language'] as NodeObject[])[0], { '@value': 'John', '@language': 'en' });
      assert.deepStrictEqual((result[0]['https://schema.org/language'] as NodeObject[])[1], { '@value': 'John', '@language': 'de' });
      assert.deepStrictEqual((result[0]['https://schema.org/language'] as NodeObject[])[2], { '@value': 'John', '@language': 'de-DE' });
    });

    it('empty strings.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/emptyStrings/mapping.ttl',
        [ './test/assets/emptyStrings/input.json' ],
        './test/assets/emptyStrings/out.json',
        { ignoreEmptyStrings: true },
      ) as NodeObject[];

      const sorted = result.sort((
        aObj: NodeObject,
        bObj: NodeObject,
      ): number => aObj['@id']!.localeCompare(bObj['@id']!));

      assert.strictEqual(result.length, 4);

      assert.deepStrictEqual(sorted[0], {
        '@id': 'http://example.com/James',
        'https://schema.org/name': 'James',
        '@type': 'https://schema.org/Person',
      });
      assert.deepStrictEqual(sorted[1], {
        '@id': 'http://example.com/Jason',
        'https://schema.org/name': 'Jason',
        '@type': 'https://schema.org/Person',
      });
      assert.deepStrictEqual(sorted[2], {
        '@id': 'http://example.com/Jimathy',
        'https://schema.org/name': 'Jimathy',
        'https://schema.org/additionalName': 'Jarvis',
        '@type': 'https://schema.org/Person',
      });
      assert.deepStrictEqual(sorted[3], {
        '@id': 'http://example.com/John',
        'https://schema.org/name': 'John',
        'https://schema.org/familyName': 'Doe',
        '@type': 'https://schema.org/Person',
      });
    });

    it('ignore values.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/ignoreValues/mapping.ttl',
        [ './test/assets/ignoreValues/input.json' ],
        './test/assets/ignoreValues/out.json',
        { ignoreValues: [ '-' ]},
      ) as NodeObject[];

      const sorted = result.sort((
        aObj: NodeObject,
        bObj: NodeObject,
      ): number => aObj['@id']!.localeCompare(bObj['@id']!));

      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(sorted[0], {
        '@id': 'http://example.com/Jane',
        'https://schema.org/name': 'Jane',
        '@type': 'https://schema.org/Person',
      });
      assert.deepStrictEqual(sorted[1], {
        '@id': 'http://example.com/John',
        'https://schema.org/name': 'John',
        'https://schema.org/familyName': 'Doe',
        '@type': 'https://schema.org/Person',
      });
    });

    it('subjFuncMap 2.', async(): Promise<void> => {
      let i = 0;
      const options = {
        functions: {
          'http://myfunc.com/getId'([ str ]: string[]): string {
            i += 1;
            return `http://example.com/${i}/${str}`;
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/subjFuncMap2/mapping.ttl',
        [ './test/assets/subjFuncMap2/input.csv' ],
        './test/assets/subjFuncMap2/out.json',
        options,
      ) as NodeObject[];

      assert.equal(result[0]['@id'], 'http://example.com/1/Foo');
      assert.equal(result[1]['@id'], 'http://example.com/2/Bar');
    });

    it('IRI termType with Function Map.', async(): Promise<void> => {
      const options = {
        functions: {
          'http://myfunc.com/getId'([ str ]: string[]): string {
            return `http://example.com/${str}`;
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/iriTermTypeFuncMap/mapping.ttl',
        [ './test/assets/iriTermTypeFuncMap/input.json' ],
        './test/assets/iriTermTypeFuncMap/out.json',
        options,
      ) as NodeObject[];

      assert.equal(typeof result[0]['http://example.com/namesake'], 'object');
      assert.equal(typeof result[1]['http://example.com/namesake'], 'object');
      assert.equal((result[0]['http://example.com/namesake'] as ReferenceNodeObject)['@id'], 'http://example.com/John');
      assert.equal((result[1]['http://example.com/namesake'] as ReferenceNodeObject)['@id'], 'http://example.com/Jane');
    });

    it('blank node termType with Function Map.', async(): Promise<void> => {
      const options = {
        functions: {
          'http://myfunc.com/getId'([ str ]: string[]): string {
            return `special${str}`;
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/blankNodeTermTypeFuncMap/mapping.ttl',
        [ './test/assets/blankNodeTermTypeFuncMap/input.json' ],
        './test/assets/blankNodeTermTypeFuncMap/out.json',
        options,
      ) as NodeObject[];

      assert.equal(typeof result[0]['http://example.com/namesake'], 'object');
      assert.equal(typeof result[1]['http://example.com/namesake'], 'object');
      assert.equal((result[0]['http://example.com/namesake'] as ReferenceNodeObject)['@id'], '_:specialJohn');
      assert.equal((result[1]['http://example.com/namesake'] as ReferenceNodeObject)['@id'], '_:specialJane');
    });

    it('literal termType with Function Map.', async(): Promise<void> => {
      const options = {
        functions: {
          'http://myfunc.com/getId'([ str ]: string[]): string {
            return `Parent: ${str}`;
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/literalTermTypeFuncMap/mapping.ttl',
        [ './test/assets/literalTermTypeFuncMap/input.json' ],
        './test/assets/literalTermTypeFuncMap/out.json',
        options,
      ) as NodeObject[];

      assert.equal(result[0]['http://example.com/namesake'], 'Parent: John');
      assert.equal(result[1]['http://example.com/namesake'], 'Parent: Jane');
    });

    it('iriReference.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/iriReference/mapping.ttl',
        [ './test/assets/iriReference/input.json' ],
        './test/assets/iriReference/out.json',
      ) as NodeObject[];
      assert.deepEqual(result[0]['https://schema.org/reference'], { '@id': 'https://example.com/john' });
      assert.deepEqual(result[0]['https://schema.org/constant'], { '@id': 'https://example.com/john' });
      assert.deepEqual(result[0]['https://schema.org/template'], { '@id': 'https://example.com/john' });
    });

    it('subjectClassAndRdfType.', async(): Promise<void> => {
      const result = await parseFileTurtle(
        './test/assets/subjectClassAndRdfType/mapping.ttl',
        [ './test/assets/subjectClassAndRdfType/input.json' ],
        './test/assets/subjectClassAndRdfType/out.json',
      ) as NodeObject[];
      assert.equal((result[0]['@type'] as string[])[0], 'https://schema.org/Person');
      assert.equal((result[0]['@type'] as string[])[1], 'http://type.com');
    });

    it('nestedMappingInFunctionParameter.', async(): Promise<void> => {
      const options = {
        functions: {
          'http://example.com/sum_array_of_number_objects'(data: any): string {
            return data['http://example.com/input']
              .map((input: Record<string, NodeObject>): number =>
                Number.parseInt(input['http://example.com/number']['@value'] as string, 10))
              .reduce((sum: number, val: number): number => sum + val, 0);
          },
        },
      };
      const result = await parseFileTurtle(
        './test/assets/nestedMappingInFunctionParameter/mapping.ttl',
        [ './test/assets/nestedMappingInFunctionParameter/input.json' ],
        './test/assets/nestedMappingInFunctionParameter/out.json',
        options,
      ) as NodeObject[];
      assert.equal(result[0]['http://example.com/value'], 6);
    });
  });

  describe('with jsonld mappings', (): void => {
    it('Basic straight mapping.', async(): Promise<void> => {
      const result = await parseFileJsonLd(
        './test/assets/straightMapping/mapping.json',
        [ './test/assets/straightMapping/input.json' ],
        './test/assets/straightMapping/out.json',
      );
      const firstResult = cutArray(result) as NodeObject;
      assert.equal(firstResult['https://schema.org/name'], 'Tom A.');
      assert.equal(firstResult['https://schema.org/age'], 15);
      assert.equal(firstResult['@type'], 'https://schema.org/Person');
      assert.equal(Object.keys(firstResult).length, 4);
    });
  });
});
