# rotki/action-sqldiff

A JavaScript GitHub Action that shows what changed inside the SQLite and SQLCipher databases a pull
request modifies. It clones the base and head branches into a temporary directory, exports each
database with `sqlcipher`, compares the two with `sqldiff --primarykey`, and either posts the diff
as a pull request comment (`comment` mode) or writes it to a file and the job summary (`output`
mode). rotki runs it from `.github/workflows/rotki_sqldiff.yml` in `rotki/rotki`, in `output` mode
and pinned by commit SHA with a version comment (`rotki/action-sqldiff@<sha> # v3.1.0`); a separate
`workflow_run` workflow there posts the comment. The README documents the `@v3` major tag for
everyone else.

This file is the maintenance guide for humans and coding agents. `README.md` covers what the action
does step by step, its inputs and outputs, and both workflow setups; this guide links there instead
of repeating it.

## Toolchain

- Node.js 24 (`.nvmrc`; CI reads its version from there). The action runs on the `node24` runtime
  (`action.yml`), so the two move together.
- pnpm 12, pinned through `packageManager` in `package.json`.
- TypeScript, bundled with Rollup into a single ESM file. Tests use Vitest. Linting uses
  `@rotki/eslint-config` (`eslint.config.mjs`).
- `sqlcipher` and `sqldiff` on the `PATH`, for the action and for the tests. On Ubuntu they come
  from the `sqlcipher` and `sqlite3-tools` packages; run `apt-get update` first, since a runner
  image's package index goes stale.
- Husky hooks: `pre-commit` runs lint-staged (ESLint on staged files), `commit-msg` runs
  commitlint.

## Layout

- `action.yml`: inputs (`GITHUB_TOKEN`, `files`, `db_key`, `mode`, `output_file`), outputs
  (`state`, `comment_file`), runtime and entry point (`dist/index.js`).
- `src/main.ts`: the flow: find the modified databases, diff them, then comment or write the
  output.
- `src/changes.ts`: reads the pull request from the event payload, lists its files, and clones the
  base and head branches into a temporary directory.
- `src/sqlcipher.ts`: exports a database to plaintext with `sqlcipher` and runs `sqldiff`.
- `src/comment.ts`: builds the markdown (truncated at 60,000 characters) and creates, updates or
  deletes the comment.
- `src/input.ts`, `src/fs.ts`, `src/errors.ts`, `src/utils.ts`, `src/types.ts`: inputs, the
  temporary directory and output file, errors and helpers.
- `tests/`: Vitest tests with `@actions/core` and `@actions/github` mocked. `tests/data/` holds
  plain and encrypted sample databases that `sqlcipher.test.ts` diffs for real.
- `dist/index.js` and `dist/index.js.map`: the committed bundle that GitHub runs. Never edit it by
  hand.
- `badges/coverage.svg`: written by `pnpm run coverage` from the coverage summary.
- `script/release`: a tagging helper left from the GitHub action template. Releases go through
  `pnpm run release` instead (see Releasing).

## Commands

| Command                      | What it does                                                 |
| ---------------------------- | ------------------------------------------------------------ |
| `pnpm run build`             | Type check only (`tsc --noEmit`). It does not write `dist/`  |
| `pnpm run package`           | Bundle `src/` into `dist/` with Rollup                       |
| `pnpm run lint` / `lint:fix` | ESLint over the repository, Markdown, JSON and YAML included |
| `pnpm test` / `test:watch`   | Run the tests once with coverage / in watch mode             |
| `pnpm run all`               | Type check, lint, package and test, as CI does               |
| `pnpm run coverage`          | Redraw `badges/coverage.svg` after `pnpm test`               |

CI runs commitlint and `pnpm run all` (`ci.yml`), rebuilds `dist/` and fails when the committed one
differs (`check-dist.yml`), runs CodeQL, and runs the action from the pull request itself in
`output` mode (`test-action.yml`).

