import fs from 'node:fs';
import { beforeEach, expect, vi } from 'vitest';
import * as core from '@actions/core';
import { checkEncryptedDb, checkSQLCipherVersion, dumpDatabase, sqlDiff } from '../src/sqlcipher';
import { cleanupTmpDir } from '../src/fs';

const encDiff = `
INSERT INTO data(id,name) VALUES(3,'data_3');
UPDATE sqlite_sequence SET seq=3 WHERE rowid=1;
`.trim();

const encDiff2 = `
INSERT INTO data(id,name) VALUES(3,'data_3');
INSERT INTO data(id,name) VALUES(4,'data_4');
UPDATE sqlite_sequence SET seq=4 WHERE rowid=1;
`.trim();

describe('sqlcipher', () => {
  beforeEach(() => {
    cleanupTmpDir();
    vi.resetAllMocks();
    vi.spyOn(core, 'getInput').mockImplementation((x) => {
      if (x === 'db_key')
        return '123';
      return '';
    });
  });
  it('check version', () => {
    expect(checkSQLCipherVersion()).toBe(true);
  });

  it('detects an sqlcipher encrypted db', () => {
    expect(checkEncryptedDb('./__tests__/data/encrypted_1.db')).toBe(true);
  });

  it('detects a normal sqlite db', () => {
    expect(checkEncryptedDb('./__tests__/data/normal_1.db')).toBe(false);
  });

  it('dumps encrypted db as plaintext', () => {
    const db = dumpDatabase('./__tests__/data/encrypted_1.db', 'base');
    expect(checkEncryptedDb(db)).toBe(false);
    expect(fs.statSync(db).size).toBeGreaterThan(0);
    fs.rmSync(db);
  });

  it('dumps normal db as plaintext', () => {
    const db = dumpDatabase('./__tests__/data/normal_1.db', 'base');
    expect(checkEncryptedDb(db)).toBe(false);
    expect(fs.statSync(db).size).toBeGreaterThan(0);
    fs.rmSync(db);
  });

  it('creates a db diff', () => {
    const diff = sqlDiff('./__tests__/data/encrypted_1.db', './__tests__/data/encrypted_2.db');
    expect(fs.statSync(diff).size).toBeGreaterThan(0);
    const diffContent = fs.readFileSync(diff, { encoding: 'utf-8' }).trim();
    expect(diffContent).toEqual(encDiff);
    fs.rmSync(diff);
  });

  it('creates a normal db diff', () => {
    const diff = sqlDiff('./__tests__/data/normal_1.db', './__tests__/data/normal_2.db');
    expect(fs.statSync(diff).size).toBeGreaterThan(0);
    const diffContent = fs.readFileSync(diff, { encoding: 'utf-8' }).trim();
    expect(diffContent).toEqual(encDiff2);
    fs.rmSync(diff);
  });
});
