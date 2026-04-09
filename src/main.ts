import * as core from '@actions/core';
import { prepareForDiff } from './changes';
import { createComment, deleteComment } from './comment';
import { NotAPullRequestError } from './errors';
import { cleanupTmpDir } from './fs';
import { sqlDiff } from './sqlcipher';

export async function run(): Promise<void> {
  try {
    const modified = await prepareForDiff();

    if (modified.length === 0) {
      core.info('No modified files matching the pattern');
      await deleteComment();
      return;
    }

    core.info(`Matched ${modified.length} files to pattern`);

    const diffs = modified.map(({ base, file, head }) => ({
      diff: sqlDiff(base, head),
      file,
    }));

    await createComment(diffs);
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
