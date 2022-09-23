const tags = require('language-tags');
const helper = require('./helper.js');
const { RR, RDF } = require('../util/Vocabulary');
const prefixhelper = require('../helper/prefixHelper.js');
const { FunctionExecutor } = require('../FunctionExecutor');
const { XmlParser } = require('./XmlParser');
const { JsonParser } = require('./JsonParser');
const { CsvParser } = require('./CsvParser');
const { FontoxpathParser } = require('./FontoxpathParser');

let count = 0;

/**
* Parser: the parser object
* data: the whole ttl mapfile in json
* currObject: the current object from the mapfile that is parsed
* prefixes: all prefixes,
* options: the options,
* ql: the querylanguage
*/
const parseFile = async (data, currObject, prefixes, source, iterator, options, queryLanguage) => {
  count = 0;
  const parser = createParser(queryLanguage, source, iterator, options);
  const functionExecutor = new FunctionExecutor({ parser, options, prefixes })
  const result = await iterateFile(functionExecutor, parser, data, currObject, prefixes);
  if (parser.free) {
    parser.free();
  }
  return result;
};

const createParser = (queryLanguage, source, iterator, options) => {
  switch (queryLanguage) {
    case 'XPath':
      if (options && options.xpathLib && options.xpathLib === 'fontoxpath') {
        return new FontoxpathParser(source, iterator, options);
      } else {
        return new XmlParser(source, iterator, options);
      }
    case 'JSONPath':
      return new JsonParser(source, iterator, options);
    case 'CSV':
      return new CsvParser(source, iterator, options);
    default:
      throw (`Cannot process: ${queryLanguage}`);
  }
}

const writeParentPath = (functionExecutor, index, parents, obj) => {
  if (!obj.$parentPaths && parents.length > 0) {
    obj.$parentPaths = {};
  }
  for (const parent of parents) {
    if (!obj.$parentPaths[parent]) {
      obj.$parentPaths[parent] = functionExecutor.getDataFromParser(index, parent);
    }
  }
};

const iterateFile = async (functionExecutor, parser, data, currObject, prefixes) => {
  const parents = [];
  for (const d of data) {
    if (d.parentTriplesMap && d.parentTriplesMap['@id'] === currObject['@id'] && d.joinCondition) {
      const joinCondition = d.joinCondition;
      const parentPaths = helper.addArray(joinCondition).map(({ parent }) => parent);
      parents.push(...parentPaths);
    }
  }
  // get subjectmapping
  const subjectMap = currObject.subjectMap;
  if (!subjectMap || Array.isArray(subjectMap)) {
    throw ('Error: exacltly one subjectMap needed!');
  }
  // get all possible things in subjectmap
  let type;
  if (subjectMap.class) {
    if (Array.isArray(subjectMap.class)) {
      type = [];
      subjectMap.class.forEach((sm) => {
        type.push(prefixhelper.replacePrefixWithURL(sm['@id'], prefixes));
      });
    } else {
      type = prefixhelper.replacePrefixWithURL(subjectMap.class['@id'], prefixes);
    }
  }
  const functionClassMap = (subjectMap.class && subjectMap.class.functionValue) ? subjectMap.class : undefined;

  let result = [];
  const iteratorNumber = parser.getCount();
  if (subjectMap.reference) {
    for (let i = 0; i < iteratorNumber; i++) {
      if (functionClassMap) {
        type = await functionExecutor.executeFunctionFromValue(functionClassMap.functionValue, i)
      }
      let obj = {};
      count++;
      let nodes = functionExecutor.getDataFromParser(i, subjectMap.reference);
      nodes = helper.addArray(nodes);
      // eslint-disable-next-line no-loop-func
      // needs to be done in sequence, since result.push() is done.
      // for await ()  is bad practice when we use it with something other than an asynchronous iterator - https://stackoverflow.com/questions/59694309/for-await-of-vs-promise-all
      for (let temp of nodes) {
        if (type) {
          obj['@type'] = type;
        }
        temp = helper.isURL(temp) ? temp : helper.addBase(temp, prefixes);
        if (temp.indexOf(' ') === -1) {
          obj['@id'] = temp;
          obj = await doObjectMappings(functionExecutor, i, currObject, prefixes, obj);

          if (!obj['@id']) {
            obj['@id'] = `${currObject['@id']}_${count}`;
          }
          writeParentPath(functionExecutor, i, parents, obj);
          result.push(obj);
        }
      }
    }
  } else if (subjectMap.template) {
    count++;
    for (let i = 0; i < iteratorNumber; i++) {
      if (functionClassMap) {
        type = await functionExecutor.executeFunctionFromValue(functionClassMap.functionValue, i);
      }
      let obj = {};
      const ids = calculateTemplate(functionExecutor, i, subjectMap.template, prefixes, undefined);
      for (let id of ids) {
        if (subjectMap.termType) {
          const template = prefixhelper.replacePrefixWithURL(subjectMap.termType['@id'], prefixes);
          switch (template) {
            case RR.BlankNode:
              id = `_:${id}`;
              break;
            case RR.IRI:
              if ((!subjectMap.template && !subjectMap.reference) || (subjectMap.template && subjectMap.reference)) {
                throw ('Must use exactly one of - rr:template and rr:reference in SubjectMap!');
              }
              if (!helper.isURL(id)) {
                id = helper.addBase(id, prefixes);
              }
              break;
            case RR.Literal:
              break;
            default:
              throw (`Don't know: ${subjectMap.termType['@id']}`);
          }
        }
        obj['@id'] = id;
        if (type) {
          obj['@type'] = type;
        }
        obj = await doObjectMappings(functionExecutor, i, currObject, prefixes, obj);
        if (!obj['@id']) {
          obj['@id'] = `${currObject['@id']}_${count}`;
        }
        writeParentPath(functionExecutor, i, parents, obj);
        result.push(obj);
      }
    }
  } else if (subjectMap.functionValue) {
    for (let i = 0; i < iteratorNumber; i++) {
      count++;
      let obj = {};
      const subjVal = await functionExecutor.executeFunctionFromValue(subjectMap.functionValue, i);
      obj['@id'] = subjVal;
      if (type) {
        obj['@type'] = type;
      }
      obj = await doObjectMappings(functionExecutor, i, currObject, prefixes, obj);
      writeParentPath(functionExecutor, i, parents, obj);
      result.push(obj);
    }
  } else if (subjectMap.constant || (
    subjectMap.termType
    && prefixhelper.replacePrefixWithURL(subjectMap.termType['@id'], prefixes) === RR.BlankNode
  )) {
    // BlankNode with no template or id
    for (let i = 0; i < iteratorNumber; i++) {
      if (functionClassMap) {
        type = await functionExecutor.executeFunctionFromValue(functionClassMap.functionValue, i);
      }
      count++;
      let obj = {};
      if (subjectMap.constant) {
        obj['@id'] = helper.getConstant(subjectMap.constant, prefixes);
      }
      if (type) {
        obj['@type'] = type;
      }
      obj = await doObjectMappings(functionExecutor, i, currObject, prefixes, obj);
      if (!obj['@id']) {
        obj['@id'] = `_:${encodeURIComponent(`${currObject['@id']}_${count}`)}`;
      }
      writeParentPath(functionExecutor, i, parents, obj);
      result.push(obj);
    }
  } else {
    throw new Error('Unsupported subjectmap');
  }

  result = helper.cutArray(result);
  return result;
};

