require('colors');

const testFolder = './test/assets/RMLio-testCases';
const fs = require('fs');
const jsdiff = require('diff');
const parser = require('../../../dist/index.js');

const createOutputs = () => {
  fs.readdirSync(testFolder).forEach(async (file) => {
    const options = { toRDF: true };
    const result = await parser.parse(`./test/assets/RMLio-testCases/${file}/mapping.ttl`, `./test/assets/RMLio-testCases/${file}/out.nq`, options).catch((err) => {
      console.log(err);
    });
    // console.log(result);
  });
};


const sortRDF = rdf => rdf.trim().split('\n').map(line => line.trim().replace('".', '" .').replace(/\s+/g, '')).filter(line => !line.startsWith('#'))
  .sort()
  .join('\n');

const isEqualRdf = (a, b) => {
  const a1 = sortRDF(a);
  const b1 = sortRDF(b);
  if (a1 !== b1) {
    const diff = jsdiff.diffLines(a1, b1);
    diff.forEach((part) => {
      const color = part.added ? 'green'
        : part.removed ? 'red' : 'grey';
      process.stderr.write(part.value[color]);
    });
    console.log();
  }
  return a1 === b1;
};

const printDiff = () => {
  fs.readdirSync('./test/assets/RMLio-testCases')
  // .slice(0, 60)
    .filter(filename => filename.endsWith('-CSV') || filename.endsWith('-JSON') || filename.endsWith('-XML'))
    .forEach((filename) => {
      try {
        const rmljava = fs.readFileSync(`./test/assets/RMLio-testCases/${filename}/output.nq`, 'utf-8');
        const rmlnode = fs.readFileSync(`./test/assets/RMLio-testCases/${filename}/out.nq`, 'utf-8');
        if (isEqualRdf(rmljava, rmlnode)) {
          console.log(`SUCCESS: ${filename}`);
        } else {
          console.log(`Failure: ${filename}`);
        }
      } catch (e) {
        // console.log(e);
        console.log(`No files:${filename}`);
      }
      // console.log(filename);
    });
};


const testSingle = async (dir, options) => {
  const result = await parser.parse(`./test/assets/RMLio-testCases/${dir}/mapping.ttl`, `./test/assets/RMLio-testCases/${dir}/out.json`, options).catch((err) => {
    console.log(err);
  });
  console.log(result);
};

createOutputs();
setTimeout(() => {
  printDiff();
}, 3000);

// testSingle('RMLTC0012d-XML');
