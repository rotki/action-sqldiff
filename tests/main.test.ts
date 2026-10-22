import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareForDiff } from '../src/changes';
import { run } from '../src/main';

const mocks = vi.hoisted(() => {
  const issues = {
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    listComments: vi.fn(),
    updateComment: vi.fn(),
  };
  const iterator = vi.fn(async function* (): AsyncGenerator<{ data: { id: number; body: string }[] }> {
    yield { data: [] };
  });
  const summary = {
    addRaw: vi.fn(),
    write: vi.fn(),
  };
  summary.addRaw.mockReturnValue(summary);
  const diffs: Record<string, string> = {};
  const inputs: Record<string, string> = {};
  return {
    diffs,
    inputs,
    issues,
    iterator,
    setFailed: vi.fn(),
    setOutput: vi.fn(),
    summary,
  };
});

vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  getInput: (name: string) => mocks.inputs[name] ?? '',
  getMultilineInput: (name: string) => (mocks.inputs[name] ?? '').split('\n').filter(Boolean),
  info: vi.fn(),
  setFailed: mocks.setFailed,
  setOutput: mocks.setOutput,
  summary: mocks.summary,
}));

vi.mock('@actions/github', () => ({
  context: {
    payload: { pull_request: { number: 7 } },
    repo: { owner: 'rotki', repo: 'rotki' },
  },
  getOctokit: () => ({
    paginate: { iterator: mocks.iterator },
    rest: { issues: mocks.issues },
  }),
}));

vi.mock('../src/changes', () => ({
  prepareForDiff: vi.fn(),
}));

vi.mock('../src/sqlcipher', () => ({
  sqlDiff: (base: string) => mocks.diffs[base],
}));

const prepare = vi.mocked(prepareForDiff);

let workDir: string;
let outputFile: string;

function addDb(file: string, diff: string): { base: string; file: string; head: string } {
  const diffFile = path.join(workDir, `${file.replace(/\W/g, '_')}.diff`);
  fs.writeFileSync(diffFile, diff);
  const base = `base/${file}`;
  mocks.diffs[base] = diffFile;
  return { base, file, head: `head/${file}` };
}

function expectNoIssueCalls(): void {
  for (const fn of Object.values(mocks.issues))
    expect(fn).not.toHaveBeenCalled();
  expect(mocks.iterator).not.toHaveBeenCalledWith(mocks.issues.listComments, expect.anything());
}

function outputs(): Record<string, string> {
  return Object.fromEntries(mocks.setOutput.mock.calls);
}

describe('run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.summary.addRaw.mockReturnValue(mocks.summary);
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqldiff-main-test-'));
    outputFile = path.join(workDir, 'out', 'comment.md');
    for (const key of Object.keys(mocks.diffs))
      delete mocks.diffs[key];
    mocks.inputs = {
      GITHUB_TOKEN: 'token',
      files: '*.db',
      mode: 'output',
      output_file: outputFile,
    };
  });

  afterEach(() => {
    fs.rmSync(workDir, { force: true, recursive: true });
  });

  describe('output mode', () => {
    it('writes the diff without the comment tag', async () => {
      prepare.mockResolvedValue([
        addDb('global.db', 'INSERT INTO a VALUES(1);\n'),
        addDb('user.db', ''),
      ]);

      await run();

      expect(mocks.setFailed).not.toHaveBeenCalled();
      const body = fs.readFileSync(outputFile, 'utf-8');
      expect(body).toBe('SQL Diff for `global.db`\n```sql\nINSERT INTO a VALUES(1);\n```');
      expect(body).not.toContain('<!-- action/sqldiff -->');
      expect(outputs()).toEqual({ comment_file: outputFile, state: 'diff' });
      expect(mocks.summary.addRaw).toHaveBeenCalledWith(body);
      expect(mocks.summary.write).toHaveBeenCalled();
      expectNoIssueCalls();
    });

    it('writes an empty file and never touches comments when nothing matched', async () => {
      prepare.mockResolvedValue([]);

      await run();

      expectNoIssueCalls();
      expect(mocks.setFailed).not.toHaveBeenCalled();
      expect(fs.readFileSync(outputFile, 'utf-8')).toBe('');
      expect(outputs()).toEqual({ comment_file: outputFile, state: 'none' });
      expect(mocks.summary.write).not.toHaveBeenCalled();
    });

    it('writes an empty file when every diff is empty', async () => {
      prepare.mockResolvedValue([addDb('global.db', '\n')]);

      await run();

      expect(mocks.setFailed).not.toHaveBeenCalled();
      expect(fs.readFileSync(outputFile, 'utf-8')).toBe('');
      expect(outputs()).toEqual({ comment_file: outputFile, state: 'empty' });
      expectNoIssueCalls();
    });

    it('defaults output_file to RUNNER_TEMP', async () => {
      delete mocks.inputs.output_file;
      vi.stubEnv('RUNNER_TEMP', workDir);
      prepare.mockResolvedValue([]);

      await run();
      vi.unstubAllEnvs();

      const expected = path.join(workDir, 'action-sqldiff', 'comment.md');
      expect(mocks.setFailed).not.toHaveBeenCalled();
      expect(fs.existsSync(expected)).toBe(true);
      expect(outputs().comment_file).toBe(expected);
    });

    it('refuses an output_file inside the directory that gets cleaned up', async () => {
      mocks.inputs.output_file = path.join(os.tmpdir(), 'action-sqldiff', 'comment.md');
      prepare.mockResolvedValue([]);

      await run();

      expect(mocks.setFailed).toHaveBeenCalledWith(expect.stringMatching(/output_file must be outside/));
    });
  });

  it('fails on an unknown mode', async () => {
    mocks.inputs.mode = 'post';
    prepare.mockResolvedValue([]);

    await run();

    expect(mocks.setFailed).toHaveBeenCalledWith(expect.stringMatching(/Unknown mode 'post'/));
    expect(prepare).not.toHaveBeenCalled();
    expectNoIssueCalls();
  });

  it('posts a tagged comment in comment mode', async () => {
    mocks.inputs.mode = 'comment';
    prepare.mockResolvedValue([addDb('global.db', 'INSERT INTO a VALUES(1);\n')]);

    await run();

    expect(mocks.setFailed).not.toHaveBeenCalled();
    expect(mocks.issues.createComment).toHaveBeenCalledWith({
      body: '<!-- action/sqldiff -->\n\nSQL Diff for `global.db`\n```sql\nINSERT INTO a VALUES(1);\n```',
      issue_number: 7,
      owner: 'rotki',
      repo: 'rotki',
    });
    expect(fs.existsSync(outputFile)).toBe(false);
  });
});
