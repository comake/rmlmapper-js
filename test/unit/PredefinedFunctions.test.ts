import { v4 as uuid } from 'uuid';
import { predefinedFunctions } from '../../src/PredefinedFunctions';
import { GREL, IDLAB } from '../../src/util/Vocabulary';

jest.mock('uuid', (): any => ({ v4: jest.fn().mockReturnValue('abc123') }));

describe('mapper functions', (): void => {
  describe('grel:array_join', (): void => {
    it('joins an array with a separator.', (): void => {
      const args = [ ',', 'a', 'b', 'c' ] as Record<string | number, any>;
      args[GREL.p_array_a] = args.slice(1);
      args[GREL.p_string_sep] = args[0];
      expect(predefinedFunctions[GREL.array_join](args)).toBe('a,b,c');
    });
    it('filters out empty arrays before joining.', (): void => {
      const args = [ ',', [], 'a', 'b', [], []] as Record<string | number, any>;
      args[GREL.p_array_a] = args.slice(1);
      args[GREL.p_string_sep] = args[0];
      expect(predefinedFunctions[GREL.array_join](args)).toBe('a,b');
    });
    it('joins an array with no separator if one is not provided.', (): void => {
      const args = [ 'a', 'b', 'c' ] as Record<string | number, any>;
      args[GREL.p_array_a] = args;
      expect(predefinedFunctions[GREL.array_join](args)).toBe('abc');
    });
    it('returns the array if it is a single value.', (): void => {
      const args = [] as Record<string | number, any>;
      args[GREL.p_array_a] = 'a';
      expect(predefinedFunctions[GREL.array_join](args)).toBe('a');
    });
  });

  describe('grel:controls_if', (): void => {
    it('returns the any_true value if the bool_b value is the string "true".', (): void => {
      expect(predefinedFunctions[GREL.controls_if]({
        [GREL.bool_b]: 'true',
        [GREL.any_true]: 'it was true',
        [GREL.any_false]: 'it was false',
      })).toBe('it was true');
    });

    it('returns the any_true value if the bool_b value is the boolean true.', (): void => {
      expect(predefinedFunctions[GREL.controls_if]({
        [GREL.bool_b]: true,
        [GREL.any_true]: 'it was true',
        [GREL.any_false]: 'it was false',
      })).toBe('it was true');
    });

    it('returns the any_false value if the bool_b value is a string not equaling "true".', (): void => {
      expect(predefinedFunctions[GREL.controls_if]({
        [GREL.bool_b]: 'example',
        [GREL.any_true]: 'it was true',
        [GREL.any_false]: 'it was false',
      })).toBe('it was false');
    });

    it('returns the any_false value if the bool_b value the boolean false.', (): void => {
      expect(predefinedFunctions[GREL.controls_if]({
        [GREL.bool_b]: false,
        [GREL.any_true]: 'it was true',
        [GREL.any_false]: 'it was false',
      })).toBe('it was false');
    });

    it('returns the any_false value if the bool_b value is not a string or boolean.', (): void => {
      expect(predefinedFunctions[GREL.controls_if]({
        [GREL.bool_b]: 1,
        [GREL.any_true]: 'it was true',
        [GREL.any_false]: 'it was false',
      })).toBe('it was false');
    });

    it(`returns null if the any_false value is undefined
      and the bool_b value is not the "true" string or true boolean.`,
    (): void => {
      expect(predefinedFunctions[GREL.controls_if]({
        [GREL.bool_b]: 'example',
        [GREL.any_true]: 'it was true',
      })).toBeUndefined();
    });
  });

  describe('grel:string_endsWith', (): void => {
    it('returns true if the string_sub parameter ends with the valueParameter.', (): void => {
      expect(predefinedFunctions[GREL.string_endsWith]({
        [GREL.string_sub]: 'ample',
        [GREL.valueParameter]: 'example',
      })).toBe(true);
    });

    it('returns false if the string_sub parameter does not end with the valueParameter.', (): void => {
      expect(predefinedFunctions[GREL.string_endsWith]({
        [GREL.string_sub]: 'apple',
        [GREL.valueParameter]: 'example',
      })).toBe(false);
    });

    it('returns false if the string_sub parameter is not a string.', (): void => {
      expect(predefinedFunctions[GREL.string_endsWith]({
        [GREL.string_sub]: 1234,
        [GREL.valueParameter]: 'example',
      })).toBe(false);
    });
  });

  describe('grel:string_replace', (): void => {
    it(`replaces all occurances of the p_string_find parameter with
      the p_string_replace parameter in the valueParameter.`,
    (): void => {
      expect(predefinedFunctions[GREL.string_replace]({
        [GREL.p_string_find]: 'peter',
        [GREL.p_string_replace]: 'beth',
        [GREL.valueParameter]: 'peter was walking',
      })).toBe('beth was walking');
    });
  });

  describe('grel:toUpperCase', (): void => {
    it('capitalizes all characters in the string.', (): void => {
      expect(predefinedFunctions[GREL.toUpperCase]([ 'loud' ])).toBe('LOUD');
    });
  });

  describe('grel:date_now', (): void => {
    beforeAll((): void => {
      jest.useFakeTimers('modern');
      jest.setSystemTime(new Date('2022-08-12T00:00:00.000Z'));
    });

    afterAll((): void => {
      jest.useRealTimers();
    });

    it('returns the current time as an ISO datetime string.', (): void => {
      expect(predefinedFunctions[GREL.date_now]()).toBe('2022-08-12T00:00:00.000Z');
    });
  });

  describe('grel:date_inc', (): void => {
    it('returns an empty string if the input date is not a string.', (): void => {
      expect(predefinedFunctions[GREL.date_inc]({
        [GREL.p_date_d]: undefined,
        [GREL.p_dec_n]: 2,
        [GREL.p_string_unit]: 'year',
      })).toBe('');
    });

    it('returns a date with the specified unit added or subtracted.', (): void => {
      expect(predefinedFunctions[GREL.date_inc]({
        [GREL.p_date_d]: '2022-08-12T00:00:00.000Z',
        [GREL.p_dec_n]: 2,
        [GREL.p_string_unit]: 'year',
      }))
        .toBe('2024-08-12T00:00:00.000Z');
      expect(predefinedFunctions[GREL.date_inc]({
        [GREL.p_date_d]: '2022-08-12T00:00:00.000Z',
        [GREL.p_dec_n]: -2,
        [GREL.p_string_unit]: 'year',
      }))
        .toBe('2020-08-12T00:00:00.000Z');
      expect(predefinedFunctions[GREL.date_inc]({
        [GREL.p_date_d]: '2022-08-12T00:00:00.000Z',
        [GREL.p_dec_n]: 1,
        [GREL.p_string_unit]: 'month',
      }))
        .toBe('2022-09-12T00:00:00.000Z');
      expect(predefinedFunctions[GREL.date_inc]({
        [GREL.p_date_d]: '2022-08-12T00:00:00.000Z',
        [GREL.p_dec_n]: -3,
        [GREL.p_string_unit]: 'day',
      }))
        .toBe('2022-08-09T00:00:00.000Z');
      expect(predefinedFunctions[GREL.date_inc]({
        [GREL.p_date_d]: '2022-08-12T00:00:00.000Z',
        [GREL.p_dec_n]: 5,
        [GREL.p_string_unit]: 'hour',
      }))
        .toBe('2022-08-12T05:00:00.000Z');
      expect(predefinedFunctions[GREL.date_inc]({
        [GREL.p_date_d]: '2022-08-12T00:00:00.000Z',
        [GREL.p_dec_n]: 30,
        [GREL.p_string_unit]: 'minute',
      }))
        .toBe('2022-08-12T00:30:00.000Z');
      expect(predefinedFunctions[GREL.date_inc]({
        [GREL.p_date_d]: '2022-08-12T00:00:00.000Z',
        [GREL.p_dec_n]: 59,
        [GREL.p_string_unit]: 'second',
      }))
        .toBe('2022-08-12T00:00:59.000Z');
    });
  });

  describe('grel:array_sum', (): void => {
    it('returns the sum of the arguments.', (): void => {
      const args = [ 1, 2, 3 ] as Record<string | number, any>;
      args[GREL.p_array_a] = args;
      expect(predefinedFunctions[GREL.array_sum](args)).toBe(6);
    });

    it('returns the p_array_a arg if it is not an array.', (): void => {
      const args = [ 3 ] as Record<string | number, any>;
      args[GREL.p_array_a] = args[0];
      expect(predefinedFunctions[GREL.array_sum](args)).toBe(3);
    });
  });

  describe('grel:array_product', (): void => {
    it('returns the product of the arguments.', (): void => {
      const args = [ 4, 2, 3 ] as Record<string | number, any>;
      args[GREL.p_array_a] = args;
      expect(predefinedFunctions[GREL.array_product](args)).toBe(24);
    });

    it('returns the p_array_a arg if it is not an array.', (): void => {
      const args = [ 3 ] as Record<string | number, any>;
      args[GREL.p_array_a] = args[0];
      expect(predefinedFunctions[GREL.array_product](args)).toBe(3);
    });
  });

  describe('grel:boolean_not', (): void => {
    it('returns false if the bool_b value is the string "true".', (): void => {
      expect(predefinedFunctions[GREL.boolean_not]({ [GREL.bool_b]: 'true' })).toBe(false);
    });

    it('returns false if the bool_b value is the boolean true.', (): void => {
      expect(predefinedFunctions[GREL.boolean_not]({ [GREL.bool_b]: true })).toBe(false);
    });

    it('returns true if the bool_b value is a string not equaling "true".', (): void => {
      expect(predefinedFunctions[GREL.boolean_not]({ [GREL.bool_b]: 'example' })).toBe(true);
    });

    it('returns true if the bool_b value the boolean false.', (): void => {
      expect(predefinedFunctions[GREL.boolean_not]({ [GREL.bool_b]: false })).toBe(true);
    });

    it('returns true if the bool_b value is not a string or boolean.', (): void => {
      expect(predefinedFunctions[GREL.boolean_not]({ [GREL.bool_b]: 1 })).toBe(true);
    });
  });

  describe('grel:boolean_and', (): void => {
    it('returns false not all param_rep_b values are true.', (): void => {
      expect(predefinedFunctions[GREL.boolean_and]([ false ])).toBe(false);
      expect(predefinedFunctions[GREL.boolean_and]([ 'false' ])).toBe(false);
      expect(predefinedFunctions[GREL.boolean_and]([ 'true', true, false ])).toBe(false);
      expect(predefinedFunctions[GREL.boolean_and]([ true, false ])).toBe(false);
      expect(predefinedFunctions[GREL.boolean_and]([ 'abc' ])).toBe(false);
    });

    it('returns true if all param_rep_b calues are true.', (): void => {
      expect(predefinedFunctions[GREL.boolean_and]([ true ])).toBe(true);
      expect(predefinedFunctions[GREL.boolean_and]([ 'true' ])).toBe(true);
      expect(predefinedFunctions[GREL.boolean_and]([ 'true', true ])).toBe(true);
    });
  });

  describe('grel:boolean_or', (): void => {
    it('returns false none of the param_rep_b values are true.', (): void => {
      expect(predefinedFunctions[GREL.boolean_or]([ false ])).toBe(false);
      expect(predefinedFunctions[GREL.boolean_or]([ 'false' ])).toBe(false);
      expect(predefinedFunctions[GREL.boolean_or]([ false, '123' ])).toBe(false);
      expect(predefinedFunctions[GREL.boolean_or]([ 'has true in it' ])).toBe(false);
      expect(predefinedFunctions[GREL.boolean_or]([ 1 ])).toBe(false);
    });

    it('returns true if any of the param_rep_b calues are true.', (): void => {
      expect(predefinedFunctions[GREL.boolean_or]([ true ])).toBe(true);
      expect(predefinedFunctions[GREL.boolean_or]([ true, false ])).toBe(true);
      expect(predefinedFunctions[GREL.boolean_or]([ 'false', 'true' ])).toBe(true);
      expect(predefinedFunctions[GREL.boolean_or]([ 'abc', 123, 'true' ])).toBe(true);
    });
  });

  describe('grel:array_get', (): void => {
    it(`returns the element at index equal to the param_int_i_from arg
      if param_int_i_opt_to is not defined.`,
    (): void => {
      expect(predefinedFunctions[GREL.array_get]({
        [GREL.p_array_a]: [ 1, 2, 3 ],
        [GREL.param_int_i_from]: 1,
      })).toBe(2);
    });

    it(`returns an array of the elements between indexes equalling the param_int_i_from arg
      and the param_int_i_opt_to arg.`,
    (): void => {
      expect(predefinedFunctions[GREL.array_get]({
        [GREL.p_array_a]: [ 1, 2, 3 ],
        [GREL.param_int_i_from]: 1,
        [GREL.param_int_i_opt_to]: 3,
      })).toEqual([ 2, 3 ]);
      expect(predefinedFunctions[GREL.array_get]({
        [GREL.p_array_a]: [ 1, 2, 3 ],
        [GREL.param_int_i_from]: 0,
        [GREL.param_int_i_opt_to]: 1,
      })).toEqual([ 1 ]);
    });
  });

  describe('grel:string_split', (): void => {
    it('returns the string split into an array on the separator.', (): void => {
      expect(predefinedFunctions[GREL.string_split]({
        [GREL.valueParameter]: 'my mother mary',
        [GREL.p_string_sep]: ' ',
      })).toEqual([ 'my', 'mother', 'mary' ]);
    });
  });

  describe('grel:string_toString', (): void => {
    it('returns the strigified version of the p_any_e param.', (): void => {
      expect(predefinedFunctions[GREL.string_toString]({ [GREL.p_any_e]: 123 })).toBe('123');
      expect(predefinedFunctions[GREL.string_toString]({ [GREL.p_any_e]: true })).toBe('true');
      expect(predefinedFunctions[GREL.string_toString]({ [GREL.p_any_e]: 'a string' })).toBe('a string');
      expect(predefinedFunctions[GREL.string_toString]({ [GREL.p_any_e]: { arg: 2 }})).toBe('{"arg":2}');
      expect(predefinedFunctions[GREL.string_toString]({ [GREL.p_any_e]: [ 1, 2, 3 ]})).toBe('[1,2,3]');
    });
  });

  describe('grel:string_toNumber', (): void => {
    it('returns a float for strings with a decimal point.', (): void => {
      expect(predefinedFunctions[GREL.string_toNumber]({ [GREL.p_any_e]: '33.3' })).toBe(33.3);
      // eslint-disable-next-line unicorn/no-zero-fractions
      expect(predefinedFunctions[GREL.string_toNumber]({ [GREL.p_any_e]: '3.0' })).toBe(3.0);
      expect(predefinedFunctions[GREL.string_toNumber]({ [GREL.p_any_e]: '3.123' })).toBe(3.123);
    });

    it('returns an integer for strings without a decimal point.', (): void => {
      expect(predefinedFunctions[GREL.string_toNumber]({ [GREL.p_any_e]: '33' })).toBe(33);
      expect(predefinedFunctions[GREL.string_toNumber]({ [GREL.p_any_e]: '3' })).toBe(3);
    });
  });

  describe('grel:string_contains', (): void => {
    it('returns false if the string does not include the substring.', (): void => {
      expect(predefinedFunctions[GREL.string_contains]({
        [GREL.valueParameter]: 'hello world',
        [GREL.string_sub]: 'ward',
      })).toBe(false);
    });
    it('returns true if the string includes the substring.', (): void => {
      expect(predefinedFunctions[GREL.string_contains]({
        [GREL.valueParameter]: 'hello world',
        [GREL.string_sub]: 'world',
      })).toBe(true);
    });
  });

  describe('grel:math_max', (): void => {
    it('returns the maximum of two numbers.', (): void => {
      expect(predefinedFunctions[GREL.math_max]({ [GREL.p_dec_n]: 3, [GREL.param_n2]: 2 })).toBe(3);
      expect(predefinedFunctions[GREL.math_max]({ [GREL.p_dec_n]: 34, [GREL.param_n2]: 43 })).toBe(43);
    });
  });

  describe('grel:math_min', (): void => {
    it('returns the minimum of two numbers.', (): void => {
      expect(predefinedFunctions[GREL.math_min]({ [GREL.p_dec_n]: 3, [GREL.param_n2]: 2 })).toBe(2);
      expect(predefinedFunctions[GREL.math_min]({ [GREL.p_dec_n]: 34, [GREL.param_n2]: 43 })).toBe(34);
    });
  });

  describe('idlab:equal', (): void => {
    it('returns true if the two args are equal.', (): void => {
      expect(predefinedFunctions[IDLAB.equal]({
        [GREL.valueParameter]: 'abc',
        [GREL.valueParameter2]: 'abc',
      })).toBe(true);
      expect(predefinedFunctions[IDLAB.equal]({
        [GREL.valueParameter]: 123,
        [GREL.valueParameter2]: 123,
      })).toBe(true);
      expect(predefinedFunctions[IDLAB.equal]({
        [GREL.valueParameter]: 1.1234,
        [GREL.valueParameter2]: 1.1234,
      })).toBe(true);
      expect(predefinedFunctions[IDLAB.equal]({
        [GREL.valueParameter]: true,
        [GREL.valueParameter2]: true,
      })).toBe(true);
    });

    it('returns false if the two args are unequal.', (): void => {
      expect(predefinedFunctions[IDLAB.equal]({
        [GREL.valueParameter]: 'abc',
        [GREL.valueParameter2]: 'cba',
      })).toBe(false);
      expect(predefinedFunctions[IDLAB.equal]({
        [GREL.valueParameter]: true,
        [GREL.valueParameter2]: 'true',
      })).toBe(false);
      expect(predefinedFunctions[IDLAB.equal]({
        [GREL.valueParameter]: 1,
        [GREL.valueParameter2]: '1',
      })).toBe(false);
    });
  });

  describe('idlab:notEqual', (): void => {
    it('returns false if the two args are equal.', (): void => {
      expect(predefinedFunctions[IDLAB.notEqual]({
        [GREL.valueParameter]: 'abc',
        [GREL.valueParameter2]: 'abc',
      })).toBe(false);
      expect(predefinedFunctions[IDLAB.notEqual]({
        [GREL.valueParameter]: 123,
        [GREL.valueParameter2]: 123,
      })).toBe(false);
      expect(predefinedFunctions[IDLAB.notEqual]({
        [GREL.valueParameter]: 1.1234,
        [GREL.valueParameter2]: 1.1234,
      })).toBe(false);
      expect(predefinedFunctions[IDLAB.notEqual]({
        [GREL.valueParameter]: true,
        [GREL.valueParameter2]: true,
      })).toBe(false);
    });

    it('returns true if the two args are unequal.', (): void => {
      expect(predefinedFunctions[IDLAB.notEqual]({
        [GREL.valueParameter]: 'abc',
        [GREL.valueParameter2]: 'cba',
      })).toBe(true);
      expect(predefinedFunctions[IDLAB.notEqual]({
        [GREL.valueParameter]: true,
        [GREL.valueParameter2]: 'true',
      })).toBe(true);
      expect(predefinedFunctions[IDLAB.notEqual]({
        [GREL.valueParameter]: 1,
        [GREL.valueParameter2]: '1',
      })).toBe(true);
    });
  });

  describe('idlab:getMIMEType', (): void => {
    it('returns an mime type based on the filename string parameter.', (): void => {
      expect(predefinedFunctions[IDLAB.getMIMEType]({ [IDLAB.str]: 'final_final.jpg' })).toBe('image/jpeg');
    });
  });

  describe('idlab:isNull', (): void => {
    it('returns true if the string parameter is an empty array.', (): void => {
      expect(predefinedFunctions[IDLAB.isNull]({ [IDLAB.str]: []})).toBe(true);
    });

    it('returns true if the string parameter is null.', (): void => {
      expect(predefinedFunctions[IDLAB.isNull]({ [IDLAB.str]: null })).toBe(true);
    });

    it('returns false if the string parameter is a non empty array.', (): void => {
      expect(predefinedFunctions[IDLAB.isNull]({ [IDLAB.str]: [ 'abc' ]})).toBe(false);
    });

    it('returns false if the string parameter is a non null value.', (): void => {
      expect(predefinedFunctions[IDLAB.isNull]({ [IDLAB.str]: 'abc' })).toBe(false);
    });
  });

  describe('idlab:random', (): void => {
    it('returns a random uuid.', (): void => {
      expect(predefinedFunctions[IDLAB.random]()).toBe('abc123');
      expect(uuid).toHaveBeenCalledTimes(1);
    });
  });

  describe('idlab:concat', (): void => {
    it('returns the str and otherStr args joined by the delimiter.', (): void => {
      expect(predefinedFunctions[IDLAB.concat]({
        [IDLAB.str]: 'hello',
        [IDLAB.otherStr]: 'world',
        [IDLAB.delimiter]: ' ',
      })).toBe('hello world');
    });

    it('returns the str and otherStr args joined if no delimiter is supplied.', (): void => {
      expect(predefinedFunctions[IDLAB.concat]({
        [IDLAB.str]: 'hello',
        [IDLAB.otherStr]: 'world',
      })).toBe('helloworld');
    });
  });

  describe('idlab:listContainsElement', (): void => {
    it('returns true if the list contains the string.', (): void => {
      expect(predefinedFunctions[IDLAB.listContainsElement]({
        [IDLAB.str]: 'world',
        [IDLAB.list]: [ 'hello', 'world' ],
      })).toBe(true);
    });

    it('returns false if the list does not contain the string.', (): void => {
      expect(predefinedFunctions[IDLAB.listContainsElement]({
        [IDLAB.str]: 'world',
        [IDLAB.list]: [ 'hello', 'otherworld' ],
      })).toBe(false);
    });
  });
});
