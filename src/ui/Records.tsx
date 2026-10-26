import { RecordBook, winRate } from '../domain/character';

export function Records({ record }: { record: RecordBook }) {
  return (
    <dl className="record">
      <div>
        <dt>Played</dt>
        <dd>{record.played}</dd>
      </div>
      <div>
        <dt>Wins</dt>
        <dd>{record.wins}</dd>
      </div>
      <div>
        <dt>Losses</dt>
        <dd>{record.losses}</dd>
      </div>
      <div>
        <dt>Draws</dt>
        <dd>{record.draws}</dd>
      </div>
      <div>
        <dt>Win rate</dt>
        <dd>{winRate(record)}</dd>
      </div>
    </dl>
  );
}
