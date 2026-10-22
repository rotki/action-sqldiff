import fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';

const TMP_DIR = path.join(os.tmpdir(), 'action-sqldiff');

export function cleanupTmpDir() {
  fs.rmSync(TMP_DIR, { force: true, recursive: true });
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

export function writeOutputFile(file: string, content: string): void {
  const resolved = path.resolve(file);
  if (resolved === TMP_DIR || resolved.startsWith(TMP_DIR + path.sep))
    throw new Error(`output_file must be outside ${TMP_DIR}, which is deleted after the run: ${resolved}`);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content);
}

export function createDiffDir(): string {
  const dir = createTmpDir();
  const diffDir = path.join(dir, 'diff');
  if (!fs.existsSync(diffDir))
    fs.mkdirSync(diffDir);
  return diffDir;
}
