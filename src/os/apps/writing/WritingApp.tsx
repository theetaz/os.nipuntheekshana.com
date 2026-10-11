import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useAtom } from 'jotai';
import type { AppProps } from '../../registry/apps';
import type { ClientPost, ClientPostSummary } from '../../types/content';
import { useAppData } from '../../lib/fetch-json';
import { copyWindowLink, openApp, useAppCommands, useAppMenuState } from '../../wm/commands';
import { matchRoute } from '../../url/routes';
import { queryFor } from '../../url/url';
import { textSizeAtom } from './preferences';
import { mainSiteUrl, type Folder, type TextSize, type WritingInitialData } from './data';
import { WritingView } from './views/WritingView';
export { menus } from './menus';

export default function WritingApp(props: AppProps) {
  const { route, windowId, ready, scrollRootRef } = props;
  const initial = props.initialData as WritingInitialData | null;
  const posts = useAppData<ClientPostSummary[]>('writing:index', '/data/writing.json', initial?.posts ?? null);
  const [size, setSize] = useAtom(textSizeAtom);
  const [folder, setFolder] = useState<Folder>('all');
  const [tag, setTag] = useState<string | null>(null); const [search, setSearch] = useState('');
  const [showFolders, setShowFolders] = useState(true);
  const calledReady = useRef(false); const focusAfterNavigation = useRef(false);
  const changeSize = useCallback((delta: -2 | 2) => setSize(value => Math.max(15, Math.min(19, value + delta)) as TextSize), [setSize]);
  const copyLink = useCallback(() => { void copyWindowLink(windowId); }, [windowId]);
  useAppCommands(windowId, command => {
    switch (command) {
      case 'writing.bigger': changeSize(2); return true;
      case 'writing.smaller': changeSize(-2); return true;
      case 'writing.folders': setShowFolders(value => !value); return true;
      case 'writing.copyLink': copyLink(); return true;
      case 'writing.openSite': window.open(mainSiteUrl(route), '_blank', 'noopener,noreferrer'); return true;
      default: return false;
    }
  });
  useAppMenuState(windowId, useMemo(() => ({
    'writing.bigger': { disabled: size === 19 }, 'writing.smaller': { disabled: size === 15 },
    'writing.folders': { checked: showFolders },
  }), [size, showFolders]));
  const contentReady = useCallback(() => {
    if (!calledReady.current) { calledReady.current = true; ready(); }
    if (focusAfterNavigation.current) {
      focusAfterNavigation.current = false;
      const root = scrollRootRef.current;
      const heading = root?.querySelector<HTMLElement>('h1');
      (heading ?? root)?.focus({ preventScroll: true });
    }
  }, [ready, scrollRootRef]);
  const select = (slug: string) => { focusAfterNavigation.current = true; props.navigate(slug, { title: 'Writing' }); };
  const back = () => { focusAfterNavigation.current = true; props.navigate('', { title: 'Writing' }); };
  const selectFolder = (next: Folder) => { setFolder(next); setTag(null); if (route) back(); };
  const selectTag = (next: string | null) => { setTag(next); setFolder('all'); if (route) back(); };
  const shared = { posts: posts.data ?? [], route, focused: props.focused, folder, tag, search, size, showFolders,
    error: posts.error, scrollRootRef, onSelect: select, onBack: back, onFolderChange: selectFolder,
    onTagChange: selectTag, onSearchChange: setSearch, onTextSize: changeSize, onCopyLink: copyLink, onRetry: posts.retry,
    onLinkClick: (url: URL) => {
      const target = matchRoute(url.pathname);
      if (!target) return false;
      if (url.hash && target.appId === 'writing' && target.route === route) return false;
      openApp(target.appId, { route: target.route, query: queryFor(target.appId, Object.fromEntries(url.searchParams)) }); return true;
    },
  };
  if (route && !posts.data) return <WritingIndex {...shared} contentReady={contentReady} listReady={!!posts.error} />;
  if (route && posts.data && !posts.data.some(post => post.slug === route)) return <WritingMissing {...shared} contentReady={contentReady} />;
  return route ? <WritingPost key={route} {...shared} initialPost={initial?.post?.slug === route ? initial.post : null}
    contentReady={contentReady} listReady={posts.data !== null || !!posts.error} setTitle={props.setTitle} />
    : <WritingIndex {...shared} contentReady={contentReady} listReady={posts.data !== null || !!posts.error} />;
}

function WritingMissing({ contentReady, ...view }: Omit<ComponentProps<typeof WritingView>, 'post'> & { contentReady: () => void }) {
  useLayoutEffect(contentReady, [contentReady]);
  return <WritingView {...view} post={null} notFound />;
}

function WritingIndex({ contentReady, listReady, ...view }: Omit<ComponentProps<typeof WritingView>, 'post'> & {
  contentReady: () => void; listReady: boolean;
}) {
  useLayoutEffect(() => { if (listReady) contentReady(); }, [listReady, contentReady]);
  return <WritingView {...view} post={null} />;
}
function WritingPost({ initialPost, contentReady, listReady, setTitle, ...view }: Omit<ComponentProps<typeof WritingView>, 'post'> & {
  route: string; initialPost: ClientPost | null; contentReady: () => void; listReady: boolean; setTitle: AppProps['setTitle'];
}) {
  const post = useAppData<ClientPost>(`writing:${view.route}`, `/data/writing/${encodeURIComponent(view.route)}.json`, initialPost);
  const notFound = listReady && !view.error && !view.posts.some(item => item.slug === view.route);
  const latestTitle = useRef(setTitle); latestTitle.current = setTitle;
  useLayoutEffect(() => {
    if (listReady && (post.data || post.error || notFound)) contentReady();
  }, [listReady, post.data, post.error, notFound, contentReady]);
  useEffect(() => { if (post.data) latestTitle.current(`${post.data.title} — Writing`); }, [post.data]);
  return <WritingView {...view} post={post.data} postError={post.error} notFound={notFound} onPostRetry={post.retry} />;
}