const doObjectMappings = async (functionExecutor, index, currObject, prefixes, obj) => {
  if (currObject.predicateObjectMap) {
    let objectMapArray = currObject.predicateObjectMap;
    objectMapArray = helper.addArray(objectMapArray);
    for (const mapping of objectMapArray) {
      const predicate = helper.getPredicate(mapping, prefixes);
      if (Array.isArray(predicate)) {
        for (const p of predicate) {
          await handleSingleMapping(functionExecutor, index, obj, mapping, p, prefixes);
        }
      } else {
        await handleSingleMapping(functionExecutor, index, obj, mapping, predicate, prefixes);
      }
    }
  }
  obj = helper.cutArray(obj);
  return obj;
};

const useLanguageMap = (functionExecutor, index, termMap, prefixes) => {
  if (termMap.constant) {
    return termMap.constant;
  }
  if (termMap.reference) {
    const vals = functionExecutor.getDataFromParser(index, termMap.reference);
    return helper.addArray(vals)[0];
  }
  if (termMap.template) {
    const temp = calculateTemplate(functionExecutor, index, termMap.template, prefixes, undefined);
    return helper.addArray(temp)[0];
  }
  throw new Error('TermMap has neither constant, reference or template');
};

const handleSingleMapping = async (functionExecutor, index, obj, mapping, predicate, prefixes) => {
  predicate = prefixhelper.replacePrefixWithURL(predicate, prefixes);
  let object;
  if (mapping.object) {
    object = {
      '@id': prefixhelper.replacePrefixWithURL(mapping.object['@id'], prefixes),
    };
  }
  const objectmaps = [];
  if (mapping.objectMap) {
    if (Array.isArray(mapping.objectMap)) {
      for (const t of mapping.objectMap) {
        objectmaps.push(t);
      }
    } else {
      objectmaps.push(mapping.objectMap);
    }
  }

  if (object) {
    helper.addToObj(obj, predicate, object);
  } else {
    await Promise.all(
      objectmaps.map(async (objectmap) => {
        const reference = objectmap.reference;
        let constant = objectmap.constant;
        let language = objectmap.language;
        const datatype = helper.isURL(objectmap.datatype) ? objectmap.datatype : prefixhelper.replacePrefixWithURL(objectmap.datatype, prefixes);
        const template = objectmap.template;
        let termtype = objectmap.termType;

        if (objectmap.languageMap) {
          language = useLanguageMap(functionExecutor, index, objectmap.languageMap, prefixes);
        }

        if (language) {
          if (!tags(language).valid()) {
            throw (`Language tag: ${language} invalid!`);
          }
        }

        const functionValue = objectmap.functionValue;
        if (template) {
          // we have a template definition
          const temp = calculateTemplate(functionExecutor, index, template, prefixes, termtype);
          temp.forEach((t) => {
            if (termtype) {
              termtype = prefixhelper.replacePrefixWithURL(termtype, prefixes);
              switch (termtype) {
                case RR.BlankNode:
                  t = {
                    '@id': `_:${t}`,
                  };
                  break;
                case RR.IRI:
                  if (!helper.isURL(t)) {
                    t = {
                      '@id': helper.addBase(t, prefixes),
                    };
                  } else {
                    t = {
                      '@id': t,
                    };
                  }
                  break;
                case RR.Literal:
                  break;
                default:
                  throw (`Don't know: ${termtype['@id']}`);
              }
            } else {
              t = {
                '@id': t,
              };
            }
            t = helper.cutArray(t);
            helper.setObjPredicate(obj, predicate, t, language, datatype);
          });
        } else if (reference) {
          // we have a reference definition
          let ns = functionExecutor.getDataFromParser(index, reference);
          let arr = [];
          ns = helper.addArray(ns);
          ns.forEach((n) => {
            arr.push(n);
          });
          if (prefixhelper.replacePrefixWithURL(termtype, prefixes) === RR.IRI) {
            arr = arr.map((val) => {
              if (!helper.isURL(val)) {
                return {
                  '@id': helper.addBase(val, prefixes),
                };
              }
              return {
                '@id': val,
              };
            });
          }
          if (arr && arr.length > 0) {
            arr = helper.cutArray(arr);
            helper.setObjPredicate(obj, predicate, arr, language, datatype);
          }
        } else if (constant) {
          // we have a constant definition
          constant = helper.cutArray(constant);
          constant = helper.getConstant(constant, prefixes);

          if (prefixhelper.replacePrefixWithURL(predicate, prefixes) !== RDF.type && termtype && prefixhelper.replacePrefixWithURL(termtype, prefixes) === RR.IRI) {
            if (!helper.isURL(constant)) {
              constant = {
                '@id': helper.addBase(constant, prefixes),
              };
            } else {
              constant = {
                '@id': constant,
              };
            }
          }
          helper.setObjPredicate(obj, predicate, constant, language, datatype);
        } else if (objectmap.parentTriplesMap && objectmap.parentTriplesMap['@id']) {
          // we have a parentTriplesmap

          if (!obj.$parentTriplesMap) {
            obj.$parentTriplesMap = {};
          }
          if (objectmap.joinCondition) {
            const joinConditions = helper.addArray(objectmap.joinCondition);

            if (!obj.$parentTriplesMap[predicate]) {
              obj.$parentTriplesMap[predicate] = [];
            }
            obj.$parentTriplesMap[predicate].push({
              joinCondition: joinConditions.map((cond) => ({
                parentPath: cond.parent,
                child: functionExecutor.getDataFromParser(index, cond.child),
              })),
              mapID: objectmap['@id'],
            });
          } else if (obj.$parentTriplesMap[predicate]) {
            obj.$parentTriplesMap[predicate].push({
              mapID: objectmap['@id'],
            });
          } else {
            obj.$parentTriplesMap[predicate] = [];
            obj.$parentTriplesMap[predicate].push({
              mapID: objectmap['@id'],
            });
          }
        } else if (functionValue) {
          const result = await functionExecutor.executeFunctionFromValue(functionValue, index);
          helper.setObjPredicate(obj, predicate, result, language, datatype);
        }
      })
    );
  }
};

