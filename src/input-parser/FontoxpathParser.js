const xpath = require('fontoxpath');
const { sync } = require('slimdom-sax-parser');

const helper = require('./helper.js');

xpath.registerCustomXPathFunction('fn:parse-xml', ['xs:string'], 'item()', (_, e) => sync(e));

class XMLParser {
  constructor(inputPath, iterator, options) {
    const doc = helper.readFileString(inputPath, options);
    this.docArray = xpath.evaluateXPathToNodes(iterator, sync(doc), null, null, { language: xpath.evaluateXPath.XPATH_3_1_LANGUAGE });
  }

  getCount() {
    return this.docArray.length;
  }

  getData(index, path) {
    if (path.startsWith('PATH~')) {
      path = `${path.slice(5)}/path()`;
    }
    const object = this.docArray[index];
    const strings = xpath.evaluateXPathToStrings(path, object, null, null, xpath.evaluateXPath.ANY_TYPE, { language: xpath.evaluateXPath.XPATH_3_1_LANGUAGE });
    return strings;
  }
}

module.exports = XMLParser;
