import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalOpenAnimation } from '../../../shared/hooks/useModalOpenAnimation';
import { formatPhoneNumber } from '../../../shared/utils/formatUtils';
import type { Order } from '../types';

interface OrderActionModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onAction: (action: string, order: Order) => void;
}

/**
 * QR okuma sonrası sipariş aksiyon modalı
 */
export const OrderActionModal: React.FC<OrderActionModalProps> = ({
  isOpen,
  order,
  onClose,
  onAction,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useModalOpenAnimation(isOpen, backdropRef, contentRef);

  if (!isOpen || !order) return null;

  const actions = [
    { id: 'view', label: 'Detayları Görüntüle', color: 'blue' },
    { id: 'deliver', label: 'Teslim Et', color: 'green' },
    { id: 'call', label: 'Ara', color: 'purple' },
    { id: 'navigate', label: 'Yol Tarifi Al', color: 'orange' },
    { id: 'archive', label: 'Arşivle', color: 'gray' },
  ];

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    orange: 'bg-orange-50 text-orange-700 hover:bg-orange-100',
    gray: 'bg-gray-50 text-gray-700 hover:bg-gray-100',
  };

  const overlay = (
    <div
      ref={modalRef}
      className="modal-react-order-action-overlay"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        data-modal-backdrop
        className="modal-react-order-action-backdrop fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="modal-react-order-action-wrapper flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div
          ref={contentRef}
          data-modal-content
          className="modal-react-order-action-container relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
        >
          {/* Header */}
          <div className="modal-react-order-action-content bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="modal-react-order-action-header flex items-start justify-between mb-4">
              <h3 className="modal-react-order-action-title text-lg font-medium leading-6 text-gray-900">
                Sipariş Aksiyonları
              </h3>
              <button
                onClick={onClose}
                className="modal-react-order-action-close text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Kapat</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Order Info */}
            <div className="modal-react-order-action-order-info mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="modal-react-order-action-order-name font-semibold text-gray-900">{order.musteriAdi}</p>
              {order.telefon && (
                <p className="modal-react-order-action-order-phone text-sm text-gray-600 mt-1">{formatPhoneNumber(order.telefon)}</p>
              )}
              {order.urun && (
                <p className="modal-react-order-action-order-product text-sm text-gray-600 mt-1">Ürün: {order.urun}</p>
              )}
            </div>

            {/* Actions */}
            <div className="modal-react-order-action-actions space-y-2">
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    onAction(action.id, order);
                    onClose();
                  }}
                  className={`modal-react-order-action-btn modal-react-order-action-btn-${action.id} w-full px-4 py-3 rounded-lg font-medium transition-colors ${colorClasses[action.color as keyof typeof colorClasses]}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

