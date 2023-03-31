const N3 = require('n3');
const jsonld = require('jsonld');
const helper = require('../input-parser/helper.js');
const { addArray } = require('../util/ArrayUtil');
const { RR, RML } = require('../util/Vocabulary');

const quadsToJsonLD = async (nquads) => {
  let doc = await jsonld.fromRDF(nquads, { format: 'application/n-quads' });
  doc = await jsonld.compact(doc, {});
  return doc;
};

const ttlToJson = ttl => new Promise((resolve, reject) => {
  const parser = new N3.Parser({ baseIRI: 'http://base.com/' });
  const writer = new N3.Writer({ format: 'N-Triples' });
  ttl = helper.escapeChar(ttl);
  parser.parse(ttl,
    (error, quad) => {
      if (error) {
        reject(error);
      } else if (quad) {
        writer.addQuad(quad);
      } else {
        writer.end(async (writeError, result) => {
          if (writeError) {
            reject(writeError);
            return;
          }
          try {
            const json = await quadsToJsonLD(result);
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      }
    });
});

function hasLogicalSource(e) {
  return RML.logicalSource in e;
}

function hasSubjectMap(e) {
  return RR.subjectMap in e;
}

function isFunction(e) {
  if (RR.predicateObjectMap in e) {
    const predicateObjectMap = addArray(e[RR.predicateObjectMap]);
    for (const obj of predicateObjectMap) {
      if (obj[RR.predicate] && obj[RR.predicate]['@id'] && obj[RR.predicate]['@id'].indexOf('executes') !== -1) {
        return true;
      }
      if (obj[RR.predicateMap] && obj[RR.predicateMap] && obj[RR.predicateMap]['@id']) {
        const predMap = obj[RR.predicateMap];
        if (predMap && predMap[RR.constant] && predMap[RR.constant]['@id'] && predMap[RR.constant]['@id'].indexOf('executes') !== -1) {
          return true;
        }
      }
    }
  }
  return false;
}


const getTopLevelMappings = (graphArray) => {
  const toplevelMappings = [];
  if (!graphArray || !graphArray.length) {
    // graphArray is not an array
    throw new Error('Error during processing mapfile: Wrong shape!');
  }
  graphArray.forEach((e) => {
    const id = e['@id'];
    if (hasLogicalSource(e) && !isFunction(e)) {
      if (!hasSubjectMap(e)) {
        throw new Error(`${id} is missing a subjectMap!`);
      }
      toplevelMappings.push(id);
    }
  });
  if (graphArray.length === 0) {
    // mapfile does not contain any toplevel mappings
    throw new Error('getTopLevelMappings(): Error during processing mapfile: no toplevel found! (only blank nodes)');
  }
  return toplevelMappings;
};

const bNodeIssuer = (prefix) => {
  let counter = 0;
  return () => `_:${prefix}${++counter}`;
};

const replaceConstantShortProps = (graph) => {
  const issuer = bNodeIssuer('re');
  const newNodes = [];
  for (const i in graph) {
    [RR.subject, RR.predicate, RR.object, RR.graph, RR.language].forEach((prop) => {
      if (graph[i][prop]) {
        if (Array.isArray(graph[i][prop])) {
          graph[i][prop].map((propValue) => {
            const bNodeId = issuer();
            newNodes.push({ '@id': bNodeId, [RR.constant]: propValue });
            if (`${prop}Map` in graph[i]) {
              graph[i][`${prop}Map`].push({ '@id': bNodeId })
            } else {
              graph[i][`${prop}Map`] = [{ '@id': bNodeId }];
            }
          });
        } else {
          const bNodeId = issuer();
          newNodes.push({ '@id': bNodeId, [RR.constant]: graph[i][prop] });
          graph[i][`${prop}Map`] = { '@id': bNodeId };
        }
        delete graph[i][prop];
      }
    });
  }
  graph.push(...newNodes);
};

module.exports.getTopLevelMappings = getTopLevelMappings;
module.exports.replaceConstantShortProps = replaceConstantShortProps;
module.exports.ttlToJson = ttlToJson;
