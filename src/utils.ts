import mm from 'micromatch';

export function isDBFile(filename: string, patterns: string[]): boolean {
  return mm.isMatch(filename, patterns, { basename: true });
}

export function validateGitUrl(url: string): void {
  const urlRegex = /^(https?:\/\/|git@[\w.-]+:)[\w#%+./:=@~-]+(.git)?$/;
  if (!urlRegex.test(url))
    throw new Error(`Invalid repository URL: '${url}'`);
}
