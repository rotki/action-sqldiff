# @rotki/action-sqldiff

[![CI](https://github.com/rotki/action-sqldiff/actions/workflows/ci.yml/badge.svg)](https://github.com/rotki/action-sqldiff/actions/workflows/ci.yml)
[![Check dist/](https://github.com/rotki/action-sqldiff/actions/workflows/check-dist.yml/badge.svg)](https://github.com/rotki/action-sqldiff/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/rotki/action-sqldiff/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/rotki/action-sqldiff/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Posts the changes to SQLite and SQLCipher databases in a pull request as an SQL diff comment.

Binary database files show up in a PR diff as a single changed blob. This action shows what
actually changed inside them:

1. It lists the files the PR modifies and keeps those that match the `files` patterns.
   Added and deleted files are ignored, since there is nothing to compare them with.
2. It clones the base and head branches into a temporary directory. PR code is never checked
   out into the workspace or run.
3. It exports each version of a database to a plaintext SQLite file with `sqlcipher`,
   unlocking encrypted databases with `db_key`, and compares them with
   `sqldiff --primarykey`.
4. It builds markdown with an `sql` block per database. Diffs longer than 60,000 characters
   are truncated.
5. In `comment` mode (the default) it posts that markdown as one comment on the PR, and
   updates that same comment on later runs. When no matching database changed, or all diffs
   are empty, it deletes its earlier comment. In `output` mode it writes the markdown to a
   file and to the job summary instead, and makes no GitHub API writes.

Outside a pull request it logs a message and exits without failing.

## Requirements

The runner needs `sqlcipher` and `sqldiff` on the `PATH`. On Ubuntu they come from the
`sqlcipher` and `sqlite3-tools` packages.

## Inputs

| Input          | Required | Default                                  | Description                                                                                                                                                                               |
| -------------- | -------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files`        | yes      |                                          | Glob patterns for the database files, one per line.                                                                                                                                       |
| `GITHUB_TOKEN` | no       | `github.token`                           | Token used to list the PR files and, in `comment` mode, to create, update or delete the comment. `output` mode works with a read-only token; `comment` mode needs `pull-requests: write`. |
| `db_key`       | no       | `123`                                    | Key used to unlock SQLCipher encrypted databases. Unencrypted SQLite databases are read without it.                                                                                       |
| `mode`         | no       | `comment`                                | `comment` posts the diff as a PR comment. `output` writes it to `output_file` and the job summary without any GitHub API writes. Any other value fails the step.                          |
| `output_file`  | no       | `$RUNNER_TEMP/action-sqldiff/comment.md` | Where `output` mode writes the markdown. Missing parent directories are created.                                                                                                          |

A `files` pattern without a `/` matches the file name in any directory, so `*.db` matches
`data/global.db`.

## Outputs

These are set in `output` mode only.

| Output         | Description                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`        | `diff` when the file holds a diff, `empty` when databases matched but every diff was empty, `none` when no modified file matched `files`.             |
| `comment_file` | The path of the markdown file. It is always written, and is empty unless `state` is `diff`. It has no `<!-- action/sqldiff -->` marker; add your own. |

## Usage

The action reads the pull request from the event payload, so it has to run on a pull request
event.

### Unprivileged diff with `output` mode

PRs from forks get a read-only token under `pull_request`, so the action cannot comment
there. In `output` mode it only needs to read, and the job holds no write token or secrets
while it opens the databases from the PR. Upload the result as an artifact:

```yaml
name: SQL diff

on:
  pull_request:
    branches:
      - main
    paths:
      - '**/*.db'

permissions: {}

jobs:
  sqldiff:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
    steps:
      - name: Install sqlcipher and sqldiff
        run: sudo apt-get install -y sqlcipher sqlite3-tools

      - uses: rotki/action-sqldiff@v3
        id: sqldiff
        with:
          mode: output
          files: |
            *.db

      - name: Record the PR number
        run: echo "${PR_NUMBER}" > "${RUNNER_TEMP}/action-sqldiff/pr-number.txt"
        env:
          PR_NUMBER: ${{ github.event.pull_request.number }}

      - uses: actions/upload-artifact@v7
        with:
          name: sqldiff
          path: |
            ${{ steps.sqldiff.outputs.comment_file }}
            ${{ runner.temp }}/action-sqldiff/pr-number.txt
```

Posting the comment is left to a separate workflow triggered by `workflow_run`, which runs
with the base repository's token. That workflow downloads the artifact and creates, updates
or deletes the comment. The artifact comes from a run the PR controls, so treat its contents
as untrusted: do not use the PR number from the file directly. Check it against the API, for
example by confirming that the pull request's head SHA matches the triggering run's
`head_sha`, before writing to it.

### Commenting directly with `pull_request_target`

In the default `comment` mode the action posts the comment itself. It uses
`pull_request_target` so that it can also comment on PRs from forks. Under
`pull_request_target` the workflow file comes from the base branch, and the action only
reads the database files from the PR. On public repositories, `pull_request_target` runs
only if the repository's Actions event policy allows it.

```yaml
name: SQL diff

on:
  pull_request_target:
    branches:
      - main

permissions: {}

jobs:
  sqldiff:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Install sqlcipher and sqldiff
        run: sudo apt-get install -y sqlcipher sqlite3-tools

      - uses: rotki/action-sqldiff@v3
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          files: |
            *.db
```

If all your PRs come from branches in the same repository, `pull_request` works too.

## License

[AGPL-3.0](./LICENSE) License &copy; 2023- [Rotki Solutions GmbH](https://github.com/rotki)
