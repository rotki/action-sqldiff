import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCommentBody, fenceFor } from '../src/comment';

vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  info: vi.fn(),
}));

describe('buildCommentBody', () => {
  let dir: string;

  function diff(file: string, content: string): { diff: string; file: string } {
    const diffFile = path.join(dir, `${fs.readdirSync(dir).length}.diff`);
    fs.writeFileSync(diffFile, content);
    return { diff: diffFile, file };
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqldiff-body-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { force: true, recursive: true });
  });

  it('returns undefined when every diff is empty', () => {
    expect(buildCommentBody([])).toBeUndefined();
    expect(buildCommentBody([diff('a.db', ''), diff('b.db', ' \n\n')])).toBeUndefined();
  });

  it('builds one section per non-empty diff and strips backticks from the label', () => {
    const body = buildCommentBody([
      diff('a`b.db', 'INSERT INTO a VALUES(1);'),
      diff('empty.db', ''),
      diff('c.db', 'DELETE FROM c;'),
    ]);
    expect(body).toBe([
      'SQL Diff for `ab.db`\n```sql\nINSERT INTO a VALUES(1);\n```',
      'SQL Diff for `c.db`\n```sql\nDELETE FROM c;\n```',
    ].join('\n'));
  });

  it('uses a fence longer than the longest backtick run in the diff', () => {
    const body = buildCommentBody([diff('a.db', 'INSERT INTO a VALUES(\'````\');')]);
    expect(body).toBe('SQL Diff for `a.db`\n`````sql\nINSERT INTO a VALUES(\'````\');\n`````');
  });

  it('caps the body and notes how much was truncated', () => {
    const content = 'x'.repeat(70000);
    const full = `SQL Diff for \`a.db\`\n\`\`\`sql\n${content}\n\`\`\``;
    const body = buildCommentBody([diff('a.db', content)]);
    expect(body).toBe(`${full.slice(0, 60000)}\n\n_…diff truncated (${full.length - 60000} bytes omitted)_`);
  });
});

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
