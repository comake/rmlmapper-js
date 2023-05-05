/* eslint-disable @typescript-eslint/naming-convention */
import { FunctionExecutor } from '../../src/FunctionExecutor';
import type { SourceParser } from '../../src/input-parser/SourceParser';
import type { FunctionValue } from '../../src/util/Types';
import { FNML, FNO, GREL, RML, RR } from '../../src/util/Vocabulary';

describe('A FunctionExector', (): void => {
  describe('executing functions', (): void => {
    let parser: SourceParser<any>;
    let executor: FunctionExecutor;
    let randomFunc: any;

    beforeEach(async(): Promise<void> => {
      parser = {
        getData: jest.fn().mockReturnValue('data'),
      } as any;
      randomFunc = jest.fn().mockReturnValue('abc123');
      executor = new FunctionExecutor({
        parser,
        functions: {
          'http://example.com#randomFunc': randomFunc,
        },
      });
    });

    it('throws an error if the function name cannot be found.', async(): Promise<void> => {
      const functionValue = { '@type': FNML.FunctionValue, [RR.predicateObjectMap]: []};
      await expect(executor.executeFunctionFromValue(functionValue, 0, {}))
        .rejects.toThrow('Failed to find function name in predicatePbjectMap');
    });

    it('throws an error if no object or object map is specified in a predicate object map.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: { '@id': FNO.executes },
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0, {}))
        .rejects.toThrow('No object specified in PredicateObjectMap');
    });

    it('throws an error if the object map does not have a constant.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: { '@id': FNO.executes },
          [RR.objectMap]: {},
        }],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {}))
        .rejects.toThrow('Object must be specified through constant');
    });

    it('throws an error if an array of functions are specified in one object map.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: { '@id': FNO.executes },
          [RR.objectMap]: [
            { '@type': RR.ObjectMap, [RR.constant]: { '@id': 'http://example.com#randomFunc' }},
            { '@type': RR.ObjectMap, [RR.constant]: { '@id': 'http://example.com#randomFunc2' }},
          ],
        }],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {}))
        .rejects.toThrow('Only one function may be specified per PredicateObjectMap');
    });

    it('throws an error if an array functions are specified in one object.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: { '@id': FNO.executes },
          [RR.object]: [
            { '@id': 'http://example.com#randomFunc' },
            { '@id': 'http://example.com#randomFunc2' },
          ],
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0, {}))
        .rejects.toThrow('Only one function may be specified per PredicateObjectMap');
    });

    it('throws an error if no predicate or predicate map is specified in a predicate object map.',
      async(): Promise<void> => {
        const functionValue = {
          '@type': FNML.FunctionValue,
          [RR.predicateObjectMap]: [{
            '@type': RR.PredicateObjectMap,
            [RR.objectMap]: { '@type': RR.ObjectMap, [RR.constant]: { '@id': 'http://example.com#randomFunc' }},
          }],
        } as FunctionValue;
        await expect(executor.executeFunctionFromValue(functionValue, 0, {}))
          .rejects.toThrow('No predicate specified in PredicateObjectMap');
      });

    it('executes a function defined through a predicate.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: { '@id': FNO.executes },
          [RR.object]: { '@id': 'http://example.com#randomFunc' },
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
    });

    it('executes a function defined through a predicateMap.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicateMap]: { '@type': RR.PredicateMap, [RR.constant]: { '@id': FNO.executes }},
          [RR.object]: { '@id': 'http://example.com#randomFunc' },
        }],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
    });

    it('executes a function defined through an array of predicateMaps.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicateMap]: [
            { '@type': RR.PredicateMap, [RR.constant]: { '@id': FNO.executes }},
            { '@type': RR.PredicateMap, [RR.constant]: { '@id': 'https://example.com/' }},
          ],
          [RR.object]: { '@id': 'http://example.com#randomFunc' },
        }],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
    });

    it('executes a function defined through an array of predicates.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: [
            { '@id': FNO.executes },
            { '@id': 'https://example.com/otherpredicate' },
          ],
          [RR.object]: { '@id': 'http://example.com#randomFunc' },
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
    });

    it('executes a function defined through an array of one object.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: { '@id': FNO.executes },
          [RR.object]: [
            { '@id': 'http://example.com#randomFunc' },
          ],
        }],
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
    });

    it('executes a function defined through an array of one ObjectMap.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: { '@id': FNO.executes },
          [RR.objectMap]: [
            { '@type': RR.ObjectMap, [RR.constant]: { '@id': 'http://example.com#randomFunc' }},
          ],
        }],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
    });

    it('executes a function defined through a singular ObjectMap.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [{
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: { '@id': FNO.executes },
          [RR.objectMap]: { '@type': RR.ObjectMap, [RR.constant]: { '@id': 'http://example.com#randomFunc' }},
        }],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
    });

    it('executes a function defined through a singular PredicateObjectMap.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: {
          '@type': RR.PredicateObjectMap,
          [RR.predicate]: { '@id': FNO.executes },
          [RR.object]: { '@id': 'http://example.com#randomFunc' },
        },
      };
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
    });

    it('executes a function with a parameter with an array of ObjectMaps.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': FNO.executes },
            [RR.object]: { '@id': 'http://example.com#randomFunc' },
          },
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': 'http://example.com#parameter' },
            [RR.objectMap]: [{ '@type': RR.ObjectMap, [RR.constant]: '1' }],
          },
        ],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
      const parameters: Record<string | number, any> = [ '1' ];
      parameters['http://example.com#parameter'] = '1';
      expect(randomFunc).toHaveBeenCalledWith(parameters);
    });

    it('executes a function with a parameter with a singular ObjectMaps.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': FNO.executes },
            [RR.object]: { '@id': 'http://example.com#randomFunc' },
          },
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': 'http://example.com#parameter' },
            [RR.objectMap]: { '@type': RR.ObjectMap, [RR.constant]: '1' },
          },
        ],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
      expect(randomFunc).toHaveBeenCalledTimes(1);
      const parameters: Record<string | number, any> = [ '1' ];
      parameters['http://example.com#parameter'] = '1';
      expect(randomFunc).toHaveBeenCalledWith(parameters);
    });

    it('executes a function with a reference parameter.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': FNO.executes },
            [RR.object]: { '@id': 'http://example.com#randomFunc' },
          },
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': 'http://example.com#parameter' },
            [RR.objectMap]: { '@type': RR.ObjectMap, [RML.reference]: 'alpha' },
          },
        ],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
      expect(randomFunc).toHaveBeenCalledTimes(1);
      const parameters: Record<string | number, any> = [ 'data' ];
      parameters['http://example.com#parameter'] = 'data';
      expect(randomFunc).toHaveBeenCalledWith(parameters);
    });

    it('executes a function with a template parameter.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': FNO.executes },
            [RR.object]: { '@id': 'http://example.com#randomFunc' },
          },
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': 'http://example.com#parameter' },
            [RR.objectMap]: { '@type': RR.ObjectMap, [RR.template]: 'https://example.com/{alpha}' },
          },
        ],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
      expect(randomFunc).toHaveBeenCalledTimes(1);
      const parameters: Record<string | number, any> = [ 'https://example.com/data' ];
      parameters['http://example.com#parameter'] = 'https://example.com/data';
      expect(randomFunc).toHaveBeenCalledWith(parameters);
    });

    it('executes a function with a functionValue parameter.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': FNO.executes },
            [RR.object]: { '@id': 'http://example.com#randomFunc' },
          },
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': 'http://example.com#parameter' },
            [RR.objectMap]: {
              '@type': RR.ObjectMap,
              [FNML.functionValue]: {
                '@type': FNML.FunctionValue,
                [RR.predicateObjectMap]: {
                  '@type': RR.PredicateObjectMap,
                  [RR.predicate]: { '@id': FNO.executes },
                  [RR.object]: { '@id': 'http://example.com#randomFunc' },
                },
              },
            },
          },
        ],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('abc123');
      expect(randomFunc).toHaveBeenCalledTimes(2);
      const parameters: Record<string | number, any> = [ 'abc123' ];
      parameters['http://example.com#parameter'] = 'abc123';
      expect(randomFunc).toHaveBeenNthCalledWith(1, []);
      expect(randomFunc).toHaveBeenNthCalledWith(2, parameters);
    });

    it('executes a function with a predefined functionValue.', async(): Promise<void> => {
      const functionValue = {
        '@type': FNML.FunctionValue,
        [RR.predicateObjectMap]: [
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': FNO.executes },
            [RR.object]: { '@id': GREL.toUpperCase },
          },
          {
            '@type': RR.PredicateObjectMap,
            [RR.predicate]: { '@id': 'http://example.com#parameter' },
            [RR.objectMap]: { '@type': RR.ObjectMap, [RR.constant]: 'loud' },
          },
        ],
      } as FunctionValue;
      await expect(executor.executeFunctionFromValue(functionValue, 0, {})).resolves.toBe('LOUD');
    });
  });
});
