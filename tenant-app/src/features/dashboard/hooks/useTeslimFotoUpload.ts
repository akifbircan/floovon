/**
 * Teslim Foto Upload Hook
 * Organizasyon kartlarına teslim fotoğrafları yüklemek için React hook
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadTeslimFotolari } from '../api/teslimFotoApi';
import { invalidateOrganizasyonKartQueries } from '../../../lib/invalidateQueries';
import { showToast } from '../../../shared/utils/toastUtils';

interface UseTeslimFotoUploadOptions {
  onSuccess?: (response: { updated: number }) => void;
  onError?: (error: Error) => void;
}

/**
 * Teslim fotoğrafları yüklemek için mutation hook
 */
export function useTeslimFotoUpload(options?: UseTeslimFotoUploadOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      organizasyonId,
      files,
      metadata,
    }: {
      organizasyonId: number;
      files: File[];
      metadata?: {
        customerId?: string;
        customerUnvan?: string;
      };
    }) => {
      return await uploadTeslimFotolari(organizasyonId, files, metadata);
    },
    onSuccess: (response) => {
      // Organizasyon kartlarını yenile (foto sayısı güncellenecek) + diğer sekmelere broadcast
      invalidateOrganizasyonKartQueries(queryClient);

      // Başarı mesajı
      const updatedCount = response.updated || 0;
      const message =
        updatedCount === 1
          ? 'Fotoğraf başarıyla yüklendi!'
          : `${updatedCount} fotoğraf başarıyla yüklendi!`;
      showToast('success', message);

      // Callback
      if (options?.onSuccess) {
        options.onSuccess({ updated: updatedCount });
      }
    },
    onError: (error: Error) => {
      console.error('❌ Teslim fotoğrafı yükleme hatası:', error);
      showToast('error', error.message || 'Fotoğraf yüklenirken bir hata oluştu');

      // Callback
      if (options?.onError) {
        options.onError(error);
      }
    },
  });

  return {
    upload: mutation.mutate,
    uploadAsync: mutation.mutateAsync,
    isUploading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}







































