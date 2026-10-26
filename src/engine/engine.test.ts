import { describe, expect, it } from 'vitest';
import {
  BLACK_KING,
  BLACK_MAN,
  Board,
  WHITE_KING,
  WHITE_MAN,
  countPieces,
  initialBoard,
  sq,
} from './board';
import { evaluate } from './eval';
import { afterMove, startGame } from './game';
import { positionKey } from './hash';
import { applyMove, legalMoves, sameMove } from './moves';
import { chooseMove } from './search';

function place(entries: Array<[number, number, number]>): Board {
  const board = new Uint8Array(100);
  for (const [row, col, piece] of entries) board[sq(row, col)] = piece;
  return board;
}

function mirror(board: Board): Board {
  const next = new Uint8Array(100);
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const piece = board[sq(row, col)];
      let swapped = 0;
      if (piece === WHITE_MAN) swapped = BLACK_MAN;
      else if (piece === WHITE_KING) swapped = BLACK_KING;
      else if (piece === BLACK_MAN) swapped = WHITE_MAN;
      else if (piece === BLACK_KING) swapped = WHITE_KING;
      next[sq(9 - row, 9 - col)] = swapped;
    }
  }
  return next;
}

describe('international draughts rules', () => {
  it('sets up 20 men a side on the dark squares', () => {
    const board = initialBoard();
    expect(countPieces(board, 'white')).toBe(20);
    expect(countPieces(board, 'black')).toBe(20);
    const whiteMoves = legalMoves(board, 'white');
    const blackMoves = legalMoves(board, 'black');
    expect(whiteMoves).toHaveLength(9);
    expect(blackMoves).toHaveLength(9);
    expect(whiteMoves.every((move) => move.captures.length === 0)).toBe(true);
  });

  it('makes a capture mandatory and ignores quiet moves', () => {
    const board = place([
      [4, 1, WHITE_MAN],
      [5, 2, BLACK_MAN],
      [4, 5, WHITE_MAN],
    ]);
    const moves = legalMoves(board, 'white');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.captures.length > 0)).toBe(true);
    expect(moves.some((move) => move.captures[0] === sq(5, 2) && move.path[1] === sq(6, 3))).toBe(true);
  });

  it('requires the line that takes the most pieces', () => {
    const board = place([
      [2, 1, WHITE_MAN],
      [3, 2, BLACK_MAN],
      [5, 4, BLACK_MAN],
      [2, 7, WHITE_MAN],
      [3, 8, BLACK_MAN],
    ]);
    const moves = legalMoves(board, 'white');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.captures.length === 2)).toBe(true);
    expect(moves.every((move) => move.path[0] === sq(2, 1))).toBe(true);
  });

  it('lets a man capture backward but only step forward', () => {
    const quiet = place([[4, 3, WHITE_MAN]]);
    const dests = legalMoves(quiet, 'white').map((move) => move.path[1]);
    expect(dests).toContain(sq(5, 2));
    expect(dests).toContain(sq(5, 4));
    expect(dests).not.toContain(sq(3, 2));

    const backward = place([
      [4, 3, WHITE_MAN],
      [3, 2, BLACK_MAN],
    ]);
    const moves = legalMoves(backward, 'white');
    expect(moves.some((move) => move.captures[0] === sq(3, 2) && move.path[1] === sq(2, 1))).toBe(true);
    expect(moves.every((move) => move.captures.length > 0)).toBe(true);
  });

  it('lets a flying king travel any number of empty squares', () => {
    const board = place([[0, 1, WHITE_KING]]);
    const dests = legalMoves(board, 'white').map((move) => move.path[1]);
    expect(dests).toContain(sq(1, 2));
    expect(dests).toContain(sq(5, 6));
    expect(dests).toContain(sq(8, 9));
    expect(dests).toContain(sq(1, 0));
    expect(dests).not.toContain(sq(0, 3));
  });

  it('lets a flying king capture from a distance and stop on any square beyond', () => {
    const board = place([
      [1, 2, WHITE_KING],
      [4, 5, BLACK_MAN],
    ]);
    const moves = legalMoves(board, 'white');
    const landings = moves.map((move) => move.path[move.path.length - 1]);
    expect(landings).toContain(sq(5, 6));
    expect(landings).toContain(sq(6, 7));
    expect(landings).toContain(sq(8, 9));
    expect(landings).not.toContain(sq(3, 4));
    expect(moves.every((move) => move.captures.length === 1 && move.captures[0] === sq(4, 5))).toBe(true);
    for (const move of moves) {
      expect(new Set(move.captures).size).toBe(move.captures.length);
    }
  });

  it('stops a flying king when no empty square lies beyond the piece', () => {
    const board = place([
      [1, 2, WHITE_KING],
      [3, 4, BLACK_MAN],
      [4, 5, BLACK_MAN],
    ]);
    const moves = legalMoves(board, 'white');
    expect(moves.every((move) => move.captures.length === 0)).toBe(true);
  });

  it('promotes a man that ends its turn on the back rank', () => {
    const board = place([[8, 1, WHITE_MAN]]);
    const move = legalMoves(board, 'white').find((candidate) => ((candidate.path[1] / 10) | 0) === 9);
    expect(move).toBeTruthy();
    const next = applyMove(board, move!);
    expect(next[move!.path[1]]).toBe(WHITE_KING);

    const black = place([[1, 2, BLACK_MAN]]);
    const blackMove = legalMoves(black, 'black').find((candidate) => ((candidate.path[1] / 10) | 0) === 0);
    expect(applyMove(black, blackMove!)[blackMove!.path[1]]).toBe(BLACK_KING);
  });

  it('keeps a man from promoting until a capture sequence is finished', () => {
    const continuing = place([
      [7, 2, WHITE_MAN],
      [8, 3, BLACK_MAN],
      [8, 5, BLACK_MAN],
    ]);
    const moves = legalMoves(continuing, 'white');
    expect(moves.every((move) => move.captures.length === 2)).toBe(true);
    for (const move of moves) {
      const dest = move.path[move.path.length - 1];
      expect((dest / 10) | 0).toBe(7);
      expect(applyMove(continuing, move)[dest]).toBe(WHITE_MAN);
    }

    const ending = place([
      [7, 2, WHITE_MAN],
      [8, 3, BLACK_MAN],
    ]);
    const only = legalMoves(ending, 'white');
    expect(only).toHaveLength(1);
    const dest = only[0].path[only[0].path.length - 1];
    expect(dest).toBe(sq(9, 4));
    expect(applyMove(ending, only[0])[dest]).toBe(WHITE_KING);
  });

  it('does not let a man fly just because a capture touched the back rank', () => {
    const board = place([
      [7, 0, WHITE_MAN],
      [8, 1, BLACK_MAN],
      [6, 5, BLACK_MAN],
    ]);
    const moves = legalMoves(board, 'white');
    expect(moves.every((move) => move.captures.length === 1)).toBe(true);
    expect(moves[0].path[moves[0].path.length - 1]).toBe(sq(9, 2));
    const next = applyMove(board, moves[0]);
    expect(next[sq(9, 2)]).toBe(WHITE_KING);
    expect(next[sq(6, 5)]).toBe(BLACK_MAN);
  });
});

