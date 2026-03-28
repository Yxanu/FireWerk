import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFreshResult } from '../src/generators/resultState.mjs';

test('does not treat an unchanged visible result surface as a fresh result', () => {
  const previousState = {
    count: 3,
    primaryFingerprint: 'main|img|blob:old-primary',
    fingerprints: [
      'main|img|blob:old-primary',
      'thumb|img|blob:old-thumb-1',
      'thumb|img|blob:old-thumb-2'
    ]
  };

  const currentState = {
    count: 3,
    primaryFingerprint: 'main|img|blob:old-primary',
    fingerprints: [
      'main|img|blob:old-primary',
      'thumb|img|blob:old-thumb-1',
      'thumb|img|blob:old-thumb-2'
    ]
  };

  assert.equal(hasFreshResult(previousState, currentState), false);
});

test('treats a changed primary fingerprint as a fresh result even when counts stay flat', () => {
  const previousState = {
    count: 3,
    primaryFingerprint: 'main|img|blob:old-primary',
    fingerprints: [
      'main|img|blob:old-primary',
      'thumb|img|blob:old-thumb-1',
      'thumb|img|blob:old-thumb-2'
    ]
  };

  const currentState = {
    count: 3,
    primaryFingerprint: 'main|img|blob:new-primary',
    fingerprints: [
      'main|img|blob:new-primary',
      'thumb|img|blob:old-thumb-1',
      'thumb|img|blob:old-thumb-2'
    ]
  };

  assert.equal(hasFreshResult(previousState, currentState), true);
});
