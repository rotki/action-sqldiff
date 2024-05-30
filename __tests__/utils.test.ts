import { expect } from 'vitest';
import { isDBFile } from '../src/utils';

describe('utils', () => {
  it('matches db files', () => {
    expect(isDBFile('__tests__/data/normal_2.db', ['*.db'])).toBe(true);
  });
});
