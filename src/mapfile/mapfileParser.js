const { RR } = require('../util/Vocabulary');

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

module.exports.replaceConstantShortProps = replaceConstantShortProps;
