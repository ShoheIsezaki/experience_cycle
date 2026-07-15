import { WEATHER_OPTIONS, type Weather } from '../types';

interface Props {
  value: Weather | undefined;
  onChange: (w: Weather | undefined) => void;
}

/** 天気マーク5択。選択済みを再タップで解除。 */
export default function WeatherPicker({ value, onChange }: Props) {
  return (
    <div className="weather-picker" role="group" aria-label="今日の学習状態（天気）">
      {WEATHER_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={'weather-picker__btn' + (selected ? ' is-selected' : '')}
            aria-pressed={selected}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => onChange(selected ? undefined : opt.value)}
          >
            <span className="weather-picker__emoji" aria-hidden="true">
              {opt.emoji}
            </span>
          </button>
        );
      })}
    </div>
  );
}