## The committed `dist/`

GitHub runs `dist/index.js` straight from the tagged commit, so `dist/` is part of every change that
touches `src/` or a runtime dependency (`@actions/core`, `@actions/github`, `picomatch`, `semver`,
and what they pull in, such as `undici`):

1. Run `pnpm run all`. It rebuilds `dist/`.
2. Commit the rebuilt `dist/` in the same commit as the change that caused it.

A dependency update that only touches dev tooling can still change the bundle (Rollup, its plugins,
TypeScript), so rebuild after those too.

## Conventions

- Commits follow Conventional Commits; the git hooks run commitlint and lint-staged. `feat` and
  `fix` commits end up in the generated changelog.
- Dependencies are pinned exactly (`saveExact: true`). Add them with `pnpm add -E`.
- A change to the action's interface updates `action.yml`, the inputs and outputs tables and the
  usage examples in `README.md`, and the tests together. A change to how it finds, diffs or reports
  databases updates the numbered description at the top of the README.

## Hard rules

Follow these in every change.

- **Never run pull request code.** The action clones the base and head branches into a temporary
  directory and only reads database files from them; nothing from the pull request is checked out
  into the workspace or executed. Keep it that way: `comment` mode runs under
  `pull_request_target` with a write token in consumers' workflows.
- **Keep `output` mode free of API writes.** It exists so the action can run with a read-only token
  under `pull_request`. Any write belongs in `comment` mode.
- **Never edit `dist/` by hand.** Rebuild it with `pnpm run package` (or `pnpm run all`) and commit
  it with the change that caused it.
- **Tests never reach GitHub.** Mock `@actions/github` and `@actions/core` as the existing tests do.
  Never put a real token or a real database key in a test, a fixture or a workflow.
- **Do not break workflows that use the action silently.** Removing or renaming an input or output,
  changing the meaning of `state`, or failing where the action used to succeed is a major release
  (see Versioning).
- **Keep the runtime and Node in step.** `runs.using` in `action.yml` and `.nvmrc` name the same
  Node major.
- **Do not lower a check to make it pass.** No `eslint-disable`, `@ts-expect-error`, skipped tests
  or zizmor ignores, unless the commit explains why the check is wrong for this case.
- **Do not bypass the git hooks** (`--no-verify`).

## Verify before you finish

A change is done when the checks for it pass locally. Report which commands you ran and their
result; if you skipped one, say so and why.

| You changed                          | Run                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Anything                             | `pnpm run all` (type check, lint, package, test; needs `sqlcipher` and `sqldiff`)                       |
| `src/`, `action.yml` or a dependency | `pnpm run all`, then check that `git status dist/` shows the rebuilt bundle and commit it               |
| Diffing, comments or output          | A test in `tests/` that fails without your change                                                       |
| Inputs, outputs or setup             | `action.yml`, the README tables and examples                                                            |
| `.github/workflows/`                 | `actionlint` and `GH_TOKEN=$(gh auth token) zizmor .github/workflows`; pin every action to a commit SHA |
| `README.md` or `AGENTS.md`           | `pnpm run lint` (Markdown is linted too)                                                                |

When a check fails, find the cause. Do not retry until it passes, and do not change a test to match
broken behavior.

## Git and pull requests

On top of the Conventions above, for agents:

- Branch names: `type/short-description` (`fix/encrypted-export`), never an agent-tool prefix such
  as `claude/`.
- End every commit you create or amend with exactly one of each trailer, after a blank line:

  ```text
  LLM-Model: <provider>/<model-id>
  Harness: <harness-name> <version>
  ```

  Use the model selected in the current session, and the version of the harness process that runs
  you, not of a CLI on `PATH` (a desktop app ships its own copy). Walk up the parent processes
  (`ps -o pid=,ppid=,args= -p <pid>`) to the binary and ask it for `--version`. If you cannot
  verify either value, ask before committing.

