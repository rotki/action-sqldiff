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
4. It posts one comment on the PR with an `sql` block per database, and updates that same
   comment on later runs. Diffs longer than 60,000 characters are truncated.

When no matching database changed, or all diffs are empty, it deletes its earlier comment.
Outside a pull request it logs a message and exits without failing.

## Requirements

The runner needs `sqlcipher` and `sqldiff` on the `PATH`. On Ubuntu they come from the
`sqlcipher` and `sqlite3-tools` packages.

## Inputs

| Input          | Required | Default | Description                                                                                                   |
| -------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN` | yes      |         | Token used to list the PR files and to create, update or delete the comment. It needs `pull-requests: write`. |
| `files`        | yes      |         | Glob patterns for the database files, one per line.                                                           |
| `db_key`       | no       | `123`   | Key used to unlock SQLCipher encrypted databases. Unencrypted SQLite databases are read without it.           |

A `files` pattern without a `/` matches the file name in any directory, so `*.db` matches
`data/global.db`.

## Usage

The action reads the pull request from the event payload, so it has to run on a pull request
event. It uses `pull_request_target` so that it can also comment on PRs from forks, which
get a read-only token under `pull_request`. Under `pull_request_target` the workflow file
comes from the base branch, and the action only reads the database files from the PR.

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
