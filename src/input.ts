import * as core from '@actions/core';

const INPUT_FILES = 'files';
const GITHUB_TOKEN = 'GITHUB_TOKEN';
const DB_KEY = 'db_key';

export function getFiles(): string[] {
  return core.getMultilineInput(INPUT_FILES, { required: true });
}

export function getDBKey(): string {
  return core.getInput(DB_KEY);
}

export function getGithubToken(): string {
  return core.getInput(GITHUB_TOKEN, { required: true });
}
