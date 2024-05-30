import * as core from '@actions/core';
import { prepareForDiff } from './changes';
import { NotAPullRequestError } from './errors';
import { sqlDiff } from './sqlcipher';
import { createComment, deleteComment } from './comment';
import { cleanupTmpDir } from './fs';
import type { FileVersionsWithDiff } from './types';

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const modified = await prepareForDiff();

    if (!modified)
      return;

    if (modified.length === 0) {
      core.info('No modified files matching the pattern');
      await deleteComment();
      return;
    }

    core.info(`Matched ${modified.length} files to pattern`);

    const diffs: FileVersionsWithDiff[] = [];
    for (const { base, file, head } of modified) {
      diffs.push({
        file,
        diff: sqlDiff(base, head),
      });
    }

    await createComment(diffs);
  }
  catch (error) {
    if (error instanceof NotAPullRequestError)
      core.info('Not a pull request');
    // Fail the workflow run if an error occurs
    else if (error instanceof Error)
      core.setFailed(error.message);
  }
  finally {
    cleanupTmpDir();
  }
}
