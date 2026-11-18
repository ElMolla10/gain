const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectBuild } = require('./reserve-ios-build.cjs');
test('EAS ahead after failed upload', () => assert.equal(selectBuild(['51', '52'], '53'), '54'));
test('Apple ahead of EAS', () => assert.equal(selectBuild(['55', '52'], '53'), '56'));
test('matching counters', () => assert.equal(selectBuild(['52'], '52'), '53'));
test('invalid counters fail closed', () => {
  assert.throws(() => selectBuild(['52'], undefined));
  assert.throws(() => selectBuild(['9999'], '53'));
});
