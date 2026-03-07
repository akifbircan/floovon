import React, { useState } from 'react';

interface DashboardActionsProps {
  onSicakSatis?: () => void;
  onSort?: () => void;
  onExport?: () => void;
}

/**
 * Dashboard Aksiyon Butonları
 * Sıcak Satış, Kartları Sırala, Dışa Aktar
 */
export const DashboardActions: React.FC<DashboardActionsProps> = ({
  onSicakSatis,
  onSort,
  onExport,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onSicakSatis}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Sıcak Satış
      </button>
      <button
        onClick={onSort}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Kartları Sırala
      </button>
      <div className="relative">
        <button
          onClick={() => setExportMenuOpen(!exportMenuOpen)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          Dışa Aktar .xls
          <span>▼</span>
        </button>
        {exportMenuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            <button
              onClick={() => {
                onExport?.();
                setExportMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
            >
              Excel (.xls)
            </button>
            <button
              onClick={() => {
                // TODO: PDF export
                setExportMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
            >
              PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
};




