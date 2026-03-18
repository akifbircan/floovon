import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/lib/api';
import { AlertTriangle, Loader2, MessageCircle, X } from 'lucide-react';
import { formatPhoneNumber } from '../../../shared/utils/formatUtils';
import { SohbettenSiparisModal } from './SohbettenSiparisModal';

interface WhatsAppChat {
  id: string;
  name: string;
  phoneNumber: string;
  lastMessage: string | null;
  lastMessageTime: number | null;
}

interface WhatsAppSonKonusmalarModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Sohbetten sipariş kaydı sonrası (üst modal kapatma + scroll tetikleme) */
  onSiparisKaydedildi?: (organizasyonKartId: number) => void;
}

function formatLastMessageTime(ts: number | null): string {
  if (!ts) return '';
  try {
    const d = new Date(ts * 1000);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const WhatsAppSonKonusmalarModal: React.FC<WhatsAppSonKonusmalarModalProps> = ({
  isOpen,
  onClose,
  onSiparisKaydedildi,
}) => {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [sohbettenSiparisChat, setSohbettenSiparisChat] = useState<WhatsAppChat | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ enabled?: boolean }>;
      const enabled = Boolean(e?.detail?.enabled ?? true);
      if (!enabled) {
        setSohbettenSiparisChat(null);
        onClose();
      }
    };
    window.addEventListener('floovon:ai-service', handler as EventListener);
    return () => window.removeEventListener('floovon:ai-service', handler as EventListener);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setChats([]);
      setError(null);
      setEmptyMessage(null);
      setSohbettenSiparisChat(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEmptyMessage(null);
    apiClient.get<{ success: boolean; chats: WhatsAppChat[]; message?: string }>('/whatsapp/chats', { params: { limit: 50 } })
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        if (data.success && Array.isArray(data.chats)) {
          setChats(data.chats);
          if (data.chats.length === 0 && data.message) setEmptyMessage(data.message);
        } else {
          setChats([]);
          if (data.message) setError(data.message);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.data?.error || err?.message || 'Liste alınamadı';
        setError(msg);
        setChats([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleSohbettenSiparis = (chat: WhatsAppChat) => {
    // Aynı sohbet tekrar tıklanırsa modal yeniden açılmayabiliyor; önce null'a çekip sonra tekrar set et.
    setSohbettenSiparisChat(null);
    requestAnimationFrame(() => setSohbettenSiparisChat(chat));
  };

  if (!isOpen) return null;

  const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR');
  const filteredChats = !normalizedSearch
    ? chats
    : chats.filter((c) => {
        const name = (c.name || '').toLocaleLowerCase('tr-TR');
        const phone = (c.phoneNumber || '').toLocaleLowerCase('tr-TR');
        const lastMsg = (c.lastMessage || '').toLocaleLowerCase('tr-TR');
        return (
          name.includes(normalizedSearch) ||
          phone.includes(normalizedSearch) ||
          lastMsg.includes(normalizedSearch)
        );
      });

  const overlay = (
    <div
      className="modal-react-whatsapp-son-konusmalar-overlay show"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--overlay-bg-black)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        opacity: 1,
        visibility: 'visible',
      }}
    >
      <div
        className="modal-react-whatsapp-son-konusmalar-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          padding: '24px',
          borderRadius: '12px',
          maxWidth: '520px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="modal-react-whatsapp-son-konusmalar-header">
          <h2 className="modal-react-whatsapp-son-konusmalar-title">
            <MessageCircle
              className="modal-react-whatsapp-son-konusmalar-title-wa"
              size={22}
              strokeWidth={2}
              style={{ color: 'var(--whatsapp-green)' }}
              aria-hidden
            />
            Sohbet Geçmişi
          </h2>
          <button
            type="button"
            className="btn-close-modal modal-react-whatsapp-son-konusmalar-close-btn"
            onClick={onClose}
            aria-label="Kapat"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="modal-react-whatsapp-son-konusmalar-body">
          <div className="modal-react-whatsapp-son-konusmalar-search">
            <input
              type="text"
              className="modal-react-whatsapp-son-konusmalar-search-input"
              placeholder="İsim, telefon veya mesaj içinde ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading && (
            <div className="modal-react-whatsapp-son-konusmalar-loading">
              <Loader2 className="modal-react-whatsapp-info-icon-spin" size={24} aria-hidden />
              <p>Sohbet geçmişi yükleniyor…</p>
            </div>
          )}
          {!loading && error && (
            <div className="modal-react-whatsapp-son-konusmalar-error">
              <AlertTriangle size={24} strokeWidth={2} aria-hidden />
              <p>{error}</p>
            </div>
          )}
          {!loading && !error && filteredChats.length === 0 && (
            <p className="modal-react-whatsapp-son-konusmalar-placeholder">
              {normalizedSearch
                ? 'Aramanıza uygun sohbet bulunamadı.'
                : (emptyMessage || 'Sohbet geçmişi henüz yüklenmedi. Birkaç saniye sonra tekrar deneyin.')}
            </p>
          )}
          {!loading && !error && filteredChats.length > 0 && (
            <ul className="modal-react-whatsapp-son-konusmalar-list">
              {filteredChats.map((chat) => (
                <li key={chat.id} className="modal-react-whatsapp-son-konusmalar-item">
                  <div className="modal-react-whatsapp-son-konusmalar-item-info">
                    <span className="modal-react-whatsapp-son-konusmalar-item-name">
                      {chat.name || chat.phoneNumber || chat.id}
                    </span>
                    <span className="modal-react-whatsapp-son-konusmalar-item-phone">
                      {chat.phoneNumber ? formatPhoneNumber(chat.phoneNumber) : chat.id}
                    </span>
                    {chat.lastMessage && (
                      <span className="modal-react-whatsapp-son-konusmalar-item-preview" title={chat.lastMessage}>
                        <MessageCircle
                          className="modal-react-whatsapp-son-konusmalar-item-preview-icon"
                          size={15}
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span className="modal-react-whatsapp-son-konusmalar-item-preview-text">{chat.lastMessage}</span>
                      </span>
                    )}
                    {chat.lastMessageTime && (
                      <span className="modal-react-whatsapp-son-konusmalar-item-time">
                        {formatLastMessageTime(chat.lastMessageTime)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="modal-react-whatsapp-son-konusmalar-item-btn"
                    onClick={() => handleSohbettenSiparis(chat)}
                  >
                    Bu sohbetten sipariş oluştur
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-react-whatsapp-son-konusmalar-footer">
          <button
            type="button"
            className="secondary-button btn-vazgec"
            onClick={onClose}
          >
            Kapat
          </button>
        </div>
      </div>
      <SohbettenSiparisModal
        isOpen={!!sohbettenSiparisChat}
        onClose={() => setSohbettenSiparisChat(null)}
        chat={sohbettenSiparisChat}
        onSuccess={(organizasyonKartId) => {
          setSohbettenSiparisChat(null);
          onClose();
          onSiparisKaydedildi?.(organizasyonKartId);
        }}
      />
    </div>
  );

  return createPortal(overlay, document.body);
};
