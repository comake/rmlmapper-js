const { addArray } = require('../util/ArrayUtil');
const dom = require('@xmldom/xmldom').DOMParser;
const prefixHelper = require('../helper/prefixHelper.js');

const cleanString = (path) => {
  if (path.startsWith('.') || path.startsWith('/')) {
    path = path.substr(1);
  }
  return path;
};

const setObjPredicate = (obj, predicate, dataSet, language, datatype) => {
  dataSet = addArray(dataSet);
  for (const data of dataSet) {
    if (data === undefined) {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (datatype) {
      datatype = datatype['@id'] ? datatype['@id'] : datatype;
    }
    if (language || datatype) {
      if (obj[predicate]) {
        const newObj = {
          '@type': datatype,
          '@value': data,
          '@language': language,
        };
        if (typeof obj[predicate] === 'object' && obj[predicate]['@value']) {
          const temp = obj[predicate];
          obj[predicate] = [];
          obj[predicate].push(temp);
          obj[predicate].push(newObj);
        } else if (Array.isArray(obj[predicate])) {
          obj[predicate].push(newObj);
        } else {
          const temp = {
            '@value': obj[predicate],
          };
          obj[predicate] = [];
          obj[predicate].push(temp);
          obj[predicate].push(newObj);
        }
      } else {
        obj[predicate] = {};
        obj[predicate]['@value'] = data;
        obj[predicate]['@type'] = datatype;
        obj[predicate]['@language'] = language;
      }
    } else if (obj[predicate]) {
      obj[predicate] = addArray(obj[predicate]);
      obj[predicate].push(data);
    } else {
      obj[predicate] = data;
    }
  }
};

const locations = (substring, string) => {
  const a = []; let i = -1;
  i = string.indexOf(substring, i + 1);
  while (i >= 0) {
    a.push(i);
    i = string.indexOf(substring, i + 1);
  }
  return a;
};

const getConstant = (constant, prefixes) => {
  if (constant['@id']) {
    return prefixHelper.replacePrefixWithURL(constant['@id'], prefixes);
  }
  return constant;
};

const cutArray = (arr) => {
  if (arr.length === 1) {
    arr = arr[0];
  }
  return arr;
};

const addToObj = (obj, pred, data) => {
  if (obj[pred]) {
    const existingValueAsArray = addArray(obj[pred]);
    const dataAsArray = addArray(data);
    obj[pred] = [...existingValueAsArray, ...dataAsArray ];
  } else {
    obj[pred] = data;
  }
};

const addToObjInId = (obj, pred, data) => {
  const dataAsNode = { '@id': data };
  if (obj[pred]) {
    if (!Array.isArray(obj[pred])) {
      obj[pred] = [ obj[pred], dataAsNode ];
    } else {
      obj[pred].push(dataAsNode);
    }
  } else {
    obj[pred] = dataAsNode;
  }
};

const readFileStringSimple = (source, options) => {
  if (options && options.inputFiles && options.inputFiles[source]) {
    return options.inputFiles[source];
  }
  throw (`File ${source} not specified!`);
};

const readFileJSONSimple = (source, options) => {
  const jsonStr = readFileStringSimple(source, options);
  const jsonObj = JSON.parse(jsonStr);
  return jsonObj;
};

const readFileXMLSimple = (source, options) => {
  let xmlStr = readFileStringSimple(source, options);
  if (options && options.removeNameSpace) {
    // remove namespace from data
    for (const key in options.removeNameSpace) {
      const toDelete = `${key}="${options.removeNameSpace[key]}"`;
      xmlStr = xmlStr.replace(toDelete, '');
    }
  }
  const doc = new dom().parseFromString(xmlStr);
  return doc;
};

const withCache = (fn, source, options) => {
  if (!options.cache) {
    options.cache = {};
  }
  if (options.cache[source]) {
    return options.cache[source];
  }
  const result = fn(source, options);
  options.cache[source] = result;
  return result;
};

const readFileJSON = (source, options) => withCache(readFileJSONSimple, source, options);

const readFileXML = (source, options) => withCache(readFileXMLSimple, source, options);

const readFileCSV = (source, options) => withCache(readFileStringSimple, source, options);

const readFileString = (source, options) => withCache(readFileStringSimple, source, options);

/* const pattern = new RegExp('^(https?:\\/\\/)?'
        + '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'
        + '((\\d{1,3}\\.){3}\\d{1,3}))'
        + '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'
        + '(\\?[;&a-z\\d%_.~+=-]*)?'
        + '(\\#[-a-z\\d_]*)?$', 'i'); */
const isURL = (str) => /\w+:(\/\/)[^\s]+/.test(str);
const addBase = (str, prefixes) => prefixes.base + str;

const escapeChar = (str) => {
  str = replaceAll(str, '\\\\{', '#replaceOpenBr#');
  str = replaceAll(str, '\\\\}', '#replaceClosingBr#');
  return str;
};

const allPossibleCases = (arr) => {
  if (arr.length === 0) {
    return [];
  }
  if (arr.length === 1) {
    return arr[0].map((e) => [e]);
  }
  const result = [];
  const allCasesOfRest = allPossibleCases(arr.slice(1)); // recur with the rest of array
  for (let i = 0; i < allCasesOfRest.length; i++) {
    for (let j = 0; j < arr[0].length; j++) {
      result.push([arr[0][j], ...allCasesOfRest[i]]);
    }
  }
  return result;
};

const replaceEscapedChar = (str) => {
  str = replaceAll(str, '#replaceOpenBr#', '{');
  str = replaceAll(str, '#replaceClosingBr#', '}');
  return str;
};

const replaceAll = (str, search, replacement) => str.replace(new RegExp(search, 'g'), replacement);

const toURIComponent = (str) => {
  str = encodeURIComponent(str);
  str = str.replace(/\(/g, '%28');
  str = str.replace(/\)/g, '%29');
  return str;
};

const getPredicate = (mapping, prefixes) => {
  let predicate;
  if (mapping.predicate) {
    if (Array.isArray(mapping.predicate)) {
      predicate = [];
      mapping.predicate.forEach((pre) => {
        predicate.push(prefixHelper.replacePrefixWithURL(pre['@id'], prefixes));
      });
    } else {
      predicate = prefixHelper.replacePrefixWithURL(mapping.predicate['@id'], prefixes);
    }
  } else if (mapping.predicateMap) {
    // in predicateMap only constant allowed
    if (Array.isArray(mapping.predicateMap)) {
      predicate = [];
      for (let temp of mapping.predicateMap) {
        temp = temp.constant['@id'];
        predicate.push(temp);
      }
    } else {
      predicate = mapping.predicateMap;
      predicate = getConstant(predicate.constant, prefixes);
    }
  } else {
    throw ('Error: no predicate specified!');
  }
  return predicate;
};

const intersection = (arrOfArr) => arrOfArr.reduce((a, b) => a.filter((c) => b.includes(c)));

module.exports.escapeChar = escapeChar;
module.exports.allPossibleCases = allPossibleCases;
module.exports.toURIComponent = toURIComponent;
module.exports.replaceEscapedChar = replaceEscapedChar;
module.exports.cleanString = cleanString;
module.exports.locations = locations;
module.exports.cutArray = cutArray;
module.exports.addToObj = addToObj;
module.exports.addToObjInId = addToObjInId;
module.exports.readFileJSON = readFileJSON;
module.exports.readFileCSV = readFileCSV;
module.exports.readFileXML = readFileXML;
module.exports.readFileString = readFileString;
module.exports.isURL = isURL;
module.exports.addBase = addBase;
module.exports.getConstant = getConstant;
module.exports.setObjPredicate = setObjPredicate;
module.exports.getPredicate = getPredicate;
module.exports.intersection = intersection;
