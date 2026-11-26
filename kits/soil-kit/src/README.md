# Sources

The code of the soil-kit, in three layers that depend only downwards.

| Folder   | What It Holds                                                                                 |
| :------- | :-------------------------------------------------------------------------------------------- |
| `core/`  | Domain logic with no React and no DTaaS host: topics, depths, units, channels and the heatmap |
| `react/` | Widgets that take plain props and know nothing of DTaaS                                       |
| `dtaas/` | The extension the host loads: page, substrate, anchor kind, presets and configuration schema  |

Only `dtaas/` imports the host's services, through `useHost()` or the `host`
argument the SDK passes. Every file here keeps to the SDK's lint rules for kits,
which the tests of the repository check.
