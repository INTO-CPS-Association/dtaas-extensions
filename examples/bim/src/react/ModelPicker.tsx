/**
 * The menu that chooses a building model, and the chip that says whether a
 * model has converted geometry beside it.
 */

import { Chip, FormControl, ListItemText, MenuItem, Select, Typography } from '@mui/material';
import { formatSize, type BimModel } from './assets.js';

/** Says whether a model already has geometry beside it, in one word. */
export function StateChip({ model }: Readonly<{ model: BimModel }>) {
  return (
    <Chip
      size="small"
      label={model.geometryPath ? 'Converted' : 'From IFC'}
      color={model.geometryPath ? 'success' : 'default'}
      variant={model.geometryPath ? 'filled' : 'outlined'}
    />
  );
}

/**
 * Choose a model from a menu instead of from a list down the page.
 *
 * A library with a dozen IFC files pushed the viewer below the fold, so a
 * person scrolling a list of names had no way to tell there was a model drawn
 * underneath it. A menu keeps every file one click away and leaves the drawing
 * where the eye lands.
 */
export default function ModelPicker({
  models,
  chosen,
  onChoose,
}: Readonly<{
  models: BimModel[];
  chosen: BimModel | null;
  onChoose: (model: BimModel) => void;
}>) {
  return (
    // As wide as the messages below it, so the picker, the notices and the
    // drawing share one column and a long model name shows in full.
    <FormControl fullWidth size="small">
      {/* A heading and not a floating label, so the section is named before
          the control instead of inside it, the same way the chosen model is
          named above its drawing. */}
      <Typography variant="subtitle2" component="h2" id="bim-model-label" sx={{ mb: 1 }}>
        IFC Model
      </Typography>
      <Select
        // labelId and not aria-labelledby. Passed straight to Select, the
        // attribute lands on the outer box, and the element with the combobox
        // role, the one a screen reader announces, was left with no name.
        // labelId is the prop MUI puts on that element.
        labelId="bim-model-label"
        value={chosen?.ifcPath ?? ''}
        onChange={(event) => {
          const picked = models.find((model) => model.ifcPath === event.target.value);
          if (picked) onChoose(picked);
        }}
        // Only the name in the closed control. The size and the state belong in
        // the menu, where there is room for them.
        renderValue={(value) => models.find((model) => model.ifcPath === value)?.title ?? ''}
      >
        {models.map((model) => (
          <MenuItem key={model.ifcPath} value={model.ifcPath}>
            <ListItemText
              primary={model.title}
              secondary={formatSize(model.sizeBytes)}
              sx={{ mr: 2 }}
            />
            <StateChip model={model} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