- No AI `Co-Authored-By` trailers and no "generated with" lines in commits, pull requests or code.
- Do not push to `main`, merge pull requests, create or move tags, or run `pnpm run release` unless
  the maintainer asks for that specific step.

## Recording what you learn

Before you finish, ask whether you hit something the next person would trip over. If you did, first
try to make a tool catch it: a lint rule, a test or a CI check. Write it down only when no tool can,
short and with the fix or the reason, in this file and in the same pull request. Unfinished work
goes to the maintainer as a proposed GitHub issue, never as a to-do list in this file.

## Dependency updates

Renovate lists updates on the Dependency Dashboard issue and opens pull requests only on approval
(`.github/renovate.json5`). The dashboard can lag behind npm, so check npm directly.

**Prefer one batched update over approving Renovate pull requests one at a time.** Use the
dashboard as the checklist, and do a maintenance pass by hand when updates have piled up and before
a release. A batch is a single branch and pull request, so the lockfile and `dist/` are rebuilt
once and CI and review run once. Renovate notices the merged versions and clears those dashboard
entries by itself. Tick a single dashboard box only for an update that cannot wait, such as a fix
for a security advisory.

### Policy

- **7-day release-age cooldown** in both `.github/renovate.json5` and `pnpm-workspace.yaml`.
  `@rotki/eslint-config` and `@rotki/eslint-plugin` are excluded.
- **Node and pnpm follow the runtime.** `@types/node`, `node` and the devcontainer image stay on
  24.x and pnpm on 12.x. Moving to a new Node major also changes `runs.using` in `action.yml`,
  which is a major release.
- **TypeScript stays below 7.** typescript-eslint and `@rollup/plugin-typescript` need the
  TypeScript 6 JavaScript API. Renovate enforces this.
- **Runner images:** the jobs that install `sqlcipher` stay on `ubuntu-24.04`. Moving them to a new
  Ubuntu release changes the `sqlcipher` and `sqldiff` versions the tests run against, so do it in
  its own change.
- **Overrides:** `pnpm-workspace.yaml` overrides `katex` (under `micromark-extension-math`) and
  `tinypool` (under `oxfmt`) for security advisories. Both come in through `@rotki/eslint-config`.
  Check on each pass whether the parents have caught up, and remove an override once they have.
- **Runtime dependencies are in the bundle.** An advisory in `@actions/core`, `@actions/github` or
  anything below them (`undici` for example) reaches every consumer, so fix it, rebuild `dist/` and
  release a patch.
- GitHub Actions are pinned by commit SHA with the version in a trailing comment.

### Procedure

1. Start from an up to date `main` on a branch such as `chore/deps-update`.
2. Gather the state: `pnpm audit`, `pnpm outdated`, and the dashboard
   (`gh issue list -R rotki/action-sqldiff --search "Dependency Dashboard in:title"`).
3. Check publish dates (`npm view <package> "time[<version>]"`) and skip anything younger than 7
   days.
4. Bump with `pnpm add -E` (runtime) and `pnpm add -D -E` (dev), keeping both `@commitlint/*`
   packages and `vitest` with `@vitest/coverage-v8` on the same version. Update pnpm with
   `corepack use pnpm@<version>` and action pins with
   `gh api repos/<owner>/<repo>/commits/<tag> -q .sha`.
5. Refresh vulnerable transitive packages with `pnpm update --depth Infinity <package> ...`, and
   trace what remains with `pnpm why`.
6. Run `pnpm run all` and commit the rebuilt `dist/`.
7. Commit in parts: `ci: update github actions` for workflow pins, and
   `chore(deps): update dependencies` (or `fix(deps):` when the bundle changes) for the rest, with
   `dist/`.

## Workflow changes

Check any change under `.github/workflows/`, including pin bumps, with both tools:

