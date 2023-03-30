# rmlmapper-js

This library is a javascript implementation of a mapper for the [RDF mapping language (RML)](http://rml.io/spec.html).

As of now, this library is almost an exact copy of an old javascript RML mapper, [RocketRML](https://github.com/semantifyit/RocketRML). RocketRML is not actively maintained aside from occasional bug fixes and could benefit from improvements to code quality and the addition of typesafety (eg. via Typescript). To that effect, we are planning lots of refactoring and/or a complete rewrite of this library.

The major difference between this library and RocketRML is a change to make it browser compatible. This includes the removal of the dependency on Node.js native modules like `fs` and `path`.

## Installation

Via npm or yarn:

```shell
npm install @comake/rmlmapper-js
```
```shell
yarn add @comake/rmlmapper-js
```

## Support


⚠️ **Note**: The documentation below is directly copied from the RocketRML repo. Some of it may be out of date.


## RML Vocabulary
the following list contains the current supported classes.


    rr:TriplesMap is the class of triples maps as defined by R2RML.
    rml:LogicalSource is the class of logical sources.
    rr:SubjectMap is the class of subject maps.
    rr:PredicateMap is the class of predicate maps.
    rr:ObjectMap is the class of object maps.
    rr:PredicateObjectMap is the class of predicate-object maps.
    rr:RefObjectMap is the class of referencing object maps.
    rml:referenceFormulation is the class of supported reference formulations.
    rr:Join is the class of join conditions.

Missing:

    rr:R2RMLView is the class of R2RML views.
    rr:BaseTableOrView is the class of SQL base tables or views.
    rr:GraphMap is the class of graph maps.



## Querying languages

The mapper supports XML, JSON and CSV as input format. For querying the data, [JSONPath](https://www.npmjs.com/package/jsonpath-plus) (json), [XPath](https://www.npmjs.com/package/xpath) (xml) and [csvjson](https://www.npmjs.com/package/csvjson) (csv) are used. Since JSON is supported natively by javascript, it has a huge speed benefit compared to XML.

Therefore, the mapper also contains a [C++ version](https://github.com/ThibaultGerrier/XpathIterator) (which uses [pugixml](https://pugixml.org/)) of the XML-parser which is disabled by default, but can be enabled via the options parameter `xpathLib: 'pugixml'`.

XPath 3.1 is available through [fontoxpath](https://www.npmjs.com/package/fontoxpath) and must be enabled through the option: `xpathLib: 'fontoxpath'`

## How it works

This library has two main entry point functions: the `parseTurtle` function and the `parseJsonLd` function. There is also a deprecated `parse` function for backwards compatibility. It is an alias for `parseTurtle`.

#### `parseTurtle`

**Parameters**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `mapping` | `string` | Required | An RML Mapping serialized as a string in the [Turtle](https://www.w3.org/TR/turtle/) format. |
| `inputFiles` | `object` | Required | A collection of files keyed on the filename they represent in the mapping.  |
| `options` | `object` |   | A ParserOptions object (defined below). |

#### `parseJsonLd`

**Parameters**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `mapping` | `string` | Required | An RML Mapping serialized as a JSON object in the [JSON-LD](https://json-ld.org/) format. |
| `inputFiles` | `object` | Required | A collection of files keyed on the filename they represent in the mapping.  |
| `options` | `object` |   | A ParserOptions object (defined below). |


Both `parseTurtle` and `parseJsonLd` return a promise, which resolves to the resulting output.

**ParserOptions**

These are the available options for parsing mappings (in Typescript):

```typescript
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
```

## Usage

```typescript
import * as RmlParser from '@comake/rmlmapper-js';

const inputFiles = {
  'input.json': '{ "name": "Adler" }'
}

const options = {
  toRDF: true,
  replace: false,
};

const turtleMapping = `
  @prefix rr: <http://www.w3.org/ns/r2rml#> .
  @prefix rml: <http://semweb.mmlab.be/ns/rml#> .
  @prefix ql: <http://semweb.mmlab.be/ns/ql#> .

  <#Mapping> rml:logicalSource [
    rml:source "input.json";
    rml:referenceFormulation ql:JSONPath;
    rml:iterator "$".
  ];
`;

const turtleMappingResult = await parser.parseTurtle(turtleMapping, inputFiles, options);

const jsonLdMapping = {
  '@id': 'https://example.com/#Mapping',
  '@type': 'http://www.w3.org/ns/r2rml#TriplesMap',
  'http://semweb.mmlab.be/ns/rml#logicalSource': {
    'http://semweb.mmlab.be/ns/rml#source': 'input.json',
    'http://semweb.mmlab.be/ns/rml#referenceFormulation': 'http://semweb.mmlab.be/ns/ql#JSONPath',
    'http://semweb.mmlab.be/ns/rml#iterator': '$'
  }
}

const jsonLdMappingResult = await parser.parseJsonLd(jsonLdMapping, inputFiles, options);
```

## Example
Below there is shown a very simple example with no nested data and no arrays.

Additional examples can be seen in the tests folder.

#### Input

```json
{
  "name":"Tom A.",
  "age":15
}
```


#### Turtle mapfile

```ttl
@prefix rr: <http://www.w3.org/ns/r2rml#> .
@prefix rml: <http://semweb.mmlab.be/ns/rml#> .
@prefix schema: <http://schema.org/> .
@prefix ql: <http://semweb.mmlab.be/ns/ql#> .

<#LOGICALSOURCE>
  rml:source "input.json";
  rml:referenceFormulation ql:JSONPath;
  rml:iterator "$".

<#Mapping>
  rml:logicalSource <#LOGICALSOURCE>;

  rr:subjectMap [
    rr:termType rr:BlankNode;
    rr:class schema:Person;
  ];

  rr:predicateObjectMap [
      rr:predicate schema:name;
      rr:objectMap [ rml:reference "name" ];
  ];

  rr:predicateObjectMap [
      rr:predicate schema:age;
      rr:objectMap [ rml:reference "age" ];
  ].

```

#### Output
```json
[{
  "@type": "http://schema.org/Person",
  "http://schema.org/name": "Tom A.",
  "http://schema.org/age": 15
}]
```

## Functions:
This library also allows the user to define javascript functions beforehand and pass them through the options parameter. These functions can be used within an RML Mapping according to the [FNO specification](https://fno.io/rml/).

An example how this works can be seen below:

#### Input


```json
{
  "name":"Tom A.",
  "age":15
}
```


#### Turtle mapfile

The mapfile must also specify the input source path.

```ttl
@prefix rr: <http://www.w3.org/ns/r2rml#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rml: <http://semweb.mmlab.be/ns/rml#> .
@prefix schema: <http://schema.org/> .
@prefix ql: <http://semweb.mmlab.be/ns/ql#> .
@prefix fnml: <http://semweb.mmlab.be/ns/fnml#> .
@prefix fno: <http://w3id.org/function/ontology#> .
@prefix grel: <http://users.ugent.be/~bjdmeest/function/grel.ttl#> .

<#LOGICALSOURCE>
  rml:source "input.json";
  rml:referenceFormulation ql:JSONPath;
  rml:iterator "$".

<#Mapping>
  rml:logicalSource <#LOGICALSOURCE>;

  rr:subjectMap [
    rr:termType rr:BlankNode;
    rr:class schema:Person;
  ];

  rr:predicateObjectMap [
    rr:predicate schema:name;
    rr:objectMap [ rml:reference "name" ];
  ];

  rr:predicateObjectMap [
    rr:predicate schema:description;
    rr:objectMap  <#FunctionMap>;
  ].

<#FunctionMap>
  fnml:functionValue [
    rml:logicalSource <#LOGICALSOURCE> ;
    rr:predicateObjectMap [
      rr:predicate fno:executes ;
      rr:objectMap [ rr:constant grel:createDescription ]
    ] ;
    rr:predicateObjectMap [
      rr:predicate grel:inputString ;
      rr:objectMap [ rml:reference "name" ]
    ];
    rr:predicateObjectMap [
      rr:predicate grel:inputString ;
      rr:objectMap [ rml:reference "age" ]
    ];
  ].

```

where the option parameter looks like this:
```typescript
  const options = {
    functions: {
      'http://users.ugent.be/~bjdmeest/function/grel.ttl#createDescription': (data) => {
        return `${data[0]} is ${data[1]} years old.`;
      }
    }
  };
```

#### Output
```json

[{
  "@type": "http://schema.org/Person",
  "http://schema.org/name": "Tom A.",
  "http://schema.org/description": "Tom A. is 15 years old."
}]
```

#### Description
According to the [FNO specification](https://fno.io/rml/) a `FunctionMap` has an array of `predicateObjectMaps`. One of the `predicateObjectMaps` defines the function with `fno:executes` and the name of the function in `rr:constant`.
The other `predicateObjectMaps` specify the function parameters. The first parameter (`rml:reference: "name"`) is then stored in `data[0]`, the second in `data[1]` and so on.
