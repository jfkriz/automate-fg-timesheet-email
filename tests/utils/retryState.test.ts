import fs from 'fs';
import { readRetryState, writeRetryState, clearRetryState } from '../../src/utils/retryState';
import type { RetryState } from '../../src/interfaces/types';

jest.mock('fs');
const mockedFs = jest.mocked(fs);

const STATE_PATH = '/data/retry-state.json';

const sampleState: RetryState = {
  weekEnding: '2026-06-28',
  startedAt: '2026-06-22T09:00:00.000Z',
  expiresAt: '2026-06-23T09:00:00.000Z',
  attemptCount: 1,
  lastAttemptAt: '2026-06-22T09:00:00.000Z',
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('readRetryState', () => {
  it('returns null when file does not exist', () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockedFs.readFileSync.mockImplementation(() => { throw err; });
    expect(readRetryState(STATE_PATH)).toBeNull();
  });

  it('returns parsed state when file exists', () => {
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(sampleState));
    expect(readRetryState(STATE_PATH)).toEqual(sampleState);
  });

  it('throws when file read fails with a non-ENOENT error', () => {
    const err = new Error('permission denied');
    mockedFs.readFileSync.mockImplementation(() => { throw err; });
    expect(() => readRetryState(STATE_PATH)).toThrow('permission denied');
  });
});

describe('writeRetryState', () => {
  it('writes JSON to the file path', () => {
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    writeRetryState(STATE_PATH, sampleState);
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      STATE_PATH,
      JSON.stringify(sampleState, null, 2),
      'utf8',
    );
  });
});

describe('clearRetryState', () => {
  it('deletes the file', () => {
    mockedFs.unlinkSync.mockImplementation(() => undefined);
    clearRetryState(STATE_PATH);
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(STATE_PATH);
  });

  it('does not throw when file does not exist', () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockedFs.unlinkSync.mockImplementation(() => { throw err; });
    expect(() => clearRetryState(STATE_PATH)).not.toThrow();
  });
});
