import { useState } from 'react';
import {
  BROWS,
  DEFAULT_PORTRAIT,
  EYE_COLORS,
  EYE_SHAPES,
  FACE_SHAPES,
  FACIAL_HAIR,
  HAIR_COLORS,
  HAIR_STYLES,
  MOUTHS,
  NOSES,
  PortraitSpec,
  SKIN_TONES,
} from '../portrait/palette';
import { bodyFor } from '../scene/bodies';
import { Portrait } from './Portrait';

const CHOICES: Array<{ key: keyof PortraitSpec; label: string; options: readonly string[] }> = [
  { key: 'face', label: 'Face shape', options: FACE_SHAPES },
  { key: 'hairStyle', label: 'Hair', options: HAIR_STYLES },
  { key: 'eyeShape', label: 'Eyes', options: EYE_SHAPES },
  { key: 'brow', label: 'Brows', options: BROWS },
  { key: 'nose', label: 'Nose', options: NOSES },
  { key: 'mouth', label: 'Mouth', options: MOUTHS },
  { key: 'facialHair', label: 'Facial hair', options: FACIAL_HAIR },
];

export function Creator({ onSave, onCancel }: { onSave: (name: string, portrait: PortraitSpec) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [portrait, setPortrait] = useState<PortraitSpec>(DEFAULT_PORTRAIT);

  return (
    <div className="card-center">
      <form
        className="card creator"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onSave(name, portrait);
        }}
      >
        <div className="creator-grid">
          <div>
            <Portrait spec={portrait} body={bodyFor({ portrait })} id="draft" />
          </div>
          <div>
            <h2>New character</h2>
            <label className="field dark-field">
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={28} required />
            </label>
            <p className="label">Skin tone</p>
            <div className="swatches">
              {SKIN_TONES.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  className={portrait.skin === index ? 'swatch selected' : 'swatch'}
                  style={{ background: color }}
                  aria-label={`Skin tone ${index + 1}`}
                  onClick={() => setPortrait({ ...portrait, skin: index })}
                />
              ))}
            </div>
            <p className="label">Hair color</p>
            <div className="swatches">
              {HAIR_COLORS.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  className={portrait.hairColor === index ? 'swatch selected' : 'swatch'}
                  style={{ background: color }}
                  aria-label={`Hair color ${index + 1}`}
                  onClick={() => setPortrait({ ...portrait, hairColor: index })}
                />
              ))}
            </div>
            <p className="label">Eye color</p>
            <div className="swatches">
              {EYE_COLORS.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  className={portrait.eyeColor === index ? 'swatch selected' : 'swatch'}
                  style={{ background: color }}
                  aria-label={`Eye color ${index + 1}`}
                  onClick={() => setPortrait({ ...portrait, eyeColor: index })}
                />
              ))}
            </div>
            {CHOICES.map((choice) => (
              <label className="field dark-field" key={choice.key}>
                {choice.label}
                <select
                  value={String(portrait[choice.key])}
                  onChange={(event) => setPortrait({ ...portrait, [choice.key]: event.target.value })}
                >
                  {choice.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <div className="actions">
              <button className="btn paper" type="submit" disabled={!name.trim()}>
                Save character
              </button>
              <button className="btn secondary dark-ghost" type="button" onClick={onCancel}>
                Cancel
              </button>
            </div>
            <p className="quiet dark">Saved players keep their record in this browser.</p>
          </div>
        </div>
      </form>
    </div>
  );
}
