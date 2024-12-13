import { execFileSync, execSync } from 'node:child_process';
import * as path from 'node:path';
import fs from 'node:fs';
import * as github from '@actions/github';
import * as core from '@actions/core';
import { getFiles, getGithubToken } from './input';
import { NotAPullRequestError } from './errors';
import { isDBFile, validateGitUrl } from './utils';
import { createDBDir } from './fs';
import type { ComparedDatabases, FileVersions } from './types';
import type { PullRequest } from '@octokit/webhooks-types/schema';

function cloneRepo(target: 'head' | 'base', url: string, ref: string, sha: string): string {
  let cloneUrl = url;

  validateGitUrl(cloneUrl);

  if (cloneUrl.startsWith('git'))
    cloneUrl = cloneUrl.replace('git', 'https');

  const repo = createDBDir(target, 'repo');
  core.info(`cloning ${cloneUrl} @ ${ref} as ${target} to ${repo}`);
  const args = ['clone', cloneUrl, '--branch', ref, '--depth', '1', repo];
  const cloneResult = execFileSync('git', args, {
    encoding: 'utf-8',
    shell: true,
  });
  if (cloneResult)
    core.info(`clone: ${cloneResult}`);

  const branch = execSync('git branch --show-current', {
    encoding: 'utf-8',
    cwd: repo,
  }).trim();

  if (branch !== ref)
    throw new Error(`expected ${ref} but found ${branch}`);

  const commitSha = execSync('git rev-parse HEAD', {
    encoding: 'utf-8',
    cwd: repo,
  }).trim();

  if (commitSha !== sha)
    throw new Error(`expected ${sha} but found ${commitSha}`);

  return repo;
}

export async function prepareForDiff(): Promise<FileVersions[]> {
  const client = github.getOctokit(getGithubToken());
  const { context } = github;
  if (!context.payload.pull_request)
    throw new NotAPullRequestError();

  const { number, base, head } = context.payload.pull_request as PullRequest;
  core.info(`PR-${number} base: ${base.sha} (${base.ref}) / head: ${head.sha} (${head.ref})`);

  const patterns = getFiles();
  const files: string[] = [];
  const diffs: Record<string, ComparedDatabases> = {};

  core.info(`Preparing to check for modified files matching ${patterns.join(', ')}`);

  for await (const response of client.paginate.iterator(
    client.rest.pulls.listFiles,
    {
      ...context.repo,
      pull_number: number,
    },
  )) {
    for (const item of response.data) {
      if (item.status !== 'modified')
        continue;

      if (isDBFile(item.filename, getFiles()))
        files.push(item.filename);
    }
  }

  // If there are no changes, no reason to proceed to checkout
  if (files.length === 0)
    return [];

  const baseRepoUrl = base.repo.git_url;
  const headRepoUrl = head.repo?.git_url;

  if (!headRepoUrl)
    throw new Error(`head repo url is missing ${headRepoUrl}`);

  const baseRepo = cloneRepo('base', baseRepoUrl, base.ref, base.sha);
  const headRepo = cloneRepo('head', headRepoUrl, head.ref, head.sha);

  for (const file of files) {
    const headFile = path.join(headRepo, file);
    const baseFile = path.join(baseRepo, file);

    if (!fs.existsSync(headFile))
      throw new Error(`${headFile} does not exist`);

    if (!fs.existsSync(baseFile))
      throw new Error(`${baseFile} does not exist`);

    diffs[file] = {
      head: headFile,
      base: baseFile,
    };
  }

  return Object.entries(diffs).map(([file, diff]) => ({
    file,
    ...diff,
  }));
}
