import type { FileVersionsWithDiff } from './types';
import * as core from '@actions/core';
import { prepareForDiff } from './changes';
import { buildCommentBody, createComment, deleteComment } from './comment';
import { NotAPullRequestError } from './errors';
import { cleanupTmpDir, writeOutputFile } from './fs';
import { getMode, getOutputFile, type Mode } from './input';
import { sqlDiff } from './sqlcipher';

type State = 'diff' | 'empty' | 'none';

async function writeOutput(state: State, body = ''): Promise<void> {
  const file = getOutputFile();
  writeOutputFile(file, body);
  core.info(`wrote ${state} diff output to ${file}`);
  core.setOutput('state', state);
  core.setOutput('comment_file', file);
  if (body)
    await core.summary.addRaw(body).write();
}

async function handleDiffs(mode: Mode, diffs: FileVersionsWithDiff[]): Promise<void> {
  if (mode === 'comment') {
    await createComment(diffs);
    return;
  }

  const body = buildCommentBody(diffs);
  if (body)
    await writeOutput('diff', body);
  else
    await writeOutput('empty');
}

export async function run(): Promise<void> {
  try {
    const mode = getMode();
    const modified = await prepareForDiff();

    if (modified.length === 0) {
      core.info('No modified files matching the pattern');
      if (mode === 'comment')
        await deleteComment();
      else
        await writeOutput('none');
      return;
    }

    core.info(`Matched ${modified.length} files to pattern`);

    const diffs = modified.map(({ base, file, head }) => ({
      diff: sqlDiff(base, head),
      file,
    }));

    await handleDiffs(mode, diffs);
  }
  catch (error) {
    if (error instanceof NotAPullRequestError)
      core.info('Not a pull request');
    else if (error instanceof Error)
      core.setFailed(error.message);
  }
  finally {
    cleanupTmpDir();
  }
}
