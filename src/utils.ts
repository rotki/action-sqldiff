import mm from 'micromatch';

export function isDBFile(filename: string, patterns: string[]): boolean {
  return mm.isMatch(filename, patterns, { basename: true });
}
