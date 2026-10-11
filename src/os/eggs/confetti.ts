import { timedEffect } from './rain';
import type { OsStore } from '../state/store';
import { desktopAtom } from '../state/atoms';

export function confetti(store: OsStore, windowId: string): () => void {
  const layer = document.createElement('div'); layer.className = 'egg-overlay egg-confetti';
  layer.dataset.egg = 'confetti'; layer.dataset.particles = '40'; layer.setAttribute('aria-hidden', 'true'); layer.inert = true;
  const particles = Array.from({ length: 40 }, (_, index) => {
    const node = document.createElement('i'); node.className = index % 2 ? 'egg-coconut-green' : 'egg-coconut-brown'; layer.append(node);
    return { node, x: Math.random(), y: Math.random(), drift: (Math.random() - .5) * 90, radius: 4 + Math.random() * 4 };
  });
  return timedEffect(store, layer, 1500, (elapsed, reduced) => {
    const state = store.get(desktopAtom).windows[windowId];
    const rect = state?.rect ?? { x: 0, y: 32, w: innerWidth, h: innerHeight - 32 };
    const progress = Math.min(1, elapsed / 1500);
    for (const particle of particles) {
      const x = rect.x + particle.x * rect.w + (reduced ? 0 : particle.drift * progress);
      const y = rect.y + (reduced ? particle.y * rect.h : -12 + particle.y * 36 + progress * progress * rect.h);
      particle.node.style.width = particle.node.style.height = `${particle.radius}px`;
      particle.node.style.transform = `translate(${x}px, ${y}px)`;
      particle.node.style.opacity = String(reduced ? .65 : Math.min(1, (1 - progress) * 5));
    }
  });
}
