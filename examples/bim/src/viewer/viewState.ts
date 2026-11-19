/**
 * What a person has switched on in the viewer, and what the property tree
 * says about each object. Plain data, so it is shared by the scene, the
 * shortcuts and any interface that draws them.
 */

import type { HeatScope } from '../readings.js';
import type { ModelStyle } from './appearance.js';
import type { MeasureMode } from './measure.js';
import type { SketchTool } from './sketch.js';

/**
 * What the property tree says about one object.
 *
 * Every field here is written by `ifc_converter.to_metadata` for every object,
 * so none of them is optional because the generator might skip it. They are
 * optional because a tree may come from somewhere else, or not exist at all.
 */
export interface ObjectFacts {
  /** The name the authoring tool gave it, usually family:type:instance. */
  name?: string;
  ifcClass?: string;
  /** IFC's own subtype, for instance a door that is a GATE or a REVOLVING. */
  predefinedType?: string;
  storey?: string;
  room?: string;
  /** What it is cut into: the wall a window sits in, for instance. */
  host?: string;
  /** The property sets the model carries, by set name. */
  properties?: Record<string, Record<string, unknown>>;
}

/** The property tree, as `ifc_converter.to_metadata` writes it. */
export interface PropertyTree {
  storeys?: Array<{ name: string }>;
  rooms?: Array<{ name: string }>;
  objects?: Record<string, ObjectFacts>;
}

/** The backgrounds a person can choose. */
export type Backdrop = 'light' | 'dim' | 'slate' | 'ink';

/** The colour of each background, the light one the colour the viewer always had. */
export const BACKDROPS: Record<Backdrop, number> = {
  light: 0xe9edef,
  dim: 0xc5ccd1,
  slate: 0x56636b,
  ink: 0x1d2327,
};

/** How far one press of j or k moves a cut, in metres. */
export const CUT_STEP_M = 0.25;

/** What a person has switched on. */
export interface ViewState {
  storey: string | null;
  heat: HeatScope;
  transparent: boolean;
  slabsHidden: boolean;
  selected: string | null;
  hovered: string | null;
  hoverHighlight: boolean;
  /**
   * An IFC class every member of which is highlighted, or null.
   *
   * A legend that only names colours answers "what is this colour" and not
   * "where are the columns", which is the question a person actually has in
   * front of a grey building. Picking the class in the legend answers it.
   */
  highlightedClass: string | null;
  /** Whether the floor in view is cut at chest height, so it reads as a plan. */
  sectioned: boolean;
  /** Whether the grid of metres under the model is drawn. */
  grid: boolean;
  /** The one object shown alone, or null when everything is shown. */
  isolated: string | null;
  /** What a click measures instead of selecting, or null when it selects. */
  measuring: MeasureMode | null;
  /** Whether the view draws with parallel lines, for reading plans and elevations. */
  parallel: boolean;
  /** Whether the sun throws shadows. */
  shadows: boolean;
  /** A vertical cut through the middle of the model, across the X or the Z axis, or none. */
  vertical: 'x' | 'z' | null;
  /** How far the horizontal cut is moved from chest height, in metres. */
  heightShift: number;
  /** How far the vertical cut is moved from the middle of the model, in metres. */
  depthShift: number;
  /** What the model is painted with, before any heatmap, highlight or ghost. */
  style: ModelStyle;
  /** The background behind the model. */
  backdrop: Backdrop;
  /** Whether the camera walks at eye height instead of orbiting. */
  walking: boolean;
  /** The tool drawing on the view, or null when the mouse drives the model. */
  sketching: SketchTool | null;
}

/**
 * Every toggle as a model opens. Hover highlighting and the class lit from
 * the legend are left out, since a reset keeps both: they are how a person
 * reads the model and not something they switched on to look at it.
 */
function openingToggles(): Omit<ViewState, 'hoverHighlight' | 'highlightedClass'> {
  return {
    storey: null,
    heat: 'off',
    transparent: false,
    slabsHidden: false,
    selected: null,
    hovered: null,
    sectioned: false,
    grid: true,
    isolated: null,
    measuring: null,
    parallel: false,
    shadows: true,
    vertical: null,
    heightShift: 0,
    depthShift: 0,
    style: 'shaded',
    backdrop: 'light',
    walking: false,
    sketching: null,
  };
}

/** The state of a model that was just opened. */
export function initialViewState(): ViewState {
  return { ...openingToggles(), hoverHighlight: true, highlightedClass: null };
}

/** A state with every toggle undone, keeping how the person reads the model. */
export function resetViewState(state: ViewState): ViewState {
  return { ...state, ...openingToggles() };
}
