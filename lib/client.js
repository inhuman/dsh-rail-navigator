window.__ModuleLoader__.load({
  id: '@inhuman/dsh-rail-navigator',
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require('react');
    const { createPortal } = require('react-dom');
    const h = React.createElement;
    const {
      Tooltip, StateDot, IconFolderCloseRegular, IconFolderOpenOutlineRegular, IconDeliverDocRegular,
    } = require('@deepseek-ai/dsh-client-ui-primitives');

    /** The workspace browser's persisted viewing store: order mode and saved manual orders. */
    const VIEW_STORE_KEY = 'dsh.workspace.view.v5';
    /** Order account of the Workspace-less group (tree.ts UNGROUPED_KEY). */
    const UNGROUPED_KEY = '';

    const SHEET = `
[data-slot='sidebar.footer.action'] .dsh-rail-nav__fallback { display: none; }
.dsh-rail-nav-host {
  overflow: hidden;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  min-block-size: 0;
}
.dsh-rail-nav {
  inline-size: 44px;
  min-block-size: 0;
  overflow: auto;
  scrollbar-width: none;
  overscroll-behavior: contain;
  padding-block: 4px;
}
.dsh-rail-nav::-webkit-scrollbar { display: none; }
.dsh-rail-nav__group { display: grid; justify-items: center; }
.dsh-rail-nav__group + .dsh-rail-nav__group { margin-block-start: 4px; }
.dsh-rail-nav__children {
  display: grid;
  justify-items: center;
  margin-inline-start: 6px;
  border-inline-start: 1px solid var(--dsw-alias-fill-l2);
}
.dsh-rail-nav__button {
  position: relative;
  display: grid;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  padding: 0;
  border: 0;
  border-radius: var(--dsw-radius-small, 6px);
  color: var(--dsw-alias-label-primary);
  background: transparent;
  cursor: pointer;
}
.dsh-rail-nav__children .dsh-rail-nav__button { inline-size: 30px; block-size: 32px; }
@media (hover: hover) {
  .dsh-rail-nav__button:hover { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh-rail-nav__button:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color);
  outline-offset: -2px;
}
.dsh-rail-nav__button[data-active] { color: var(--dsw-alias-brand-primary); }
.dsh-rail-nav__button[aria-current='page'] { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-rail-nav__dot {
  position: absolute;
  inset-block-start: 5px;
  inset-inline-end: 5px;
  display: grid;
  place-items: center;
  pointer-events: none;
}
`;

    /** Read the browser's saved viewing state; a restricted store reads as the defaults. */
    function readView() {
      try {
        const raw = localStorage.getItem(VIEW_STORE_KEY);
        if (raw === null) return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }

    function orderByRecency(ids, byId) {
      return ids
        .filter(id => byId[id] !== undefined)
        .map(id => ({ id, rank: byId[id].updatedAt ?? 0 }))
        .sort((a, b) => (a.rank === b.rank ? (a.id < b.id ? -1 : 1) : b.rank - a.rank))
        .map(entry => entry.id);
    }

    function reconcileManualOrder(memberIds, savedOrder, byId, pinned, archived) {
      const members = new Set(memberIds);
      const included = new Set();
      const ordered = [];
      for (const id of savedOrder ?? []) {
        if (!members.has(id) || included.has(id)) continue;
        ordered.push(id);
        included.add(id);
      }
      const pins = [];
      for (const id of pinned) {
        if (!members.has(id) || included.has(id) || archived.has(id) || byId[id] === undefined) continue;
        pins.push(id);
        included.add(id);
      }
      const ordinary = [];
      const archives = [];
      for (const id of orderByRecency([...members].filter(id => !included.has(id)), byId)) {
        if (archived.has(id)) archives.push(id);
        else ordinary.push(id);
      }
      return [...pins, ...ordered, ...ordinary, ...archives];
    }

    /** One account's Session ids in the expanded browser's order. */
    function orderedMembers(memberIds, accountKey, view, byId, pinned, archived) {
      return view.orderBy === 'manual'
        ? reconcileManualOrder(memberIds, view.sessionOrderByAccount?.[accountKey], byId, pinned, archived)
        : orderByRecency(memberIds, byId);
    }

    /** Primary state dot of one Session, matching the expanded browser's precedence. */
    function statusState(status) {
      if (status === undefined) return 'idle';
      if (status.pendingInteraction !== undefined) return 'warning';
      if (status.completionFailed) return 'error';
      if (status.completionUnread) return 'done';
      if (status.running) return 'ongoing';
      return 'idle';
    }

    function projectTree(sessions, workspaces, statuses, labels) {
      const view = readView();
      const byId = sessions.byId ?? {};
      const archived = new Set(workspaces.archivedSessionIds ?? []);
      const pinned = workspaces.pinnedSessionIds ?? [];
      const assigned = new Set((workspaces.items ?? []).flatMap(workspace => workspace.sessionIds));
      const current = Object.values(byId).find(row => (row.retainedBy?.mainView ?? 0) > 0)?.id;
      const blank = current !== undefined && byId[current]?.blank === true ? current : undefined;
      const rows = (ids) => {
        const visible = ids.filter((id) => {
          const row = byId[id];
          return row !== undefined && !archived.has(id) && row.origin !== 'subagent' && (!row.blank || id === current);
        });
        return [blank !== undefined && visible.includes(blank) ? blank : undefined, ...visible]
          .filter((id, index, list) => id !== undefined && list.indexOf(id) === index)
          .map(id => ({
            id,
            active: id === current,
            title: byId[id].displayTitle || labels.untitledSession,
            state: statusState(statuses?.get(id)),
          }));
      };
      const groups = (workspaces.items ?? []).map((workspace) => {
        const members = orderedMembers(
          workspace.sessionIds ?? [], workspace.workspaceId, view, byId, pinned, archived,
        );
        return {
          key: workspace.workspaceId,
          title: workspace.title?.trim() || labels.untitledWorkspace,
          rows: rows(members),
        };
      });
      const ungrouped = orderedMembers(
        sessions.ids.filter(id => byId[id] !== undefined && !assigned.has(id)),
        UNGROUPED_KEY, view, byId, pinned, archived,
      );
      const loose = rows(ungrouped);
      if (loose.length > 0) groups.push({ key: UNGROUPED_KEY, title: labels.ungrouped, rows: loose });
      return { groups, expansion: view.groupExpansion ?? {} };
    }

    function IconButton({ label, status, icon, size, ...button }) {
      return h(Tooltip, { label, side: 'right', delayMs: 350, portal: true },
        h('button', { type: 'button', className: 'dsh-rail-nav__button', 'aria-label': label, ...button },
          h('span', { 'aria-hidden': true }, h(icon, { size })),
          status === undefined || status === 'idle'
            ? null
            : h('span', { className: 'dsh-rail-nav__dot' }, h(StateDot, { state: status, size: status === 'ongoing' ? 12 : 8 }))));
    }

    const messages = {
      en: {
        navigation: 'Workspaces and sessions', untitledWorkspace: 'Workspace',
        untitledSession: 'New session', ungrouped: 'Ungrouped sessions',
      },
      ru: {
        navigation: 'Воркспейсы и сессии', untitledWorkspace: 'Воркспейс',
        untitledSession: 'Новая сессия', ungrouped: 'Сессии без воркспейса',
      },
    };

    function RailTree({ useWorkspaces, useSessions, useSessionStatus, openSession }) {
      const sessions = useSessions(value => value);
      const workspaces = useWorkspaces(value => value);
      const statuses = useSessionStatus(value => value);
      const [overrides, setOverrides] = React.useState(() => new Map());
      const id = React.useId();
      const language = document.documentElement.lang.split('-')[0];
      const labels = language === 'ru' ? messages.ru : messages.en;
      const projected = React.useMemo(
        () => projectTree(sessions, workspaces, statuses, labels),
        [sessions, workspaces, statuses, labels],
      );
      const groups = projected.groups;
      if (groups.length === 0) return null;
      const currentGroup = groups.find(group => group.rows.some(row => row.active));
      const defaultGroup = currentGroup ?? groups.find(group => group.rows.length > 0);
      return h('nav', { className: 'dsh-rail-nav', 'data-rail-navigator': '', 'aria-label': labels.navigation },
        groups.map((group) => {
          const expanded = overrides.get(group.key)
            ?? projected.expansion[group.key]
            ?? group === defaultGroup;
          const childrenId = `${id}-${group.key}`;
          return h('div', { className: 'dsh-rail-nav__group', key: group.key },
            h(IconButton, {
              label: group.title,
              size: 20,
              icon: expanded ? IconFolderOpenOutlineRegular : IconFolderCloseRegular,
              'aria-expanded': expanded,
              'aria-controls': childrenId,
              'data-active': group === currentGroup ? '' : undefined,
              onClick: () => setOverrides(previous => new Map(previous).set(group.key, !expanded)),
            }),
            h('div', {
              id: childrenId,
              className: 'dsh-rail-nav__children',
              hidden: !expanded,
              style: expanded ? undefined : { display: 'none' },
            }, expanded && group.rows.map(row => h(IconButton, {
              key: row.id,
              label: row.title,
              status: row.state,
              icon: IconDeliverDocRegular,
              size: 15,
              'aria-current': row.active ? 'page' : undefined,
              'data-active': row.active ? '' : undefined,
              onClick: () => openSession(row.id),
            }))),
          );
        }));
    }

    /** The collapsed browser's header row owns the add control our host follows. */
    function railAnchor() {
      const collapsed = document.querySelector('[data-sidebar-collapsed]');
      if (collapsed === null) return undefined;
      const header = collapsed.querySelector('[data-sidebar-workspace-header]');
      if (header === null || header.parentElement === null) return undefined;
      return header;
    }

    function RailNavigator({ wide, ...props }) {
      return wide ? null : h(RailMount, props);
    }

    function RailMount(props) {
      const [host] = React.useState(() => {
        const element = document.createElement('div');
        element.className = 'dsh-rail-nav-host';
        element.setAttribute('data-rail-navigator-host', '');
        return element;
      });
      const [attached, setAttached] = React.useState(false);

      React.useEffect(() => {
        let hiddenSearch;
        const sync = () => {
          const header = railAnchor();
          if (header === undefined) {
            if (host.isConnected) host.remove();
            setAttached(false);
            return;
          }
          if (header.nextElementSibling !== host) header.after(host);
          // The rail's own search control is replaced by this tree while mounted.
          const search = host.nextElementSibling;
          if (search !== null && search !== hiddenSearch && search.querySelector('button[aria-label]') !== null) {
            hiddenSearch = search;
            search.setAttribute('data-rail-navigator-hidden', '');
            search.style.display = 'none';
          }
          setAttached(true);
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sidebar-collapsed'] });
        return () => {
          observer.disconnect();
          if (hiddenSearch !== undefined) {
            hiddenSearch.style.removeProperty('display');
            hiddenSearch.removeAttribute('data-rail-navigator-hidden');
          }
          host.remove();
        };
      }, [host]);

      if (!attached) return null;
      return createPortal(h(RailTree, props), host);
    }

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style');
        style.id = 'dsh-rail-navigator';
        style.textContent = SHEET;
        document.head.append(style);
        return () => style.remove();
      }, 'dsh-rail-navigator: stylesheet');
      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'rail-navigator',
        order: -10,
        inject: () => ({ openSession: sessionId => ctx.uiWorkspace.openSession(sessionId) }),
      }, RailNavigator));
    }

    exports.name = '@inhuman/dsh-rail-navigator';
    exports.inject = ['slots', 'uiWorkspace'];
    exports.apply = apply;
    return module.exports;
  },
});
