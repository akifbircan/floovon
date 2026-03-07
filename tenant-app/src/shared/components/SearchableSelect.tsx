/**
 * Arama destekli açılır liste (combobox)
 * Müşteri / ürün gibi uzun listelerde yazarak arama yapılır.
 * Tüm stiller SearchableSelect.css içinde – inline stil yok.
 */

import React, { useState, useRef, useEffect } from 'react';
import './SearchableSelect.css';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  /** Ürün listesinde resim + ad göstermek için */
  imageUrl?: string;
}

interface SearchableSelectProps {
  value: string | number;
  options: SearchableSelectOption[];
  onChange: (value: string | number, option: SearchableSelectOption) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Seçiniz',
  disabled = false,
  id,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const displayImageUrl = selectedOption?.imageUrl;

  const filteredOptions = search.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().replace(/ı/g, 'i').includes(search.toLowerCase().replace(/ı/g, 'i'))
      )
    : options;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option.value, option);
    setSearch('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`searchable-select ${className}`.trim()}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`searchable-select-trigger ${selectedOption ? 'has-value' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        {displayImageUrl ? (
          <img src={displayImageUrl} alt="" />
        ) : null}
        <span className="searchable-select-trigger-text">{displayLabel}</span>
        <i className="fa-solid fa-chevron-down searchable-select-arrow" aria-hidden />
      </button>

      {open && (
        <div role="listbox" className="searchable-select-dropdown">
          <div className="searchable-select-search-wrap">
            <input
              type="text"
              className="searchable-select-search"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <ul className="searchable-select-list">
            {filteredOptions.length === 0 ? (
              <li className="searchable-select-empty">Sonuç yok</li>
            ) : (
              filteredOptions.map((option) => (
                <li
                  key={String(option.value)}
                  role="option"
                  aria-selected={String(option.value) === String(value)}
                  className="searchable-select-option"
                  onClick={() => handleSelect(option)}
                >
                  {option.imageUrl ? (
                    <img src={option.imageUrl} alt="" />
                  ) : null}
                  {option.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
