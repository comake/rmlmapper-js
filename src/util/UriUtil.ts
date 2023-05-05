export function toURIComponent(str: string): string {
  return encodeURIComponent(str)
    .replace(/\(/ug, '%28')
    .replace(/\)/ug, '%29');
}

function replaceAll(str: string, search: string, replacement: string): string {
  // eslint-disable-next-line require-unicode-regexp
  return str.replace(new RegExp(search, 'g'), replacement);
}

const OPEN_BRACKET_REPLACEMENT = '#replaceOpenBr#';
const CLOSE_BRACKET_REPLACEMENT = '#replaceClosingBr#';

export function escapeCurlyBrackets(str: string): string {
  str = replaceAll(str, '\\\\{', OPEN_BRACKET_REPLACEMENT);
  str = replaceAll(str, '\\\\}', CLOSE_BRACKET_REPLACEMENT);
  return str;
}

export function unescapeCurlyBrackets(str: string): string {
  str = replaceAll(str, OPEN_BRACKET_REPLACEMENT, '{');
  str = replaceAll(str, CLOSE_BRACKET_REPLACEMENT, '}');
  return str;
}