const calculateTemplate = (functionExecutor, index, template, prefixes, termType) => {
  if (termType) {
    termType = prefixhelper.replacePrefixWithURL(termType, prefixes);
  }

  const beg = helper.locations('{', template);
  const end = helper.locations('}', template);
  const words = [];
  const toInsert = [];
  const templates = [];
  if (beg.length === 0 || beg.length !== end.length) {
    return [template];
  }
  for (const i in beg) {
    words.push(template.substr(beg[i] + 1, end[i] - beg[i] - 1));
  }
  words.forEach((w) => {
    const temp = helper.addArray(functionExecutor.getDataFromParser(index, w));
    toInsert.push(temp);
  });
  const allComb = helper.allPossibleCases(toInsert);
  for (const combin in allComb) {
    let finTemp = template;
    for (const found in allComb[combin]) {
      if (!termType || termType !== RR.Literal) {
        allComb[combin][found] = helper.toURIComponent(allComb[combin][found]);
      }
      finTemp = finTemp.replace(`{${words[found]}}`, allComb[combin][found]);
    }
    templates.push(finTemp);
  }
  for (const t in templates) {
    templates[t] = helper.replaceEscapedChar(prefixhelper.replacePrefixWithURL(templates[t], prefixes));
  }
  return templates;
};

module.exports.parseFile = parseFile;
