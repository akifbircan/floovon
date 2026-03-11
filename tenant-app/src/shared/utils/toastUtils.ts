/**
 * Toast utility functions
 * ✅ MEVCUT SİSTEM: window.createToast kullanılıyor
 * Eski JS'teki createToast fonksiyonunu kullanır
 */

/** Plan yükseltme mesajı – WhatsApp vb. özellikler için tek metin */
export const PLAN_UPGRADE_MESSAGE = 'Bu özellik için abonelik planınızı yükseltebilirsiniz';

/** Plan yükseltme toast'ı göster */
export function showPlanUpgradeToast() {
  if (typeof (window as any).createToast === 'function') {
    (window as any).createToast('warning', PLAN_UPGRADE_MESSAGE);
  } else {
    console.warn('Toast sistemi bulunamadı');
  }
}

/**
 * Genel toast göster
 * Mevcut createToast sistemi kullanır
 */
export function showToast(
  type: 'success' | 'error' | 'warning' | 'info',
  message: string,
  options?: { duration?: number; icon?: string }
) {
  // Mevcut toast sistemi: createToast(id, customMessage)
  // id: 'success' | 'error' | 'warning' | 'info'
  // customMessage: Özel mesaj
  if (typeof (window as any).createToast === 'function') {
    (window as any).createToast(type, message);
  } else if (typeof (window as any).showToast === 'function') {
    (window as any).showToast(message, type);
  } else {
    // Fallback: console'a yaz
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Etkileşimli toast göster (Evet/Hayır)
 * Mevcut createToastInteractive sistemi kullanır
 */
export function showToastInteractive(options: {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isWarning?: boolean;
  confirmButtonClass?: string;
}) {
  const opts = { cancelText: 'İptal', ...options };
  if (typeof (window as any).createToastInteractive === 'function') {
    (window as any).createToastInteractive(opts);
  } else {
    if (window.confirm(opts.message)) {
      opts.onConfirm();
    } else if (opts.onCancel) {
      opts.onCancel();
    }
  }
}
