/**
 * Sıralanabilir tablo başlığı – tıklanınca asc/desc döngüsü
 */
import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface TableSortHeaderProps {
  field: string;
  label: string;
  currentSort: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string, direction: 'asc' | 'desc') => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export const TableSortHeader: React.FC<TableSortHeaderProps> = ({
  field,
  label,
  currentSort,
  sortDirection,
  onSort,
  className = '',
  align = 'left',
}) => {
  const isActive = currentSort === field;

  const handleClick = () => {
    if (isActive) {
      onSort(field, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(field, 'asc');
    }
  };

  const Icon = !isActive ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      className={`table-sort-header ${isActive ? 'table-sort-header--active' : ''} ${className}`}
      style={{ textAlign: align }}
      onClick={handleClick}
    >
      <span className="table-sort-header-inner">
        {label}
        <Icon size={14} className="table-sort-icon" aria-hidden />
      </span>
    </th>
  );
};
