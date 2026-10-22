import { describe, expect, it } from 'vitest';
import { isDBFile, validateGitUrl } from '../src/utils';

describe('utils', () => {
  it('matches db files', () => {
    expect(isDBFile('tests/data/normal_2.db', ['*.db'])).toBe(true);
    expect(isDBFile('data/global.{db,sqlite}', ['*.db'])).toBe(false);
    expect(isDBFile('data/global.sqlite', ['*.{db,sqlite}'])).toBe(true);
    expect(isDBFile('data/global.json', ['*.db', '*.sqlite'])).toBe(false);
  });

  it('should allow a proper repo', () => {
    expect(() => {
      validateGitUrl('https://github.com/rotki/action-sqldiff.git');
      validateGitUrl('git@github.com:rotki/action-sqldiff.git');
    }).to.not.throw();
  });

  it('should not allow a non repo', () => {
    expect(() => {
      validateGitUrl('smb://rotki');
    }).to.throw(Error, /Invalid repository URL/);
  });
});
