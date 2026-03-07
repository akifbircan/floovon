import React, { ReactNode } from 'react';
import { FileSearch } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: 'default' | 'soft';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Veri bulunamadı',
  description = 'Henüz kayıt bulunmamaktadır.',
  icon,
  action,
  variant = 'default',
}) => {
  const displayIcon = icon ?? <FileSearch size={28} aria-hidden />;
  return (
    <div className={`empty-state ${variant === 'soft' ? 'empty-state--soft' : ''}`}>
      <div className="empty-state-icon">{displayIcon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};