- [actionlint](https://github.com/rhysd/actionlint) checks that workflows are valid: syntax,
  expressions, references, action inputs, and `run:` scripts through shellcheck. Run `actionlint`
  from the repository root.
- [zizmor](https://docs.zizmor.sh/) checks workflow security. Run it with a token so the online
  audits (impostor commits, pin and comment mismatches, known-vulnerable actions) run too:

  ```sh
  GH_TOKEN=$(gh auth token) zizmor .github/workflows
  ```

The current baseline is no actionlint findings and one low zizmor finding, `self-repository`, on
`uses: ./` in `test-action.yml`. Running the action from the pull request is the point of that job,
so the finding is expected. A change must not add findings beyond this baseline. Keep the existing
patterns: `permissions: {}` at the top level with per-job grants, `persist-credentials: false` on
checkout, SHA pins with a version comment, and expressions that carry outside input passed to
`run:` through `env:`.

Keep the self-test on `pull_request`. It used to run on `pull_request_target`, which reads the
workflow from `main`: when a step there broke, the required check failed on every pull request and
no pull request could fix it.

## Releasing

A release is a version tag plus the moving major tag. Pushing a `vX.Y.Z` tag runs
`.github/workflows/release.yml`, which only creates the GitHub release with `changelogithub`. It
names the previous `vX.Y.Z` tag itself, so a major tag already on the release commit cannot confuse
it. Nothing is published to npm (the package is private).

1. Make sure `main` is green, contains everything for the release, and that the committed `dist/`
   is current.
2. Pick the version (see Versioning) and run `pnpm run release` (`bumpp --no-push`). It bumps
   `package.json`, commits `chore: release vX.Y.Z` and tags it locally.
3. Push the commit and the tag:

   ```sh
   git push origin main --follow-tags
   ```

4. Move the major tag to the same commit, so `@vN` users get the release:

   ```sh
   git tag -f vN vX.Y.Z
   git push -f origin vN
   ```

   This force-pushes a tag. Only ever move the major tag of the release line you just published,
   and only forward. Never move it across a major version.

5. Verify: `gh release view vX.Y.Z -R rotki/action-sqldiff`, and that `vN` and `vX.Y.Z` point at the
   same commit (`git rev-list -n1 vN` and `git rev-list -n1 vX.Y.Z`).

   If the release is missing, read the `release` run's log and fix the cause. To publish the
   notes for a tag that is already pushed, run `changelogithub` yourself with the previous release
   and the repository named, since `origin` can be a fork. For example:

   ```sh
   GITHUB_TOKEN=$(gh auth token) npx changelogithub@14.0.0 --github rotki/action-sqldiff \
     --from v3.1.0 --to v3.1.1
   ```

6. Update the consumer: change the `rotki/action-sqldiff@<sha> # vX.Y.Z` reference in
   `rotki/rotki`'s `.github/workflows/rotki_sqldiff.yml` to the new commit and version (Renovate in
   that repository may propose it).

### Versioning

Semantic versioning, applied to what workflows that use the action see:

- **Patch:** bug fixes and dependency updates that do not change behavior, including fixes for
  advisories in bundled dependencies.
- **Minor:** new optional inputs or outputs, new modes, and better reporting.
- **Major:** removed or renamed inputs or outputs, a changed meaning of `state` or of the comment,
  failing where it used to succeed, and a new Node runtime in `action.yml`. A major starts a new
  `vN` tag; the previous one stays where it is.

## Repository settings

These live in GitHub, not in the repository. Keep this list current when they change.

- `main` is protected: 1 approving review, and the `Check dist/`, `commit-lint`, `license/cla`,
  `Analyze` and `Test action (output mode)` checks must pass. `build` (the `pnpm run all` job) is
  not a required check, so look at it before merging. Admins are not held to the rules.
- `CODEOWNERS` assigns everything to `@rotki/maintainers`, which has write access.
- The release workflow uses only the built-in `GITHUB_TOKEN`. There are no environments or
  repository secrets.
