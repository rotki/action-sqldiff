import * as path from 'node:path';
import process from 'node:process';
import * as core from '@actions/core';

const INPUT_FILES = 'files';
const GITHUB_TOKEN = 'GITHUB_TOKEN';
const DB_KEY = 'db_key';
const MODE = 'mode';
const OUTPUT_FILE = 'output_file';

export type Mode = 'comment' | 'output';

export function getFiles(): string[] {
  return core.getMultilineInput(INPUT_FILES, { required: true });
}

export function getDBKey(): string {
  return core.getInput(DB_KEY);
}

export function getGithubToken(): string {
  return core.getInput(GITHUB_TOKEN, { required: true });
}

export function getMode(): Mode {
  const mode = core.getInput(MODE) || 'comment';
  if (mode !== 'comment' && mode !== 'output')
    throw new Error(`Unknown mode '${mode}', expected 'comment' or 'output'`);
  return mode;
}

export function getOutputFile(): string {
  const file = core.getInput(OUTPUT_FILE);
  if (file)
    return path.resolve(file);

  const runnerTemp = process.env.RUNNER_TEMP;
  if (!runnerTemp)
    throw new Error('RUNNER_TEMP is not set, set output_file explicitly');
  return path.join(runnerTemp, 'action-sqldiff', 'comment.md');
}
