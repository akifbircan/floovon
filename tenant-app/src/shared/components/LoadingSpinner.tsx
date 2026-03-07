import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 32,
  lg: 48,
} as const;

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const px = sizeMap[size];

  return (
    <div
      className={className}
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}
      aria-hidden
    >
      <div
        role="status"
        aria-label="Yükleniyor"
        style={{
          width: px,
          height: px,
          minWidth: px,
          minHeight: px,
          borderRadius: '50%',
          border: `2px solid currentColor`,
          borderRightColor: 'transparent',
          animation: 'loading-spinner-spin 0.7s linear infinite',
        }}
      >
        <span className="sr-only">Yükleniyor...</span>
      </div>
    </div>
  );
};




