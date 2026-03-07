import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ErrorState } from '../../../shared/components/ErrorState';
import { EmptyState } from '../../../shared/components/EmptyState';
import { usePageAnimations } from '../../../shared/hooks/usePageAnimations';

interface PotentialPartner {
  id: number;
  partner_firma_adi: string;
  firma_adi?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  not?: string;
  kayit_tarihi?: string;
  durum?: 'beklemede' | 'onaylandi' | 'reddedildi';
}

/**
 * Potansiyel Partnerler sayfası
 */
export const PotentialPartnersPage: React.FC = () => {
  usePageAnimations('partners');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: partners, isLoading, error } = useQuery({
    queryKey: ['potential-partners', searchQuery],
    queryFn: async () => {
      try {
        const result = await apiRequest<PotentialPartner[]>('/partnerler-potansiyel', {
          method: 'GET',
          params: { search: searchQuery || undefined },
        });
        // Array kontrolü
        return Array.isArray(result) ? result : [];
      } catch (err) {
        // 404 hataları normal (endpoint henüz yok), sessizce handle et
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 404) {
          return [];
        }
        console.error('Potansiyel partnerler yükleme hatası:', err);
        return [];
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ErrorState
          title="Potansiyel partnerler yüklenemedi"
          message={error instanceof Error ? error.message : 'Bilinmeyen hata'}
        />
      </div>
    );
  }

  return (
    <div className="potansiyel-partnerler-page min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Potansiyel Partnerler</h1>
            <p className="text-gray-600">Yeni partner başvurularını görüntüleyin ve yönetin</p>
          </div>
          <button className="mt-4 sm:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Yeni Başvuru Ekle
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Potansiyel partner ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Partners List */}
        {!partners || !Array.isArray(partners) || partners.length === 0 ? (
          <EmptyState
            title="Potansiyel partner bulunamadı"
            description="Henüz potansiyel partner başvurusu bulunmamaktadır."
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Firma Adı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İletişim
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kayıt Tarihi
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {partners.map((partner) => (
                    <tr key={partner.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{partner.partner_firma_adi || partner.firma_adi}</div>
                        {partner.adres && (
                          <div className="text-sm text-gray-500">{partner.adres}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {partner.telefon && (
                            <a
                              href={`tel:${partner.telefon}`}
                              className="text-blue-600 hover:underline"
                            >
                              {partner.telefon}
                            </a>
                          )}
                        </div>
                        {partner.email && (
                          <div className="text-sm text-gray-500">{partner.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            partner.durum === 'onaylandi'
                              ? 'bg-green-100 text-green-800'
                              : partner.durum === 'reddedildi'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {partner.durum === 'onaylandi'
                            ? 'Onaylandı'
                            : partner.durum === 'reddedildi'
                            ? 'Reddedildi'
                            : 'Beklemede'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {partner.kayit_tarihi
                          ? new Date(partner.kayit_tarihi).toLocaleDateString('tr-TR')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center align-middle text-sm font-medium space-x-2">
                        <button className="text-green-600 hover:text-green-900">Onayla</button>
                        <button className="text-blue-600 hover:text-blue-900">Detay</button>
                        <button className="text-red-600 hover:text-red-900">Reddet</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

