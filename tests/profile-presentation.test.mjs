import test from 'node:test';
import assert from 'node:assert/strict';
import {profileDate,providerStartingRate} from '../lib/profile-presentation.mjs';

test('profile starting price uses the lowest real rate without inventing free service',()=>{
  assert.equal(providerStartingRate(),null);
  assert.equal(providerStartingRate([{rate:0},{rate:-1},{rate:NaN}]),null);
  assert.equal(providerStartingRate([{rate:52},{rate:25.75},{rate:0}]),25.75);
});

test('profile dates preserve calendar dates and use Bahamas time for timestamps',()=>{
  assert.equal(profileDate(),undefined);
  assert.equal(profileDate('bad date'),undefined);
  assert.equal(profileDate('2026-10-06'),profileDate('2026-10-06T12:00:00Z'));
  assert.equal(profileDate('2026-10-06T01:00:00Z'),profileDate('2026-10-05'));
});
