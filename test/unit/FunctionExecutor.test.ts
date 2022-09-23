/* eslint-disable @typescript-eslint/naming-convention */
import { FunctionExecutor } from '../../src/FunctionExecutor';
import type { Parser } from '../../src/input-parser/Parser';
import { FNO, GREL } from '../../src/util/Vocabulary';

describe('A FunctionExector', (): void => {
  describe('getting data from the parser', (): void => {
    const values = [ 'a', 'b', '' ];
    let parser: Parser;
    beforeEach(async(): Promise<void> => {
      parser = {
        getData: jest.fn().mockReturnValue(values),
      } as any;
    });

    it('returns data matching the query.', async(): Promise<void> => {
      const executor = new FunctionExecutor({
        parser,
        prefixes: {},
      });
      expect(executor.getDataFromParser(0, 'query')).toEqual([ 'a', 'b', '' ]);
    });
    it('removes empty strings if ignoreEmptyStrings is true.', async(): Promise<void> => {
      const executor = new FunctionExecutor({
        parser,
        prefixes: {},
        options: { ignoreEmptyStrings: true },
      });
      expect(executor.getDataFromParser(0, 'query')).toEqual([ 'a', 'b' ]);
    });
    it('does not return values in ignoreValues.', async(): Promise<void> => {
      const executor = new FunctionExecutor({
        parser,
        prefixes: {},
        options: { ignoreValues: [ 'a', 'b' ]},
      });
      expect(executor.getDataFromParser(0, 'query')).toEqual([ '' ]);
    });
  });

  describe('executing functions', (): void => {
    let parser: Parser;
    let executor: FunctionExecutor;
    let randomFunc: any;

    beforeEach(async(): Promise<void> => {
      parser = {
        getData: jest.fn().mockReturnValue('data'),
      } as any;
      randomFunc = jest.fn().mockReturnValue('abc123');
      executor = new FunctionExecutor({
        parser,
        prefixes: {},
        options: {
          functions: {
            'http://example.com#randomFunc': randomFunc,
          },
        },
      });
    });

    it('throws an error if the function name cannot be found.', async(): Promise<void> => {
      const functionValue = { predicateObjectMap: []};
      await expect(executor.executeFunctionFromValue(functionValue, 0))
        .rejects.toThrow('Failed to find function name in predicatePbjectMap');
    });

    it('throws an error if no object or object map is specified in a predicate object map.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicate: { '@id': FNO.executes },
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0))
        .rejects.toThrow('No object specified in PredicateObjectMap');
    });

    it('throws an error if the object map does not have a constant.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicate: { '@id': FNO.executes },
          objectMap: {},
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0))
        .rejects.toThrow('Object must be specified through constant');
    });

    it('throws an error if an array of functions are specified in one object map.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicate: { '@id': FNO.executes },
          objectMap: [
            { constant: { '@id': 'http://example.com#randomFunc' }},
            { constant: { '@id': 'http://example.com#randomFunc2' }},
          ],
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0))
        .rejects.toThrow('Only one function may be specified per PredicateObjectMap');
    });

    it('throws an error if an array functions are specified in one object.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicate: { '@id': FNO.executes },
          object: [
            { '@id': 'http://example.com#randomFunc' },
            { '@id': 'http://example.com#randomFunc2' },
          ],
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0))
        .rejects.toThrow('Only one function may be specified per PredicateObjectMap');
    });

    it('throws an error if no predicate or predicate map is specified in a predicate object map.',
      async(): Promise<void> => {
        const functionValue = {
          predicateObjectMap: [{
            objectMap: { constant: { '@id': 'http://example.com#randomFunc' }},
          }],
        };
        await expect(executor.executeFunctionFromValue(functionValue, 0))
          .rejects.toThrow('No predicate specified in PredicateObjectMap');
      });

    it('executes a function defined through a predicate.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicate: { '@id': FNO.executes },
          object: { '@id': 'http://example.com#randomFunc' },
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
    });

    it('executes a function defined through a predicateMap.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicateMap: { constant: { '@id': FNO.executes }},
          object: { '@id': 'http://example.com#randomFunc' },
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
    });

    it('executes a function defined through an array of predicateMaps.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicateMap: [
            { constant: { '@id': FNO.executes }},
            { constant: { '@id': 'https://example.com/' }},
          ],
          object: { '@id': 'http://example.com#randomFunc' },
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
    });

    it('executes a function defined through an array of predicates.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicate: [
            { '@id': FNO.executes },
            { '@id': 'https://example.com/otherpredicate' },
          ],
          object: { '@id': 'http://example.com#randomFunc' },
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
    });

    it('executes a function defined through an array of one object.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicate: { '@id': FNO.executes },
          object: [
            { '@id': 'http://example.com#randomFunc' },
          ],
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
    });

    it('executes a function defined through an array of one ObjectMap.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicate: { '@id': FNO.executes },
          objectMap: [
            { constant: { '@id': 'http://example.com#randomFunc' }},
          ],
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
    });

    it('executes a function defined through a singular ObjectMap.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [{
          predicate: { '@id': FNO.executes },
          objectMap: { constant: { '@id': 'http://example.com#randomFunc' }},
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
    });

    it('executes a function defined through a singular PredicateObjectMap.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: {
          predicate: { '@id': FNO.executes },
          object: { '@id': 'http://example.com#randomFunc' },
        },
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
    });

    it('executes a function with a parameter with an array of ObjectMaps.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [
          {
            predicate: { '@id': FNO.executes },
            object: { '@id': 'http://example.com#randomFunc' },
          },
          {
            predicate: { '@id': 'http://example.com#parameter' },
            objectMap: [{ constant: '1' }],
          },
        ],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
      const parameters: Record<string | number, any> = [ '1' ];
      parameters['http://example.com#parameter'] = '1';
      expect(randomFunc).toHaveBeenCalledWith(parameters);
    });

    it('executes a function with a parameter with a singular ObjectMaps.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [
          {
            predicate: { '@id': FNO.executes },
            object: { '@id': 'http://example.com#randomFunc' },
          },
          {
            predicate: { '@id': 'http://example.com#parameter' },
            objectMap: { constant: '1' },
          },
        ],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
      expect(randomFunc).toHaveBeenCalledTimes(1);
      const parameters: Record<string | number, any> = [ '1' ];
      parameters['http://example.com#parameter'] = '1';
      expect(randomFunc).toHaveBeenCalledWith(parameters);
    });

    it('executes a function with a reference parameter.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [
          {
            predicate: { '@id': FNO.executes },
            object: { '@id': 'http://example.com#randomFunc' },
          },
          {
            predicate: { '@id': 'http://example.com#parameter' },
            objectMap: { reference: 'alpha' },
          },
        ],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
      expect(randomFunc).toHaveBeenCalledTimes(1);
      const parameters: Record<string | number, any> = [ 'data' ];
      parameters['http://example.com#parameter'] = 'data';
      expect(randomFunc).toHaveBeenCalledWith(parameters);
    });

    it('executes a function with a template parameter.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [
          {
            predicate: { '@id': FNO.executes },
            object: { '@id': 'http://example.com#randomFunc' },
          },
          {
            predicate: { '@id': 'http://example.com#parameter' },
            objectMap: { template: 'https://example.com/{alpha}' },
          },
        ],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
      expect(randomFunc).toHaveBeenCalledTimes(1);
      const parameters: Record<string | number, any> = [ 'https://example.com/data' ];
      parameters['http://example.com#parameter'] = 'https://example.com/data';
      expect(randomFunc).toHaveBeenCalledWith(parameters);
    });

    it('executes a function with a functionValue parameter.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [
          {
            predicate: { '@id': FNO.executes },
            object: { '@id': 'http://example.com#randomFunc' },
          },
          {
            predicate: { '@id': 'http://example.com#parameter' },
            objectMap: {
              functionValue: {
                predicateObjectMap: {
                  predicate: { '@id': FNO.executes },
                  object: { '@id': 'http://example.com#randomFunc' },
                },
              },
            },
          },
        ],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('abc123');
      expect(randomFunc).toHaveBeenCalledTimes(2);
      const parameters: Record<string | number, any> = [ 'abc123' ];
      parameters['http://example.com#parameter'] = 'abc123';
      expect(randomFunc).toHaveBeenNthCalledWith(1, []);
      expect(randomFunc).toHaveBeenNthCalledWith(2, parameters);
    });

    it('executes a function with a predefined functionValue.', async(): Promise<void> => {
      const functionValue = {
        predicateObjectMap: [
          {
            predicate: { '@id': FNO.executes },
            object: { '@id': GREL.toUpperCase },
          },
          {
            predicate: { '@id': 'http://example.com#parameter' },
            objectMap: { constant: 'loud' },
          },
        ],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0)).resolves.toBe('LOUD');
    });
  });
});
