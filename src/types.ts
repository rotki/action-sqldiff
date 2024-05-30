export interface ComparedDatabases {
  readonly head: string;
  readonly base: string;
}

export interface FileVersions extends ComparedDatabases {
  readonly file: string;
}

export interface FileVersionsWithDiff {
  readonly file: string;
  readonly diff: string;
}
