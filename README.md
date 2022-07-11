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


#### RML Vocabulary
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



#### Querying languages

The mapper supports XML, JSON and CSV as input format. For querying the data, [JSONPath](https://www.npmjs.com/package/jsonpath-plus) (json), [XPath](https://www.npmjs.com/package/xpath) (xml) and [csvjson](https://www.npmjs.com/package/csvjson) (csv) are used. Since JSON is supported natively by javascript, it has a huge speed benefit compared to XML.

Therefore, the mapper also contains a [C++ version](https://github.com/ThibaultGerrier/XpathIterator) (which uses [pugixml](https://pugixml.org/)) of the XML-parser which is disabled by default, but can be enabled via the options parameter `xpathLib: 'pugixml'`.

XPath 3.1 is available through [fontoxpath](https://www.npmjs.com/package/fontoxpath) and must be enabled through the option: `xpathLib: 'fontoxpath'`

### How it works

The `parse` function is the entry point of this library.
It takes an RML `mapping` serialized as turtle, and a collection of `inputFiles` keyed on the filename they represent in the mapping. Optionally, it accepts an `options` argument.

The function returns a promise, which resolves to the resulting output.

### The options parameter
```javascript
{
    // compact jsonld document with provided context
    // { http://schema.org/name:"Tom" }
    // ->
    // {
    //   @context:"http://schema.org/",
    //   name:"Tom"
    // }
    compress: {
      '@vocab': "http://schema.org/"
    },
    // If you want n-quads instead of json as output,
    // you need to define toRDF to true in the options parameter
    toRDF: true,
    // If you want to insert your all objects with their regarding @id's (to get a nesting in jsonld), "Un-flatten" jsonld
    replace: true,
    // You can delete namespaces to make the xpath simpler.
    removeNameSpace: {xmlns:"https://xmlnamespace.xml"},
    // Choose xpath evaluator library, available options: default | xpath (same as default) | pugixml (cpp xpath implementation, previously xmlPerformanceMode:true) | fontoxpath (xpath 3.1 engine)
    xpathLib: "default",
    // ignore input values that are empty string (or whitespace only) (only use a value from the input if value.trim() !== '') (default false)
    ignoreEmptyStrings: true,
    // values that are to be ignored from the input. E.g ignore all input values that are "-"
    ignoreValues: ["-"],
    // You can also use functions to manipulate the data while parsing. (E.g. Change a date to a ISO format, ..)
    functions : {**See the Functions section**}
    // Any options to parse the csv. available: delimiter - default ","
    csv: {
      delimiter: ";"
    }
}
```

#### Usage
```javascript
const parser = require('@comake/rmlmapper-js');

const mapping = `
  <#Mapping> rml:logicalSource [
    rml:source "input.json";
    rml:referenceFormulation ql:JSONPath;
    rml:iterator "$".
  ];
`;

const options = {
  toRDF: true,
  verbose: true,
  xmlPerformanceMode: false,
  replace: false,
};

const inputFiles = {
  'input.json': '{ "name": "Adler" }'
}

const result = await parser.parseFile(mapping, inputFiles, options);
```

## Example
Below there is shown a very simple example with no nesting and no array.

More can be seen in the tests folder

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
  @prefix rml: <http://semweb.mmlab.be/ns/rml#> .
  @prefix schema: <http://schema.org/> .
  @prefix ql: <http://semweb.mmlab.be/ns/ql#> .
  @base <http://sti2.at/> . #the base for the classes


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
This library also allows the user to define javascript functions beforehand and passes them through the options parameter. These functions can be used within an RML Mapping according to the [FNO specification](https://fno.io/rml/).

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
  @base <http://sti2.at/> . #the base for the classes


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
         ] .

```

where the option parameter looks like this:
```javascript
  let options={
        functions: {
            'http://users.ugent.be/~bjdmeest/function/grel.ttl#createDescription': function (data) {
                let result=data[0]+' is '+data[1]+ ' years old.';
                return result;
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
