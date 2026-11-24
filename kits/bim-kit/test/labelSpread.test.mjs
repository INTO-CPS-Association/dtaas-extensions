/**
 * Tests for keeping the sensor labels apart when their sensors sit close
 * together on screen, as the reception and cabin sensors of room 02-24 do.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { spreadLabels, LABEL_GAP_PX } from '../dist/esm/viewer/index.js';

const box = (x, y, width = 100, height = 20) => ({ x, y, width, height });

test('labels far apart keep their places', () => {
  assert.deepEqual(spreadLabels([box(0, 100), box(300, 100)]), [0, 0]);
});

test('the higher of two crossing labels moves just above the lower one', () => {
  const lifts = spreadLabels([box(110, 290), box(100, 300)]);
  assert.equal(lifts[1], 0);
  // The label of y 290 must end its bottom gap pixels above the top of the other.
  assert.equal(lifts[0], 20 - 10 + LABEL_GAP_PX);
});

test('three labels on one spot make a stack without overlap', () => {
  const lifts = spreadLabels([box(0, 100), box(0, 100), box(0, 100)]).sort((a, b) => a - b);
  assert.deepEqual(lifts, [0, 20 + LABEL_GAP_PX, 2 * (20 + LABEL_GAP_PX)]);
});

test('labels side by side at the same height do not move', () => {
  assert.deepEqual(spreadLabels([box(0, 100), box(101, 100)]), [0, 0]);
});

test('no labels, no lifts', () => {
  assert.deepEqual(spreadLabels([]), []);
});
