window.__ModuleLoader__.load({
  id: '@inhuman/dsh-rail-navigator',
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require('react');
    const h = React.createElement;
    const { Menu, Tooltip } = require('@deepseek-ai/dsh-client-ui-primitives');

    const LIMIT = 8;
    const STYLE_ID = 'dsh-rail-navigator';

    const SHEET = `
.dsh-rail-nav__trigger { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: var(--dsw-radius-small); background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dsh-rail-nav__trigger:hover { background: var(--dsw-alias-fill-l2); color: var(--dsw-alias-label-primary); }
.dsh-rail-nav__trigger:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 1px; }
.dsh-rail-nav__glyph { display: grid; grid-template-columns: repeat(2, 6px); gap: 3px; }
.dsh-rail-nav__glyph > span { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.dsh-rail-nav__menu { width: min(320px, calc(100vw - 16px)); max-height: min(480px, calc(100vh - 16px)); overflow: auto; padding: 6px; }
.dsh-rail-nav__heading { margin: 6px 8px 4px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 16px; }
.dsh-rail-nav__workspace { margin: 2px 0 6px; }
.dsh-rail-nav__workspace-name { display: block; overflow: hidden; padding: 4px 8px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
.dsh-rail-nav__session { display: block; width: 100%; overflow: hidden; border: 0; border-radius: var(--dsw-radius-small); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 20px; padding: 5px 8px 5px 16px; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.dsh-rail-nav__session:hover { background: var(--dsw-alias-fill-l2); }
.dsh-rail-nav__session:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: -2px; }
.dsh-rail-nav__session--current { color: var(--dsw-alias-brand-primary); }
.dsh-rail-nav__empty { padding: 8px; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
`;

    function titleOf(session) {
      if (typeof session.displayTitle === 'string' && session.displayTitle.length > 0) return session.displayTitle;
      return 'New session';
    }

    function workspaceName(workspaces, workspaceId) {
      const items = Array.isArray(workspaces.items) ? workspaces.items : [];
      const item = items.find(candidate => candidate.id === workspaceId);
      if (item === undefined) return 'Other sessions';
      return typeof item.title === 'string' && item.title.length > 0 ? item.title : 'Untitled workspace';
    }

    function groupedSessions(sessions, workspaces) {
      const ids = Array.isArray(sessions.ids) ? sessions.ids : [];
      const byId = sessions.byId && typeof sessions.byId === 'object' ? sessions.byId : {};
      const current = typeof sessions.current === 'string' ? sessions.current : undefined;
      const groups = new Map();
      for (const id of ids.slice(0, LIMIT)) {
        const session = byId[id];
        if (session === undefined || session.subagent !== undefined && session.subagent !== null) continue;
        const workspaceId = typeof session.workspaceId === 'string' ? session.workspaceId : '';
        const group = groups.get(workspaceId) || { id: workspaceId, name: workspaceName(workspaces, workspaceId), sessions: [] };
        group.sessions.push({ id, title: titleOf(session), current: id === current });
        groups.set(workspaceId, group);
      }
      return [...groups.values()];
    }

    function RailNavigator(props) {
      const [open, setOpen] = React.useState(false);
      const sessions = props.useSessions(value => value);
      const workspaces = props.useWorkspaces(value => value);
      const groups = groupedSessions(sessions, workspaces);
      const narrow = props.wide === false;
      if (!narrow) return null;
      return h(Menu, {
        open,
        onClose: () => setOpen(false),
        portal: true,
        autoFocus: true,
        className: 'dsh-rail-nav__anchor',
        listClassName: 'dsh-rail-nav__menu',
        anchor: h(Tooltip, { label: 'Recent sessions', delayMs: 500, side: 'right', portal: true },
          h('button', {
            type: 'button', className: 'dsh-rail-nav__trigger', 'aria-label': 'Recent sessions',
            'aria-haspopup': 'menu', 'aria-expanded': open,
            onClick: () => setOpen(value => !value),
          }, h('span', { className: 'dsh-rail-nav__glyph', 'aria-hidden': true }, [0, 1, 2, 3].map(index => h('span', { key: index })))),
        ),
      }, [
        h('div', { className: 'dsh-rail-nav__heading', key: 'heading' }, 'Recent sessions'),
        groups.length === 0
          ? h('div', { className: 'dsh-rail-nav__empty', key: 'empty' }, 'No sessions yet')
          : groups.map(group => h('section', { className: 'dsh-rail-nav__workspace', key: group.id || 'other' }, [
            h('div', { className: 'dsh-rail-nav__workspace-name', key: 'name', title: group.name }, group.name),
            ...group.sessions.map(session => h('button', {
              type: 'button', key: session.id,
              className: session.current ? 'dsh-rail-nav__session dsh-rail-nav__session--current' : 'dsh-rail-nav__session',
              title: session.title,
              'aria-current': session.current ? 'page' : undefined,
              onClick: () => { setOpen(false); props.openSession(session.id); },
            }, session.title)),
          ])),
      ]);
    }

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = SHEET;
        if (document.getElementById(STYLE_ID) === null) document.head.append(style);
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
