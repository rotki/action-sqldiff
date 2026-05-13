import mm from 'micromatch';

export function isDBFile(filename: string, patterns: string[]): boolean {
  return mm.isMatch(filename, patterns, { basename: true });
}

export function validateGitUrl(url: string): void {
  // Allow SSH-style URLs (git@host:path)
  if (/^git@[\w.-]+:[\w./-]+$/.test(url))
    return;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:')
      throw new Error(`unsupported protocol: ${parsed.protocol}`);
  }
  catch (error) {
    throw new Error(`Invalid repository URL: '${url}'`, { cause: error });
  }
}
