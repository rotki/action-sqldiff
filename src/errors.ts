export class NotAPullRequestError extends Error {
  constructor() {
    super('Not a pull request');
    this.name = 'NotAPullRequestError';
  }
}
