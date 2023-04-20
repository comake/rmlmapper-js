import type { NodeObject } from 'jsonld';
import jsonld from 'jsonld';
import type { Quad } from 'n3';
import { Parser, Writer } from 'n3';
import { escapeCurlyBrackets } from './UriUtil';

async function quadsToJsonLD(nquads: string): Promise<any> {
  const doc = await jsonld.fromRDF(nquads as any, { format: 'application/n-quads' });
  return await jsonld.compact(doc, {});
}

export async function ttlToJson(ttl: string): Promise<NodeObject> {
  return new Promise((resolve, reject): void => {
    const parser = new Parser({ baseIRI: 'http://base.com/' });
    const writer = new Writer({ format: 'N-Triples' });
    ttl = escapeCurlyBrackets(ttl);
    parser.parse(ttl, (error: Error, quad: Quad): void => {
      if (error) {
        reject(error);
      } else if (quad) {
        writer.addQuad(quad);
      } else {
        writer.end(async(writeError: Error, result: string): Promise<void> => {
          if (writeError) {
            reject(writeError);
            return;
          }
          try {
            const json = await quadsToJsonLD(result);
            resolve(json);
          } catch (jsonldError: unknown) {
            reject(jsonldError);
          }
        });
      }
    });
  });
}
