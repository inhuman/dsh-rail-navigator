import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

/** Boot the plugin against a stub DOM; the returned draw() renders the rail once. */
function setup({ stored } = {}) {
  let component;
  let injection;
  let instance = 0;
  const states = new Map();
  const effects = [];
  const calls = [];
  const store = new Map(stored === undefined ? [] : [['dsh.workspace.view.v5', JSON.stringify(stored)]]);
  const header = { nextElementSibling: null, parentElement: { append() {} }, after() {}, querySelector: () => null };
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useMemo: compute => compute(),
    useId: () => 'rail',
    useState: (initial) => {
      const key = `${instance}`;
      if (!states.has(key)) states.set(key, typeof initial === 'function' ? initial() : initial);
      return [states.get(key), (update) => {
        states.set(key, typeof update === 'function' ? update(states.get(key)) : update);
      }];
    },
    useEffect: (effect) => { effects.push(effect); },
  };
  const resolver = (name) => {
    if (name === 'react') return react;
    if (name === 'react-dom') return { createPortal: node => node };
    return {
      Tooltip: 'tooltip',
      StateDot: props => ({ type: 'dot', props, children: [] }),
      IconFolderCloseRegular: 'folder',
      IconFolderOpenOutlineRegular: 'open-folder',
      IconDeliverDocRegular: 'document',
    };
  };
  runInNewContext(code, {
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    },
    MutationObserver: class { observe() {} disconnect() {} },
    document: {
      documentElement: { lang: 'en' },
      createElement: () => ({
        className: '', isConnected: false, style: {}, nextElementSibling: null,
        setAttribute() {}, removeAttribute() {}, remove() {}, after() {},
      }),
      head: { append() {} },
      querySelector: () => ({ querySelector: () => header }),
      body: {},
    },
    window: {
      __ModuleLoader__: {
        load({ factory }) {
          const plugin = factory(resolver);
          plugin.apply({
            effect: (create) => { create(); },
            uiWorkspace: { openSession: id => calls.push(id) },
            slots: {
              inject(name, activate) { assert.equal(name, 'sidebar.footer.action'); activate(); },
              register(options, render) { injection = options.inject(); component = render; },
            },
          });
        },
      },
    },
  });

  const render = (props, nodes) => {
    instance = 0;
    const draw = () => {
      instance = 0;
      const tree = component({ ...props, ...injection, wide: false });
      return nodes(tree);
    };
    draw();
    for (const effect of effects.splice(0)) effect();
    return draw();
  };

  const walk = (node) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return Array.from(node).flatMap(walk);
    if (typeof node.type === 'function') {
      instance += 1;
      return walk(node.type(node.props));
    }
    return [node, ...node.children.flatMap(walk)];
  };

  return {
    calls,
    draw(props) {
      return render(props, walk);
    },
  };
}

const sessions = {
  ids: ['b1', 'a2', 'a1', 'child', 'blank', 'loose'],
  byId: {
    a1: { id: 'a1', displayTitle: 'Alpha one', updatedAt: 100, retainedBy: { mainView: 1 } },
    a2: { id: 'a2', displayTitle: 'Alpha two', updatedAt: 300 },
    b1: { id: 'b1', displayTitle: 'Beta one', updatedAt: 200 },
    child: { id: 'child', origin: 'subagent', displayTitle: 'Child' },
    blank: { id: 'blank', blank: true, displayTitle: 'Unused blank' },
    loose: { id: 'loose', displayTitle: 'Loose', updatedAt: 50 },
  },
};

const workspaces = {
  items: [
    { workspaceId: 'a', title: 'Alpha', sessionIds: ['a1', 'a2', 'child', 'blank'] },
    { workspaceId: 'b', title: 'Beta', sessionIds: ['b1'] },
  ],
  archivedSessionIds: [],
  pinnedSessionIds: [],
};

const props = (statuses) => ({
  useWorkspaces: select => select(workspaces),
  useSessions: select => select(sessions),
  useSessionStatus: select => select(new Map(Object.entries(statuses ?? {}))),
});

const labels = nodes => nodes.filter(node => node.type === 'button').map(node => node.props['aria-label']);
const dots = nodes => nodes.filter(node => node.type === 'dot').map(node => node.props.state);

test('manual order saved in the expanded browser drives the rail', () => {
  const { draw } = setup({
    stored: { orderBy: 'manual', sessionOrderByAccount: { a: ['a2', 'a1'] }, groupExpansion: { a: true, b: true, '': true } },
  });
  assert.deepEqual(
    labels(draw(props())),
    ['Alpha', 'Alpha two', 'Alpha one', 'Beta', 'Beta one', 'Ungrouped sessions', 'Loose'],
  );
});

test('recency order applies when the browser sorts by update time', () => {
  const { draw } = setup({ stored: { orderBy: 'updated', groupExpansion: { a: true, b: true, '': true } } });
  assert.deepEqual(
    labels(draw(props())),
    ['Alpha', 'Alpha two', 'Alpha one', 'Beta', 'Beta one', 'Ungrouped sessions', 'Loose'],
  );
});

test('status dots follow the expanded browser precedence and a click opens the Session', () => {
  const { draw, calls } = setup({
    stored: { orderBy: 'manual', sessionOrderByAccount: { a: ['a2', 'a1'] }, groupExpansion: { a: true, b: true, '': true } },
  });
  const nodes = draw(props({
    a1: { running: false, completionUnread: true },
    a2: { running: false, pendingInteraction: 'approval' },
    b1: { running: true },
  }));
  assert.deepEqual(dots(nodes), ['warning', 'done', 'ongoing']);
  nodes.find(node => node.type === 'button' && node.props['aria-label'] === 'Alpha two').props.onClick();
  assert.deepEqual(calls, ['a2']);
});
