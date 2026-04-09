import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as core from '@actions/core';
import { gte } from 'semver';
import { createDBDir, createDiffDir } from './fs';
import { getDBKey } from './input';

export function checkSQLCipherVersion(): boolean {
  const version = execFileSync('sqlcipher', ['--version'], {
    encoding: 'utf-8',
  });

  const sqlCipherVersion = /SQLCipher (\d+\.\d+\.\d+)/.exec(version);
  if (!sqlCipherVersion || sqlCipherVersion.length <= 1)
    throw new Error(`Could not find SQLCipher version: ${version}`);

  core.info(`Detected SQLCipher v${sqlCipherVersion[1]}`);

  return gte(`v${sqlCipherVersion[1]}`, 'v4.5.0');
}

export function checkEncryptedDb(dbFile: string): boolean {
  if (!fs.existsSync(dbFile))
    throw new Error(`File does not exist: ${dbFile}`);

  try {
    const header = execFileSync('head', ['-c', '16', dbFile]);
    return !header.includes('SQLite format 3');
  }
  catch {
    return true;
  }
}

export function dumpDatabase(dbFile: string, type: 'base' | 'head'): string {
  const dbKey = getDBKey();
  const decryptionPragma = checkEncryptedDb(dbFile) ? `PRAGMA key = "${dbKey}";` : '';
  const diffDir = createDBDir(type, 'dump');
  const tmpDb = path.join(diffDir, path.basename(dbFile));

  const sql = [
    decryptionPragma,
    `ATTACH DATABASE '${tmpDb}' AS plaintext KEY '';`,
    `SELECT sqlcipher_export('plaintext');`,
    `DETACH DATABASE plaintext;`,
  ].join('\n');

  execFileSync('sqlcipher', [dbFile], {
    encoding: 'utf-8',
    input: sql,
  });

  return tmpDb;
}

export function sqlDiff(baseDB: string, headDb: string): string {
  const base = dumpDatabase(baseDB, 'base');
  const head = dumpDatabase(headDb, 'head');

  const diffs = createDiffDir();
  const diffFile = path.join(diffs, `${path.basename(base)}.diff`);

  const result = execFileSync('sqldiff', ['--primarykey', base, head], {
    encoding: 'utf-8',
  });
  fs.writeFileSync(diffFile, result);
  fs.rmSync(base);
  fs.rmSync(head);
  return diffFile;
}
