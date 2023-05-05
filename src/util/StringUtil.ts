export function getAllOcurrences(substring: string, string: string): number[] {
  const ocurrences = [];
  let index = -1;
  index = string.indexOf(substring, index + 1);
  while (index >= 0) {
    ocurrences.push(index);
    index = string.indexOf(substring, index + 1);
  }
  return ocurrences;
}
