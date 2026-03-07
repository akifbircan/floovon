import React, { ReactNode } from 'react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Bir hata oluştu',
  message = 'Lütfen daha sonra tekrar deneyiniz.',
  action,
}) => {
  return (
    <div className="backend-error-message">
      <div className="backend-error-message__icon">
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="backend-error-message__title">{title}</h3>
      <p className="backend-error-message__text">{message}</p>
      {action && <div className="backend-error-message__action">{action}</div>}
    </div>
  );
};




