import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import type { FileVersionsWithDiff } from './types';
import fs from 'node:fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { NotAPullRequestError } from './errors';
import { getGithubToken } from './input';

const COMMENT_TAG = '<!-- action/sqldiff -->';
const MAX_COMMENT_BODY = 60000;

export function fenceFor(content: string): string {
  const longest = (content.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

type IssueComment = GetResponseDataTypeFromEndpointMethod<ReturnType<typeof github.getOctokit>['rest']['issues']['listComments']>[0];

function getPullRequestNumber(): number {
  const { context } = github;
  if (!context.payload.pull_request)
    throw new NotAPullRequestError();
  return context.payload.pull_request.number;
}

async function findExistingComment(client: ReturnType<typeof github.getOctokit>, number: number): Promise<IssueComment | undefined> {
  const { context } = github;
  for await (const { data: comments } of client.paginate.iterator(client.rest.issues.listComments, {
    ...context.repo,
    issue_number: number,
  })) {
    const found = comments.find(comment => comment?.body?.includes(COMMENT_TAG));
    if (found)
      return found;
  }
  return undefined;
}

export async function deleteComment() {
  const client = github.getOctokit(getGithubToken());
  const number = getPullRequestNumber();
  const comment = await findExistingComment(client, number);

  if (comment) {
    core.info(`deleting old comment with ${comment.id}`);
    await client.rest.issues.deleteComment({
      ...github.context.repo,
      comment_id: comment.id,
      issue_number: number,
    });
  }
}

export async function createComment(diffs: FileVersionsWithDiff[]) {
  const client = github.getOctokit(getGithubToken());
  const number = getPullRequestNumber();
  const comment = await findExistingComment(client, number);

  const sections: string[] = [];
  for (const diff of diffs) {
    core.debug(`Reading ${diff.diff} for ${diff.file}`);
    const diffContent = fs.readFileSync(diff.diff, { encoding: 'utf-8' }).trim();
    if (diffContent.length === 0) {
      core.info(`diff for ${diff.file} was empty, skipping`);
      continue;
    }
    const fence = fenceFor(diffContent);
    const fileLabel = diff.file.replace(/`/g, '');
    sections.push(`SQL Diff for \`${fileLabel}\`\n${fence}sql\n${diffContent}\n${fence}`);
  }

  if (sections.length === 0) {
    if (comment) {
      core.info('all diffs empty, deleting existing comment');
      await client.rest.issues.deleteComment({
        ...github.context.repo,
        comment_id: comment.id,
        issue_number: number,
      });
    }
    return;
  }

  const rawBody = `${COMMENT_TAG}\n\n${sections.join('\n')}`;
  const body = rawBody.length > MAX_COMMENT_BODY
    ? `${rawBody.slice(0, MAX_COMMENT_BODY)}\n\n_…diff truncated (${rawBody.length - MAX_COMMENT_BODY} bytes omitted)_`
    : rawBody;

  if (!comment) {
    await client.rest.issues.createComment({
      ...github.context.repo,
      body,
      issue_number: number,
    });
  }
  else {
    await client.rest.issues.updateComment({
      ...github.context.repo,
      body,
      comment_id: comment.id,
      issue_number: number,
    });
  }
}
