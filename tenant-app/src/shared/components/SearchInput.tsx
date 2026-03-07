/**
 * Ortak arama kutusu: ESC ile sıfırlama, içinde çarpı (clear) ikonu.
 * Tüm sayfalardaki searchbox'larda bu bileşen kullanılmalı (tek kaynak).
 *
 * Kullanım:
 *   <SearchInput value={query} onChange={setQuery} placeholder="Ara..." />
 * Stil: .search-input-wrapper, .search-input, .search-input-clear (dashboard-cards.css)
 */

import React, { useCallback, useRef } from 'react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Input wrapper için ek class (clear butonu ile birlikte sarmalayan div) */
  wrapperClassName?: string;
  /** Sol tarafta arama ikonu göster (index sayfası gibi). Varsayılan: true */
  showSearchIcon?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Ara...',
  className = '',
  id,
  'aria-label': ariaLabel,
  wrapperClassName = '',
  showSearchIcon = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onChange('');
        inputRef.current?.blur();
      }
    },
    [onChange]
  );

  return (
    <div className={`search-input-wrapper ${showSearchIcon ? 'search-input-wrapper-with-icon' : ''} ${wrapperClassName}`.trim()}>
      {showSearchIcon && <i className="icon-search search-input-icon" aria-hidden />}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`search-input ${className}`.trim()}
        id={id}
        aria-label={ariaLabel ?? placeholder}
        autoComplete="off"
      />
      {value.length > 0 && (
        <button
          type="button"
          className="search-input-clear"
          onClick={handleClear}
          aria-label="Aramayı temizle"
          tabIndex={-1}
        >
          <span aria-hidden>×</span>
        </button>
      )}
    </div>
  );
};




























