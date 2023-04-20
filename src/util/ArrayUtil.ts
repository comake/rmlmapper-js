import type { OrArray } from './Types';

export function returnFirstItemInArrayOrValue(value: any): any {
  if (value && Array.isArray(value) && value.length === 1) {
    return value[0];
  }
  return value;
}

export function addArray<T>(arr: OrArray<T>): T[] {
  if (!Array.isArray(arr)) {
    return [ arr ];
  }
  return arr;
}

export function cutArray<T>(arr: OrArray<T>): T {
  if (!Array.isArray(arr)) {
    return arr;
  }
  if (arr.length === 1) {
    arr = arr[0];
  }
  return arr as T;
}
