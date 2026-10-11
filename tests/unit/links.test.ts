import { describe, expect, it } from 'vitest';
import { classifyLink, type LinkAnchor, type LinkEvent } from '../../src/os/url/links';
const event: LinkEvent = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
const location = new URL('https://os.nipuntheekshana.com/writing/hello-world');
function anchor(href: string, attrs: Record<string, string> = {}, managed = false): LinkAnchor {
  return { href, hasAttribute: key => key in attrs, getAttribute: key => attrs[key] ?? null, closest: () => managed ? {} : null };
}
describe('link interception decisions', () => {
  it('opens internal app routes with only the app-owned query', () => {
    expect(classifyLink(event, anchor('/projects/salli?shot=1&unsafe=x'), location)).toEqual({ kind: 'app', appId: 'projects', route: 'salli', query: { shot: '1' } });
    expect(classifyLink(event, anchor('/maps/play'), location)).toMatchObject({ appId: 'maps', route: 'play' });
  });
  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey', 'defaultPrevented'] as const)('preserves %s clicks', key => {
    expect(classifyLink({ ...event, [key]: true }, anchor('/projects'), location)).toEqual({ kind: 'native' });
  });
  it('preserves downloads, targets, external relations, files, unknown routes, disabled apps, and non-primary clicks', () => {
    for (const [href, attrs] of [['/projects', { download: '' }], ['/projects', { target: '_blank' }], ['/projects', { rel: 'noopener external' }],
      ['/Nipun_Theekshana_CV.pdf', {}], ['/data/profile.json', {}], ['/nonexistent', {}], ['/postcards', {}], ['mailto:nipun@example.com', {}]] as [string, Record<string, string>][]) {
      expect(classifyLink(event, anchor(href, attrs), location)).toEqual({ kind: 'native' });
    }
    expect(classifyLink({ ...event, button: 1 }, anchor('/projects'), location)).toEqual({ kind: 'native' });
  });
  it('opens external links in managed or static windows and preserves native external chrome links', () => {
    expect(classifyLink(event, anchor('https://example.com', {}, true), location)).toEqual({ kind: 'external', href: 'https://example.com/' });
    expect(classifyLink(event, anchor('https://example.com'), location)).toEqual({ kind: 'native' });
  });
  it('switches Simple view and preserves same-document prose anchors', () => {
    expect(classifyLink(event, anchor('#simple'), location)).toEqual({ kind: 'simple', href: `${location.href}#simple` });
    expect(classifyLink(event, anchor('#chapter'), location)).toEqual({ kind: 'native' });
  });
});
