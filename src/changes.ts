import type { ComparedDatabases, FileVersions } from './types';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import * as path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { NotAPullRequestError } from './errors';
import { createDBDir } from './fs';
import { getFiles, getGithubToken } from './input';
import { isDBFile, validateGitUrl } from './utils';

function cloneRepo(target: 'head' | 'base', url: string, ref: string, sha: string): string {
  validateGitUrl(url);

  const repo = createDBDir(target, 'repo');
  core.info(`cloning ${url} @ ${ref} as ${target} to ${repo}`);

  const cloneResult = execFileSync('git', ['clone', url, '--branch', ref, '--depth', '1', repo], {
    encoding: 'utf-8',
  });
  if (cloneResult)
    core.info(`clone: ${cloneResult}`);

  const branch = execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf-8',
    cwd: repo,
  }).trim();

  if (branch !== ref)
    throw new Error(`expected branch ${ref} but found ${branch}`);

  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf-8',
    cwd: repo,
  }).trim();

  if (commitSha !== sha) {
    core.info(`HEAD is ${commitSha}, fetching expected commit ${sha}`);
    execFileSync('git', ['fetch', 'origin', sha, '--depth=1'], {
      encoding: 'utf-8',
      cwd: repo,
    });
    execFileSync('git', ['checkout', sha], {
      encoding: 'utf-8',
      cwd: repo,
    });
  }

  return repo;
}

function collectModifiedDBFiles(data: { filename: string; status: string }[], patterns: string[]): string[] {
  const files: string[] = [];
  for (const item of data) {
    if (item.status === 'modified' && isDBFile(item.filename, patterns))
      files.push(item.filename);
  }
  return files;
}

export async function prepareForDiff(): Promise<FileVersions[]> {
  const client = github.getOctokit(getGithubToken());
  const { context } = github;
  if (!context.payload.pull_request)
    throw new NotAPullRequestError();

  const pr = context.payload.pull_request;
  const { number, base, head } = pr;
  core.info(`PR-${number} base: ${base.sha} (${base.ref}) / head: ${head.sha} (${head.ref})`);

  const patterns = getFiles();
  core.info(`Preparing to check for modified files matching ${patterns.join(', ')}`);

  const files: string[] = [];
  for await (const response of client.paginate.iterator(
    client.rest.pulls.listFiles,
    {
      ...context.repo,
      pull_number: number,
    },
  )) {
    files.push(...collectModifiedDBFiles(response.data, patterns));
  }

  if (files.length === 0)
    return [];

  const baseRepoUrl = base.repo.clone_url;
  const headRepoUrl = head.repo?.clone_url;

  if (!headRepoUrl)
    throw new Error('head repo clone URL is missing');

  const baseRepo = cloneRepo('base', baseRepoUrl, base.ref, base.sha);
  const headRepo = cloneRepo('head', headRepoUrl, head.ref, head.sha);

  const diffs: Record<string, ComparedDatabases> = {};
  for (const file of files) {
    const headFile = path.join(headRepo, file);
    const baseFile = path.join(baseRepo, file);

    if (!fs.existsSync(headFile))
      throw new Error(`head file does not exist: ${headFile}`);

    if (!fs.existsSync(baseFile))
      throw new Error(`base file does not exist: ${baseFile}`);

    diffs[file] = { base: baseFile, head: headFile };
  }

  return Object.entries(diffs).map(([file, diff]) => ({
    file,
    ...diff,
  }));
}
