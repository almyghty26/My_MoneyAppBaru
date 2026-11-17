import React, { useEffect, useState } from 'react';
import { Check, Landmark, Palette } from 'lucide-react';
import { PRESET_COLORS } from '../constants/categories';
import {
  isPresetColor,
  isValidHexColor,
  loadCustomColorsFromStorage,
  normalizeHexColor,
} from '../utils/assetColors';

interface ColorPickerFieldProps {
  accountId?: string;
  label?: string;
  value: string;
  previewLabel?: string;
  onChange: (hexColor: string, isValid: boolean) => void;
}

export const ColorPickerField: React.FC<ColorPickerFieldProps> = ({
  accountId,
  label = 'Warna',
  value,
  previewLabel = 'Jenis Aset',
  onChange,
}) => {
  const normalizedInitial = normalizeHexColor(value) ?? PRESET_COLORS[0];
  const [customMode, setCustomMode] = useState<boolean>(!isPresetColor(normalizedInitial));
  const [hexInput, setHexInput] = useState<string>(normalizedInitial);
  const [lastValidColor, setLastValidColor] = useState<string>(normalizedInitial);
  const [savedCustomColors, setSavedCustomColors] = useState<string[]>(() =>
    loadCustomColorsFromStorage(accountId)
  );

  // Sync when opening Edit form with a previously saved color
  useEffect(() => {
    const normalized = normalizeHexColor(value) ?? PRESET_COLORS[0];
    setHexInput(normalized);
    setLastValidColor(normalized);
    setCustomMode(!isPresetColor(normalized));
    setSavedCustomColors(loadCustomColorsFromStorage(accountId));
  }, [value, accountId]);

  const hexValid = isValidHexColor(hexInput);
  const activePreviewColor = hexValid ? (normalizeHexColor(hexInput) ?? lastValidColor) : lastValidColor;

  const handleSelectPreset = (presetHex: string) => {
    const norm = normalizeHexColor(presetHex) ?? presetHex;
    setCustomMode(false);
    setHexInput(norm);
    setLastValidColor(norm);
    onChange(norm, true);
  };

  const handleEnableCustomMode = () => {
    setCustomMode(true);
    const current = normalizeHexColor(hexInput) ?? lastValidColor;
    setHexInput(current);
    onChange(current, true);
  };

  const handleNativeColorChange = (rawColor: string) => {
    const norm = normalizeHexColor(rawColor) ?? rawColor.toUpperCase();
    setCustomMode(true);
    setHexInput(norm);
    setLastValidColor(norm);
    onChange(norm, true);
  };

  const handleManualHexChange = (rawText: string) => {
    setCustomMode(true);
    const cleaned = rawText.slice(0, 7);
    setHexInput(cleaned);
    const norm = normalizeHexColor(cleaned);
    if (norm) {
      setLastValidColor(norm);
      onChange(norm, true);
    } else {
      onChange(cleaned, false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-mm-muted">{label}</span>
        <span className="text-[11px] font-mono-num text-mm-muted">
          {hexValid ? activePreviewColor : 'Format HEX tidak valid'}
        </span>
      </div>

      {/* Pilihan warna bawaan (Preset) + opsi Custom Color */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_COLORS.map((c) => {
          const isSelected = !customMode && hexValid && activePreviewColor === c.toUpperCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => handleSelectPreset(c)}
              className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-transform cursor-pointer ${
                isSelected ? 'border-mm-text scale-105' : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Pilih warna bawaan ${c}`}
              title={`Warna bawaan ${c}`}
            >
              {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleEnableCustomMode}
          aria-pressed={customMode}
          className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
            customMode
              ? 'bg-mm-brand/20 border-mm-brand text-mm-text'
              : 'bg-mm-bg border-mm-border text-mm-muted hover:text-mm-text'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-mm-brand shrink-0" />
          <span>Custom Color</span>
        </button>
      </div>

      {/* Riwayat warna custom yang tersimpan di Local Storage */}
      {savedCustomColors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-mm-muted">Warna Custom Tersimpan</p>
          <div className="flex flex-wrap items-center gap-2">
            {savedCustomColors.map((customHex) => {
              const isSelected =
                customMode && hexValid && activePreviewColor === customHex.toUpperCase();
              return (
                <button
                  key={customHex}
                  type="button"
                  onClick={() => handleNativeColorChange(customHex)}
                  className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-transform cursor-pointer ${
                    isSelected ? 'border-mm-text scale-105' : 'border-mm-border hover:scale-105'
                  }`}
                  style={{ backgroundColor: customHex }}
                  aria-label={`Pilih warna tersimpan ${customHex}`}
                  title={customHex}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Panel Custom Color: HTML Color Picker + Input HEX Manual + Preview Real-time */}
      {customMode && (
        <div className="rounded-xl bg-mm-bg border border-mm-border p-3.5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <label className="sm:col-span-5 flex items-center gap-2.5 cursor-pointer">
              <input
                type="color"
                value={activePreviewColor}
                onChange={(e) => handleNativeColorChange(e.target.value)}
                aria-label="HTML Color Picker"
                className="w-11 h-11 rounded-xl bg-transparent border border-mm-border p-0.5 cursor-pointer shrink-0"
              />
              <span className="text-xs text-mm-muted leading-tight">
                Pilih bebas dari palet warna
              </span>
            </label>

            <div className="sm:col-span-7 space-y-1">
              <label htmlFor="custom-hex-input" className="block text-[11px] text-mm-muted">
                Kode HEX Manual
              </label>
              <input
                id="custom-hex-input"
                type="text"
                value={hexInput}
                onChange={(e) => handleManualHexChange(e.target.value)}
                placeholder="#1677FF"
                maxLength={7}
                spellCheck={false}
                autoCapitalize="characters"
                className={`w-full min-h-[42px] px-3 rounded-xl bg-mm-surface border text-sm font-mono-num text-mm-text focus:outline-none ${
                  hexValid
                    ? 'border-mm-border focus:border-mm-brand'
                    : 'border-mm-expense focus:border-mm-expense'
                }`}
              />
            </div>
          </div>

          {!hexValid && (
            <p role="alert" className="text-xs text-mm-expense">
              Format kode HEX tidak valid. Gunakan 6 digit heksadesimal diawali # (contoh: #1677FF).
            </p>
          )}
        </div>
      )}

      {/* Real-time Preview sebelum disimpan */}
      <div className="rounded-xl bg-mm-bg border border-mm-border px-3.5 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: `${activePreviewColor}22`,
              borderColor: `${activePreviewColor}66`,
              color: activePreviewColor,
            }}
          >
            <Landmark className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-mm-muted">Preview Tampilan</p>
            <p className="text-xs font-semibold text-mm-text truncate">{previewLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: activePreviewColor }}
          />
          <span className="text-xs font-mono-num font-semibold text-mm-text">
            {activePreviewColor}
          </span>
        </div>
      </div>
    </div>
  );
};
