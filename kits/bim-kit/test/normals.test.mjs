/**
 * Tests for the normals a converted model gets when its GLB carries none.
 * A lit material draws a surface without normals in black.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, BufferAttribute, BufferGeometry, Group, Mesh } from 'three';

import { addMissingNormals } from '../dist/esm/viewer/index.js';

/** A triangle with positions only, as `ifc_explorer.to_glb` writes it. */
function bareTriangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3),
  );
  return new Mesh(geometry);
}

test('a mesh without normals gets one per vertex, facing away from the face', () => {
  const triangle = bareTriangle();
  const model = new Group().add(triangle);
  assert.equal(addMissingNormals(model), 1);
  const normals = triangle.geometry.getAttribute('normal');
  assert.equal(normals.count, 3);
  assert.equal(Math.abs(normals.getY(0)), 1);
});

test('a mesh that already has normals keeps them', () => {
  const box = new Mesh(new BoxGeometry(1, 1, 1));
  const before = box.geometry.getAttribute('normal');
  assert.equal(addMissingNormals(new Group().add(box)), 0);
  assert.equal(box.geometry.getAttribute('normal'), before);
});

test('a group without geometry is left alone', () => {
  assert.equal(addMissingNormals(new Group().add(new Group())), 0);
});
