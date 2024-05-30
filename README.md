# @rotki/action-sqldiff

![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Custom GitHub action to check for changes of SQLCipher/SQLite databases and post a diff on the PR.

## Usage

```yaml
name: Track SQLite changes

on:
  pull_request_target:
    branches:
      - main

permissions:
  contents: read
  pull-requests: write

jobs:
  test-action:
    name: GitHub Actions Test
    runs-on: ubuntu-24.04

    steps:
      - name: Install required
        run: sudo apt-get install -y sqlcipher sqlite3-tools

      - name: Test Local Action
        id: test-action
        uses: rotki/action-sqldiff@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          files: |
            *.db
```

## License

[AGPL-3.0](./LICENSE) License &copy; 2023- [Rotki Solutions GmbH](https://github.com/rotki)
