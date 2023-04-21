const { addArray } = require('../util/ArrayUtil');
const { RDF } = require('../util/Vocabulary');

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

const intersection = (arrOfArr) => arrOfArr.reduce((a, b) => a.filter((c) => b.includes(c)));

module.exports.allPossibleCases = allPossibleCases;
module.exports.locations = locations;
module.exports.addToObj = addToObj;
module.exports.addToObjInId = addToObjInId;
module.exports.setObjPredicate = setObjPredicate;
module.exports.intersection = intersection;
