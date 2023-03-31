const { addArray } = require('../util/ArrayUtil');
const { RDF, XSD, RR } = require('../util/Vocabulary');

const cleanString = (path) => {
  if (path.startsWith('.') || path.startsWith('/')) {
    path = path.substr(1);
  }
  return path;
};

function setValueAtPredicate(obj, predicate, data, language, datatype) {
  if (language || datatype) {
    if (obj[predicate]) {
      const newValue = {
        '@type': datatype,
        '@value': data,
        '@language': language,
      };
      if (typeof obj[predicate] === 'object' && obj[predicate]['@value']) {
        const previousValue = obj[predicate];
        obj[predicate] = [];
        obj[predicate].push(previousValue);
        obj[predicate].push(newValue);
      } else if (Array.isArray(obj[predicate])) {
        obj[predicate].push(newValue);
      } else {
        const previousValue = {
          '@value': obj[predicate],
        };
        obj[predicate] = [];
        obj[predicate].push(previousValue);
        obj[predicate].push(newValue);
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

const setObjPredicate = (obj, predicate, dataSet, language, datatype) => {
  if (datatype) {
    datatype = datatype['@id'] ? datatype['@id'] : datatype;
  }
  if (datatype === RDF.JSON) {
    datatype = '@json';
  }

  if (datatype === '@json') {
    setValueAtPredicate(obj, predicate, dataSet, language, datatype);
  } else {
    dataSet = addArray(dataSet).filter((data) => data !== undefined);
    for (const data of dataSet) {
      setValueAtPredicate(obj, predicate, data, language, datatype);
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

const getConstant = (constant) => {
  if (typeof constant === 'object') {
    if ('@id' in constant) {
      return constant['@id'];
    }
    if ('@value' in constant) {
      if (constant['@type'] === XSD.integer) {
        return Number.parseInt(constant['@value'], 10);
      }
      if (constant['@type'] === XSD.double) {
        return Number.parseFloat(constant['@value'], 10);
      }
      if (constant['@type'] === XSD.boolean) {
        return constant['@value'] === true || constant['@value'] === 'true'
      }
      return constant['@value']
    }
  }
  return constant;
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

const getPredicate = (mapping) => {
  let predicate;
  if (mapping[RR.predicate]) {
    if (Array.isArray(mapping[RR.predicate])) {
      predicate = [];
      mapping[RR.predicate].forEach((pre) => {
        predicate.push(pre['@id']);
      });
    } else {
      predicate = mapping[RR.predicate]['@id'];
    }
  } else if (mapping[RR.predicateMap]) {
    // in predicateMap only constant allowed
    if (Array.isArray(mapping[RR.predicateMap])) {
      predicate = [];
      for (let temp of mapping[RR.predicateMap]) {
        temp = getConstant(temp[RR.constant]);
        predicate.push(temp);
      }
    } else {
      predicate = mapping[RR.predicateMap];
      predicate = getConstant(predicate[RR.constant]);
    }
  } else {
    throw new Error('Error: no predicate specified!');
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
module.exports.addToObj = addToObj;
module.exports.addToObjInId = addToObjInId;
module.exports.isURL = isURL;
module.exports.addBase = addBase;
module.exports.getConstant = getConstant;
module.exports.setObjPredicate = setObjPredicate;
module.exports.getPredicate = getPredicate;
module.exports.intersection = intersection;
