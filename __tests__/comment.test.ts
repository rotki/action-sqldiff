import { describe, expect, it } from 'vitest';
import { fenceFor } from '../src/comment';

describe('fenceFor', () => {
  it('uses triple backticks when content has no backticks', () => {
    expect(fenceFor('no backticks here')).toBe('```');
  });

  it('uses triple backticks when content has shorter runs', () => {
    expect(fenceFor('one ` here')).toBe('```');
    expect(fenceFor('two `` here')).toBe('```');
  });

  it('picks a fence longer than the longest backtick run', () => {
    expect(fenceFor('triple ``` here')).toBe('````');
    expect(fenceFor('quad ```` here')).toBe('`````');
  });
});
