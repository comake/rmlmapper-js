export function returnFirstItemInArrayOrValue(value: any): any {
  if (value && Array.isArray(value) && value.length === 1) {
    return value[0];
  }
  return value;
}
