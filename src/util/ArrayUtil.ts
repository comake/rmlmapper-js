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

export function intersection<T>(arrOfArr: T[][]): T[] {
  return arrOfArr.reduce((aArray, bArray): T[] =>
    aArray.filter((item): boolean => bArray.includes(item)));
}

export function allCombinationsOfArray(arr: any[][]): string[][] {
  if (arr.length === 0) {
    return [];
  }
  if (arr.length === 1) {
    return arr[0].map((item): any[] => [ item ]);
  }
  const result = [];
  const firstElement = arr[0];
  const allCombinationsOfRest = allCombinationsOfArray(arr.slice(1));
  for (const combinination of allCombinationsOfRest) {
    for (const element of firstElement) {
      result.push([ element, ...combinination ]);
    }
  }
  return result;
}
