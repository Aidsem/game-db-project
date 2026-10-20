import test from 'node:test';
import assert from 'node:assert/strict';
import * as buildsView from '../app/static/js/views/builds.js';

test('the hash router can load the Builds page render entry point', () => {
  assert.equal(typeof buildsView.render, 'function');
});
