import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import GameHandCard from './GameHandCard.svelte';

afterEach(cleanup);

describe('GameHandCard', () => {
  it('keeps disabled cards fully opaque', () => {
    const { getByRole } = render(GameHandCard, {
      artwork: { kind: 'image', src: '/card.jpg', alt: 'Fairy 1' },
      rank: 1,
      suit: 'Fairies',
      disabled: true,
      ariaLabel: 'Fairies 1'
    });

    const card = getByRole('button', { name: 'Fairies 1' });
    expect(card.hasAttribute('disabled')).toBe(true);
    expect(getComputedStyle(card).opacity).toBe('1');
  });

  it('owns the common interactive card states', () => {
    const { getByRole } = render(GameHandCard, {
      artwork: { kind: 'image', src: '/card.jpg', alt: 'Queen 8' },
      rank: 8,
      suit: 'Queens',
      selected: true,
      playable: true,
      contributable: true,
      ariaLabel: 'Queens 8'
    });

    const card = getByRole('button', { name: 'Queens 8' });
    expect(card.classList.contains('playing-card')).toBe(true);
    expect(card.classList.contains('selected')).toBe(true);
    expect(card.classList.contains('playable')).toBe(true);
    expect(card.classList.contains('contributable')).toBe(true);
  });
});
