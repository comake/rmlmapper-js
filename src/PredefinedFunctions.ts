import * as mime from 'mime-types';
import { v4 as uuid } from 'uuid';
import { GREL, IDLAB } from './util/Vocabulary';

function toBoolean(val: string | boolean): boolean {
  if (
    (typeof val === 'string' && val === 'true') ||
    (typeof val === 'boolean' && val)
  ) {
    return true;
  }
  return false;
}

export const predefinedFunctions = {
  [GREL.array_join](data: Record<string | number, any>): string {
    const separator = data[GREL.p_string_sep] as string | undefined;
    const parts = Array.isArray(data[GREL.p_array_a])
      ? data[GREL.p_array_a] as string[]
      : [ data[GREL.p_array_a] as string ];
    return parts
      // RML mapper returns empty arrays for undefined values
      .filter((part): boolean => !(Array.isArray(part) && part.length === 0))
      .join(separator ?? '');
  },
  [GREL.controls_if](data: Record<string | number, any>): boolean {
    if (
      (typeof data[GREL.bool_b] === 'string' && data[GREL.bool_b] === 'true') ||
      (typeof data[GREL.bool_b] === 'boolean' && data[GREL.bool_b])
    ) {
      return data[GREL.any_true];
    }
    return data[GREL.any_false] || null;
  },
  [GREL.string_endsWith](data: Record<string | number, any>): boolean {
    const string = data[GREL.valueParameter];
    const suffix = data[GREL.string_sub];
    return typeof string === 'string' && string.endsWith(suffix);
  },
  [GREL.string_replace](data: Record<string | number, any>): string {
    const string = data[GREL.valueParameter];
    const replace = data[GREL.p_string_find];
    const value = data[GREL.p_string_replace];
    return string.replace(replace, value);
  },
  [GREL.toUpperCase](data: Record<string | number, any>): string {
    return data[0].toString().toUpperCase();
  },
  [GREL.date_now](): string {
    return new Date().toISOString();
  },
  [GREL.date_inc](data: Record<string | number, any>): string {
    const fromDate = new Date(data[GREL.p_date_d]);
    const toDate = new Date(fromDate.getTime());
    const change = Number.parseInt(data[GREL.p_dec_n], 10);
    if (data[GREL.p_string_unit] === 'year') {
      toDate.setFullYear(fromDate.getFullYear() + change);
    } else if (data[GREL.p_string_unit] === 'month') {
      toDate.setMonth(fromDate.getMonth() + change);
    } else if (data[GREL.p_string_unit] === 'day') {
      toDate.setDate(fromDate.getDate() + change);
    } else if (data[GREL.p_string_unit] === 'hour') {
      toDate.setHours(fromDate.getHours() + change);
    } else if (data[GREL.p_string_unit] === 'minute') {
      toDate.setMinutes(fromDate.getMinutes() + change);
    } else if (data[GREL.p_string_unit] === 'second') {
      toDate.setSeconds(fromDate.getSeconds() + change);
    }
    return toDate.toISOString();
  },
  [GREL.array_sum](data: Record<string | number, any>): number {
    const values = data[GREL.p_array_a];
    if (Array.isArray(values)) {
      return values.reduce((sum: number, num: string): number => sum + Number.parseFloat(num), 0);
    }
    return Number.parseFloat(values);
  },
  // Note: this is not in the GREL spec
  // it follows the same params syntax as array sum
  [GREL.array_product](data: Record<string | number, any>): number {
    const values = data[GREL.p_array_a];
    if (Array.isArray(values)) {
      return values.reduce((product: number, num: string): number => product * Number.parseFloat(num), 1);
    }
    return Number.parseFloat(values);
  },
  [GREL.boolean_not](data: Record<string | number, any>): boolean {
    return !toBoolean(data[GREL.bool_b]);
  },
  [GREL.boolean_and](values: Record<string | number, any>): boolean {
    return values.every((val: string | boolean): boolean => toBoolean(val));
  },
  [GREL.boolean_or](values: Record<string | number, any>): boolean {
    return values.some((val: string | boolean): boolean => toBoolean(val));
  },
  [GREL.array_get](data: Record<string | number, any>): any | any[] {
    const from = Number.parseInt(data[GREL.param_int_i_from], 10);
    if (!data[GREL.param_int_i_opt_to]) {
      return data[GREL.p_array_a][from];
    }
    const to = Number.parseInt(data[GREL.param_int_i_opt_to], 10);
    return data[GREL.p_array_a].slice(from, to);
  },
  [GREL.string_split](data: Record<string | number, any>): string[] {
    return data[GREL.valueParameter].split(data[GREL.p_string_sep]);
  },
  [GREL.math_max](data: Record<string | number, any>): number {
    return Math.max(Number.parseInt(data[GREL.p_dec_n], 10), Number.parseInt(data[GREL.param_n2], 10));
  },
  [GREL.math_min](data: Record<string | number, any>): number {
    return Math.min(Number.parseInt(data[GREL.p_dec_n], 10), Number.parseInt(data[GREL.param_n2], 10));
  },
  [IDLAB.equal](data: Record<string | number, any>): boolean {
    return data[GREL.valueParameter] === data[GREL.valueParameter2];
  },
  [IDLAB.notEqual](data: Record<string | number, any>): boolean {
    return data[GREL.valueParameter] !== data[GREL.valueParameter2];
  },
  [IDLAB.getMIMEType](data: Record<string | number, any>): any {
    return mime.lookup(data[IDLAB.str] as string);
  },
  [IDLAB.isNull](data: Record<string | number, any>): boolean {
    const value = data[IDLAB.str];
    return Array.isArray(value) ? value.length === 0 : !value;
  },
  [IDLAB.random](): string {
    return uuid();
  },
  [IDLAB.concat](data: Record<string | number, any>): string {
    return [
      data[IDLAB.str] as string,
      data[IDLAB.otherStr] as string,
    ].join(data[IDLAB.delimiter] as string ?? '');
  },
};