describe('draws', () => {
  it('draws on threefold repetition', () => {
    let state = startGame(
      place([
        [2, 1, WHITE_KING],
        [7, 8, BLACK_KING],
      ]),
      'white',
    );
    const cycle = [
      [sq(2, 1), sq(3, 2)],
      [sq(7, 8), sq(6, 7)],
      [sq(3, 2), sq(2, 1)],
      [sq(6, 7), sq(7, 8)],
    ];
    for (let lap = 0; lap < 2; lap++) {
      for (const [from, to] of cycle) {
        const move = legalMoves(state.board, state.turn).find(
          (candidate) => candidate.path[0] === from && candidate.path[1] === to,
        );
        expect(move).toBeTruthy();
        state = afterMove(state, move!);
      }
    }
    expect(state.status).toEqual({ kind: 'draw', reason: 'repetition' });
  });

  it('draws after 25 quiet moves by each side', () => {
    let state = startGame(
      place([
        [1, 2, WHITE_KING],
        [8, 7, BLACK_KING],
      ]),
      'white',
    );
    let guard = 0;
    while (state.status.kind === 'playing' && guard < 80) {
      const moves = legalMoves(state.board, state.turn).filter((move) => {
        const dest = move.path[move.path.length - 1];
        const row = (dest / 10) | 0;
        return move.captures.length === 0 && (state.turn === 'white' ? row <= 3 : row >= 6);
      });
      expect(moves.length).toBeGreaterThan(0);
      let picked = moves[0];
      for (const move of moves) {
        const next = afterMove(state, move);
        const key = positionKey(next.board, next.turn);
        if ((next.seen.get(key) ?? 0) === 1) {
          picked = move;
          break;
        }
      }
      state = afterMove(state, picked);
      guard++;
    }
    expect(state.status).toEqual({ kind: 'draw', reason: 'no-progress' });
    expect(state.noProgress).toBe(50);
  });
});

describe('search', () => {
  const calm = { depth: 3, noise: 0, salt: 11 };

  it('returns a legal move for white and for black from the same engine', () => {
    const board = initialBoard();
    const whiteMove = chooseMove(board, 'white', calm, 1500);
    const blackMove = chooseMove(board, 'black', { ...calm, salt: 29 }, 1500);
    expect(whiteMove).not.toBeNull();
    expect(blackMove).not.toBeNull();
    expect(legalMoves(board, 'white').some((move) => sameMove(move, whiteMove!))).toBe(true);
    expect(legalMoves(board, 'black').some((move) => sameMove(move, blackMove!))).toBe(true);
    expect(Array.from(board)).toEqual(Array.from(initialBoard()));
  });

  it('plays the mandatory capture for either color', () => {
    const whiteBoard = place([
      [4, 1, WHITE_MAN],
      [5, 2, BLACK_MAN],
      [4, 5, WHITE_MAN],
    ]);
    const whiteMove = chooseMove(whiteBoard, 'white', { depth: 2, noise: 0, salt: 3 }, 800);
    expect(whiteMove?.captures.length).toBeGreaterThan(0);

    const blackBoard = place([
      [5, 2, BLACK_MAN],
      [4, 1, WHITE_MAN],
      [6, 5, BLACK_MAN],
    ]);
    const blackMove = chooseMove(blackBoard, 'black', { depth: 2, noise: 0, salt: 3 }, 800);
    expect(blackMove?.captures.length).toBeGreaterThan(0);
  });

  it('uses one symmetric evaluation for both colors', () => {
    const board = initialBoard();
    expect(evaluate(board, 'white', 0, 1)).toBe(0);
    const shifted = place([
      [2, 1, WHITE_MAN],
      [7, 4, BLACK_KING],
    ]);
    expect(evaluate(shifted, 'white', 0, 1)).toBe(evaluate(mirror(shifted), 'black', 0, 1));
  });

  it('answers inside the time box', () => {
    const started = performance.now();
    const move = chooseMove(initialBoard(), 'white', { depth: 8, noise: 4, salt: 5 }, 700);
    const elapsed = performance.now() - started;
    expect(move).not.toBeNull();
    expect(legalMoves(initialBoard(), 'white').some((candidate) => sameMove(candidate, move!))).toBe(true);
    expect(elapsed).toBeLessThan(1500);
  });
});
