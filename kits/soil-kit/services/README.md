# Services

The kit folder that `dtaas-services` reads. An operator copies it to
`config/kits/soil/` of `dtaas-services`.

- `kit.json` names the kit and, for each table it owns, the columns that
  `dtaas-services twin register` fills from the `kits` part of a `twin.json`:
  `depth_from` and `depth_to` of `soil_sensor`.
- `migrations/` holds the SQL that creates those tables, run once per group
  database in file name order.

The tables are created in a group's database when the project `AUSoil` is added
to that group with `dtaas-services user add-history`, and
`dtaas-services twin register` fills them from a `twin.json`.
