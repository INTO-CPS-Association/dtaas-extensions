/**
 * The two legends: what the colours of the model mean, and what the heatmap means.
 *
 * The class legend reads the colours the model arrived with instead of a table written here, because an architect assigned them and a legend that invented its own would describe a different building.
 *
 * The heatmap legend states its range, and the range comes from the manifest instead of from the readings. A scale that rescaled itself would make a steady building look like a changing one, and a person reading two screenshots an hour apart would be comparing different things without being told.
 */

import { Box, Chip, ListItemButton, Paper, Stack, Typography } from '@mui/material';
import { RAMP_STOPS, type Zones } from '../index.js';
import type { SceneView } from '../viewer/index.js';

function Swatch({ colour }: Readonly<{ colour: string }>) {
  return (
    <Box
      sx={{
        width: 12,
        height: 12,
        borderRadius: 0.5,
        bgcolor: colour,
        // The theme's divider, so the edge of a pale swatch shows in both themes.
        border: 1,
        borderColor: 'divider',
        flexShrink: 0,
      }}
    />
  );
}

export interface ClassLegendProps {
  view: SceneView;
  /** Called after a pick, so the page repaints. */
  onChange: () => void;
}

/**
 * What the colours in this model mean, and where each class is.
 *
 * Picking a row lights every object of that class. A legend that only names
 * colours answers "what is this colour", and the question a person has in
 * front of a grey building is "where are the columns". The same row again
 * clears it, so nothing has to be found twice.
 */
export function ClassLegend({ view, onChange }: Readonly<ClassLegendProps>) {
  const colours = view.classColours();
  if (colours.size === 0) return null;

  // How many objects of each class, on the row instead of behind a hover. A
  // count is what a person wants from a legend, and a tooltip shows it one row
  // at a time in a box the browser styles.
  const counts = view.classCounts();

  const pick = (ifcClass: string) => {
    view.state.highlightedClass = view.state.highlightedClass === ifcClass ? null : ifcClass;
    view.refreshMaterials();
    onChange();
  };

  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Typography variant="caption" color="text.secondary">
        In This Model
      </Typography>
      <Stack sx={{ mt: 0.5, gap: 0.25 }}>
        {[...colours].map(([ifcClass, colour]) => (
          <ListItemButton
            key={ifcClass}
            dense
            selected={view.state.highlightedClass === ifcClass}
            onClick={() => pick(ifcClass)}
            // A host theme may give every list button a 44 pixel minimum, which
            // is right for a navigation drawer a finger has to hit and wrong for
            // a legend of dozens of classes, where it pushed most of the list
            // out of sight. Thirty two pixels keeps each row above the 24 pixel
            // target size WCAG 2.2 sets at level AA.
            sx={{ gap: 0.75, py: 0.2, minHeight: 32, borderRadius: 1 }}
          >
            <Swatch colour={colour} />
            <Typography variant="body2">{ifcClass.replace(/^Ifc/, '')}</Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ ml: 'auto', pl: 1.5, fontVariantNumeric: 'tabular-nums' }}
            >
              {counts.get(ifcClass) ?? 0}
            </Typography>
          </ListItemButton>
        ))}
      </Stack>
    </Paper>
  );
}

export interface HeatLegendProps {
  /** What the heatmap is averaging over, or null when nothing is current. */
  zones: Zones | null;
  /** The unit the readings are in, as the manifest declares it. */
  unit: string | undefined;
  /** How many objects the colouring actually reached. */
  coloured: number;
}

function hex(colour: number): string {
  return `#${colour.toString(16).padStart(6, '0')}`;
}

export function HeatLegend({ zones, unit, coloured }: Readonly<HeatLegendProps>) {
  if (!zones) {
    return (
      <Paper variant="outlined" sx={{ p: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Heatmap
        </Typography>
        <Typography variant="body2">No current reading to colour by.</Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Typography variant="caption" color="text.secondary">
        Heatmap
      </Typography>
      <Box
        sx={{
          mt: 0.5,
          height: 10,
          borderRadius: 0.5,
          background: `linear-gradient(to right, ${hex(RAMP_STOPS.cold)}, ${hex(RAMP_STOPS.middle)}, ${hex(RAMP_STOPS.warm)})`,
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.3 }}>
        <Typography variant="body2">
          {zones.low} {unit}
        </Typography>
        <Typography variant="body2">
          {zones.high} {unit}
        </Typography>
      </Box>
      <Chip size="small" sx={{ mt: 0.5 }} label={`${zones.counted} sensors, ${coloured} objects`} />
    </Paper>
  );
}

export interface ScaleLegendProps {
  /** The name of the colour scheme, as the visualisation declares it. */
  scheme: string;
  /** The scheme's colours from the low end to the high end, as CSS colours. */
  stops: readonly string[];
  /** The values at the two ends of the scale. */
  domain: readonly [number, number] | readonly number[];
  /** How many sensors the scale colours now. */
  sensors: number;
}

/**
 * The heatmap legend of a colour scale a visualisation declares, drawn as
 * the Buildings page draws its own heatmap legend: the `aec` substrate
 * colours its markers from the encodings and not from a manifest.
 */
export function ScaleLegend({ scheme, stops, domain, sensors }: Readonly<ScaleLegendProps>) {
  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Typography variant="caption" color="text.secondary">
        Heatmap
      </Typography>
      <Box
        sx={{
          mt: 0.5,
          height: 10,
          borderRadius: 0.5,
          background: `linear-gradient(to right, ${stops.join(', ')})`,
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.3 }}>
        <Typography variant="body2">{domain[0]}</Typography>
        <Typography variant="body2">{domain[1]}</Typography>
      </Box>
      <Chip size="small" sx={{ mt: 0.5 }} label={`${sensors} sensors, ${scheme}`} />
    </Paper>
  );
}
