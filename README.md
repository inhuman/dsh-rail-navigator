# DSH rail navigator

A compact session switcher for the 56px collapsed left sidebar rail in DeepSeek Harness Web.

The rail button opens a menu of the eight most recent top-level sessions, grouped by workspace. Selecting a row calls DSH's `uiWorkspace.openSession()` action, so the active session and workspace stay synchronized without expanding the sidebar.

## Requirements

- DSH Web `0.2.2-rc.2` or newer

## Install

```sh
dsh plugin --profile web add @inhuman/dsh-rail-navigator
```

Restart `dsh web`, then hard-refresh the browser.

## Use

1. Collapse the left sidebar.
2. Select the four-dot button above Settings in the rail.
3. Choose a session from its workspace group.

The plugin has no Host routes, persistence, or model-visible behavior.

## License

MIT
