import { describe, expect, it } from 'vitest';
import { isDBFile, validateGitUrl } from '../src/utils';

describe('utils', () => {
  it('matches db files', () => {
    expect(isDBFile('__tests__/data/normal_2.db', ['*.db'])).toBe(true);
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
    }).to.throw(Error, 'Invalid repository URL: \'smb://rotki\'');
  });
});
