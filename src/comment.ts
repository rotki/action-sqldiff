import fs from 'node:fs';
import * as github from '@actions/github';
import * as core from '@actions/core';
import { getGithubToken } from './input';
import { NotAPullRequestError } from './errors';
import type { FileVersionsWithDiff } from './types';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';

const COMMENT_TAG = '<!-- action/sqldiff -->';

export async function deleteComment() {
  const client = github.getOctokit(getGithubToken());
  const { context } = github;
  if (!context.payload.pull_request)
    throw new NotAPullRequestError();

  const { number } = context.payload.pull_request;

  type IssueComment = GetResponseDataTypeFromEndpointMethod<typeof client.rest.issues.listComments>[0];

  let comment: IssueComment | undefined;
  for await (const { data: comments } of client.paginate.iterator(client.rest.issues.listComments, {
    ...context.repo,
    issue_number: number,
  })) {
    comment = comments.find(comment => comment?.body?.includes(COMMENT_TAG));
    if (comment)
      break;
  }

  if (comment) {
    core.info(`deleting old comment with ${comment.id}`);
    await client.rest.issues.deleteComment({
      ...context.repo,
      issue_number: number,
      comment_id: comment.id,
    });
  }
}

export async function createComment(diffs: FileVersionsWithDiff[]) {
  const client = github.getOctokit(getGithubToken());
  const { context } = github;
  if (!context.payload.pull_request)
    throw new NotAPullRequestError();

  const { number } = context.payload.pull_request;

  type IssueComment = GetResponseDataTypeFromEndpointMethod<typeof client.rest.issues.listComments>[0];

  let comment: IssueComment | undefined;
  for await (const { data: comments } of client.paginate.iterator(client.rest.issues.listComments, {
    ...context.repo,
    issue_number: number,
  })) {
    comment = comments.find(comment => comment?.body?.includes(COMMENT_TAG));
    if (comment)
      break;
  }

  let body = `${COMMENT_TAG}\n\n`;
  for (const diff of diffs) {
    core.debug(`Reading ${diff.diff} for ${diff.file}`);
    const diffContent = fs.readFileSync(diff.diff, { encoding: 'utf-8' });
    if (diffContent.trim().length === 0) {
      core.info(`diff for ${diff.file} was empty, skipping`);
      continue;
    }
    body += `SQL Diff for \`${diff.file}\`\n`;
    body += `\`\`\`sql\n${diffContent}\n\`\`\`\n`;
  }

  if (!comment) {
    await client.rest.issues.createComment({
      ...context.repo,
      issue_number: number,
      body,
    });
  }
  else {
    await client.rest.issues.updateComment({
      ...context.repo,
      issue_number: number,
      comment_id: comment.id,
      body,
    });
  }
}
