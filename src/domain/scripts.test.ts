import { describe, expect, it } from 'vitest';
import { afterMove, resultOf } from '../engine/game';
import { legalMoves } from '../engine/moves';
import { scriptedGame } from './scripts';

describe('scripted proof positions', () => {
  it('awards the win to white after one capture', () => {
    let state = scriptedGame('white-win');
    const moves = legalMoves(state.board, state.turn);
    expect(moves).toHaveLength(1);
    expect(moves[0].captures.length).toBe(1);
    state = afterMove(state, moves[0]);
    expect(resultOf(state)).toBe('white');
  });

  it('awards the win to black after one capture', () => {
    let state = scriptedGame('black-win');
    const moves = legalMoves(state.board, state.turn);
    expect(moves).toHaveLength(1);
    expect(moves[0].captures.length).toBe(1);
    state = afterMove(state, moves[0]);
    expect(resultOf(state)).toBe('black');
  });

  it('offers a multi-jump that does not end the game', () => {
    const state = scriptedGame('capture');
    const moves = legalMoves(state.board, state.turn);
    expect(moves.every((move) => move.captures.length === 2)).toBe(true);
    expect(resultOf(afterMove(state, moves[0]))).toBeNull();
  });
});
