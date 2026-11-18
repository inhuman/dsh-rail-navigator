# DSH rail navigator

An icon-only workspace and session tree in the 56px collapsed sidebar of DeepSeek Harness Web, directly below the add-workspace button where the rail's search icon used to sit. The expanded sidebar keeps its own search and tree untouched.

## Requirements

Tested on DSH Web `0.2.2-rc.4`.

## Install

Clone this repository and add the checkout directory in DSH's Plugins page, or run the following from the checkout:

```sh
dsh plugin --profile web add .
```

## Use

- Collapse the left sidebar. Folder icons appear below the add-workspace button; the current workspace is open by default.
- Hover or focus an icon to see its name. Click a folder to show or hide its sessions; click a session to open it without expanding the sidebar.
- Rows keep the order and the expand/collapse state the expanded browser saved: manual drag order when it sorts manually, update time when it sorts by recency.
- A session row carries the same primary state dot as the expanded tree: amber waits for your approval or answer, green reports an unread finished turn, red reports a failed turn, and the spinner marks running work.
- Scroll the tree when it exceeds the available height. Archived sessions and subagent sessions do not appear, and neither does an unused blank session.

The plugin has no Host routes, persistence, or model-visible behavior. It requires a layout that retains the sidebar rail when collapsed; it does not display inside a closed drawer.

Run `npm test` for the registration, workspace grouping, and session selection regression check.

## License

MIT
