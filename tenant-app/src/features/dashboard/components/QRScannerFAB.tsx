import React from 'react';

interface QRScannerFABProps {
  onOpen: () => void;
  /** Index sayfasında navbar üstüne hizalamak için qr-fab-index */
  className?: string;
}

/**
 * QR Scanner Floating Action Button
 * Sadece mobilde görünür
 */
export const QRScannerFAB: React.FC<QRScannerFABProps> = ({ onOpen, className }) => {
  return (
    <button
      onClick={onOpen}
      className={`fixed bottom-6 right-6 md:hidden w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-50 flex items-center justify-center transition-all hover:scale-110 ${className ?? ''}`}
      aria-label="QR Kod Oku"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
        />
      </svg>
    </button>
  );
};

