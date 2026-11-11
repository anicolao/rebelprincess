import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GameTable from './GameTable.svelte';
import type { HandCard, LocalSeat, OpponentSeat, TableRound, TrickPlay } from '$lib/game-ui';

afterEach(cleanup);

const image = (src: string) => ({ kind: 'image' as const, src });

const opponents: OpponentSeat[] = [{
  uid: 'other',
  name: 'Other Player',
  handCount: 4,
  active: true,
  leader: true,
  princess: { name: 'Cinderella', power: 'Ignore Princes when following.', artwork: image('/cinderella.jpg'), aspect: 2 / 3 }
}];

const round: TableRound = {
  name: 'Opening Night',
  rule: 'No additional rule.',
  artwork: image('/round.jpg'),
  current: 1,
  total: 4,
  passCount: 4,
  passDirection: 'left'
};

const localSeat: LocalSeat = {
  name: 'Local Player',
  handCount: 1,
  princess: { name: 'Dorothy', power: 'Hide one won trick.', artwork: image('/dorothy.jpg'), usable: false, aspect: 2 / 3 }
};

const handCards: HandCard[] = [{
  id: 'villagers-1',
  label: 'Villagers 1',
  artwork: image('/villagers-1.jpg'),
  rank: 1,
  suit: 'Villagers',
  aspect: 2 / 3,
  playable: true
}];

const trick: TrickPlay[] = [{
  id: 'other:knights-3',
  label: 'Knights 3',
  playerName: 'Other Player',
  artwork: image('/knights-3.jpg'),
  rank: 3,
  suit: 'Knights',
  aspect: 2 / 3
}];

describe('GameTable', () => {
  it('owns the complete shared table composition and card interaction', async () => {
    const onHandCard = vi.fn();
    const { getByLabelText, getByRole, getByText } = render(GameTable, {
      playerCount: 2,
      opponents,
      round,
      trick,
      localSeat,
      handCards,
      onHandCard
    });

    expect(getByLabelText("Other Player's hand")).toBeTruthy();
    expect(getByLabelText('Pass 4 left')).toBeTruthy();
    expect(getByLabelText('Current trick')).toBeTruthy();
    expect(getByText('Other Player')).toBeTruthy();
    expect(getByLabelText('Your seat')).toBeTruthy();

    await fireEvent.click(getByRole('button', { name: 'Villagers 1' }));
    expect(onHandCard).toHaveBeenCalledWith('villagers-1');
  });
});
