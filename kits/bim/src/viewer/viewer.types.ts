/**
 * What a page hands the framework-free viewer and what it gets back.
 */

import type { Object3D } from 'three';

import type { Binding } from '../binding.js';
import type { FeedState, Reading } from '../readings.js';
import type { LookFrom } from './framing.js';
import type { PropertyTree, SceneView } from './sceneView.js';

/** What a page can do to the scene from outside. */
export interface ViewerHandle {
  view: SceneView;
  /** Put the whole model back in shot. */
  frame: () => void;
  /** Look from one of the six axes, or from the default corner. */
  look: (from: LookFrom) => void;
  /**
   * Redraw the sheet the Per Sensor scope lays over the floor. Separate from
   * `view.refresh` because that repaints the model's own objects, and the
   * sheet is beside the model and not one of them.
   */
  drawField: () => void;
  /** Put the selected object in shot. Does nothing when none is selected. */
  frameSelection?: () => void;
  /** Recolour the markers and rewrite their labels from the latest readings. */
  showReadings?: (readings: Map<string, Reading>, feed: FeedState, staleAfter?: number) => void;
}

/** What the view tells its owner. */
export interface ViewerEvents {
  /** The object the cursor is over, or null. */
  onHover?: (globalId: string | null) => void;
  /** The object selected, by a click on it or on its sensor, or null. */
  onSelect?: (globalId: string | null) => void;
}

/** A binding the resolver found an object for. */
export interface Placed {
  binding: Binding;
  object: { node: Object3D };
}

export interface ShowOptions {
  /** The sensors to mark, each with the object it sits on. */
  placed?: readonly Placed[];
  /** What the model says each object is, so a floor filter and a heatmap have something to group by. */
  tree?: PropertyTree;
  /** Where the camera first looks from. The default corner when absent. */
  from?: LookFrom;
}
