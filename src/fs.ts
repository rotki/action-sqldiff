import fs from 'node:fs';
import * as path from 'node:path';

const TMP_DIR = '/tmp/action-sqldiff/';

export function cleanupTmpDir() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

export function createTmpDir(): string {
  if (!fs.existsSync(TMP_DIR))
    fs.mkdirSync(TMP_DIR);

  return TMP_DIR;
}

export function createDBDir(type: 'base' | 'head', subdir: 'repo' | 'dump'): string {
  const dir = createTmpDir();
  const diffDir = path.join(dir, subdir, type);
  if (!fs.existsSync(diffDir))
    fs.mkdirSync(diffDir, { recursive: true });
  return diffDir;
}

export function createDiffDir(): string {
  const dir = createTmpDir();
  const diffDir = path.join(dir, 'diff');
  if (!fs.existsSync(diffDir))
    fs.mkdirSync(diffDir);
  return diffDir;
}
