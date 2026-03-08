import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface WhatsAppContact {
  isim: string;
  telefon: string;
}

interface WhatsAppPhoneSelectorModalProps {
  isOpen: boolean;
  contacts: WhatsAppContact[];
  onSelect: (phone: string) => void;
  onClose: () => void;
  title?: string;
}

/**
 * WhatsApp telefon numarası seçim modalı
 * Eski sistemdeki wp-popup-container yapısına uygun
 */
export const WhatsAppPhoneSelectorModal: React.FC<WhatsAppPhoneSelectorModalProps> = ({
  isOpen,
  contacts,
  onSelect,
  onClose,
  title = 'Sipariş listesinin gönderileceği Whatsapp gönderim numarasını seçin',
}) => {
  // ESC tuşu ile kapatma
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Telefon numarasını formatla (+90 (507) 575 12 19)
  const formatPhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      const last10 = digits.slice(-10);
      return `+90 (${last10.substring(0, 3)}) ${last10.substring(3, 6)} ${last10.substring(6, 8)} ${last10.substring(8, 10)}`;
    }
    return phone;
  };

  // Telefon numarasını normalize et (90XXXXXXXXXX formatına)
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length >= 10) {
      return '90' + digits.substring(1);
    }
    if (!digits.startsWith('90') && digits.length >= 10) {
      return '90' + digits;
    }
    return digits;
  };

  if (!isOpen) return null;

  const overlay = (
    <div
      className="modal-react-whatsapp-phone-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-react-whatsapp-phone-popup" onClick={(e) => e.stopPropagation()}>
        <img src={`${import.meta.env.BASE_URL}assets/whatsapp.svg`} alt="WhatsApp" className="modal-react-whatsapp-phone-logo" />
        <h3 className="modal-react-whatsapp-phone-title">{title}</h3>
        <div className="modal-react-whatsapp-phone-button-group">
          {contacts.map((contact, index) => (
            <button
              key={index}
              className="modal-react-whatsapp-phone-button"
              data-tel={contact.telefon}
              onClick={() => {
                onSelect(normalizePhone(contact.telefon));
              }}
            >
              <strong>{contact.isim}</strong>
              <br />
              <small>{formatPhone(contact.telefon)}</small>
            </button>
          ))}
        </div>
        <button type="button" className="modal-react-whatsapp-phone-close" onClick={onClose}>
          VAZGEÇ
        </button>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};



