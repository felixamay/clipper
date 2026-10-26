import { BLACK_MAN, Board, WHITE_MAN, sq } from '../engine/board';
import { GameState, startGame } from '../engine/game';

export type ScriptName = 'capture' | 'white-win' | 'black-win';

function place(entries: Array<[number, number, number]>): Board {
  const board = new Uint8Array(100);
  for (const [row, col, piece] of entries) board[sq(row, col)] = piece;
  return board;
}

export function scriptedGame(name: ScriptName): GameState {
  if (name === 'white-win') {
    return startGame(
      place([
        [4, 1, WHITE_MAN],
        [5, 2, BLACK_MAN],
      ]),
      'white',
    );
  }
  if (name === 'black-win') {
    return startGame(
      place([
        [5, 4, BLACK_MAN],
        [4, 5, WHITE_MAN],
      ]),
      'black',
    );
  }
  return startGame(
    place([
      [4, 1, WHITE_MAN],
      [5, 2, BLACK_MAN],
      [7, 4, BLACK_MAN],
      [0, 1, WHITE_MAN],
      [9, 8, BLACK_MAN],
    ]),
    'white',
  );
}

export function scriptNote(name: ScriptName): string {
  if (name === 'white-win') return 'Scripted position. White can win on this move.';
  if (name === 'black-win') return 'Scripted position. Black can win on this move.';
  return 'Scripted position. White has a capture of two pieces.';
}
