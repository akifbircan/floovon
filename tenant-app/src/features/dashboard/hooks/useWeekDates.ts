/**
 * Hafta tarihleri hook'u
 * Seçili haftanın günlerini hesaplar
 */

import { useState, useMemo } from 'react';

export interface WeekDate {
  date: Date;
  dateString: string; // YYYY-MM-DD
  displayDate: string; // "09 Şubat 2026 Pazartesi"
  dayName: string; // "Pazartesi"
}

/**
 * Hafta tarihlerini hesapla
 */
export function useWeekDates(weekInput?: string) {
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    // Varsayılan: Bu hafta
    const today = new Date();
    const year = today.getFullYear();
    const week = getWeekNumber(today);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  });

  const weekDates = useMemo(() => {
    const week = weekInput || selectedWeek;
    return calculateWeekDates(week);
  }, [weekInput, selectedWeek]);

  return {
    weekDates,
    selectedWeek,
    setSelectedWeek,
  };
}

/**
 * Hafta numarasını hesapla (ISO 8601)
 * ISO 8601: Hafta Pazartesi başlar, yılın ilk haftası 4 Ocak'ı içeren haftadır
 */
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  
  // Yılın 4 Ocak'ını bul
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const jan4Day = jan4.getDay(); // 0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi
  
  // 4 Ocak'ın bulunduğu haftanın Pazartesi gününü bul
  const daysToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
  const firstMonday = new Date(d.getFullYear(), 0, 4 + daysToMonday);
  
  // Tarihin bulunduğu haftanın Pazartesi gününü bul
  const dateDay = d.getDay();
  const daysToDateMonday = dateDay === 0 ? -6 : 1 - dateDay;
  const dateMonday = new Date(d);
  dateMonday.setDate(d.getDate() + daysToDateMonday);
  
  // Hafta numarasını hesapla
  const diffTime = dateMonday.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;
  
  return weekNumber;
}

/**
 * Hafta string'inden (YYYY-Www) tarihleri hesapla
 * ISO 8601 standardına göre: Hafta Pazartesi başlar, Pazar biter
 */
function calculateWeekDates(weekString: string): WeekDate[] {
  const [year, week] = weekString.split('-W').map(Number);
  
  // ISO 8601: Yılın ilk haftası, 4 Ocak'ı içeren haftadır
  // Bu haftanın Pazartesi gününü bul
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay(); // 0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi
  
  // 4 Ocak'ın bulunduğu haftanın Pazartesi gününü bul
  // Eğer 4 Ocak Pazartesi ise 0, Pazar ise -6, Salı ise -1, vb.
  const daysToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
  const firstMonday = new Date(year, 0, 4 + daysToMonday);
  
  // Seçili haftanın Pazartesi günü
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
  
  // Haftanın 7 günü (Pazartesi'den Pazar'a)
  const dates: WeekDate[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    
    dates.push({
      date,
      dateString: formatDateString(date),
      displayDate: formatDisplayDate(date),
      dayName: formatDayName(date),
    });
  }
  
  return dates;
}

/**
 * Tarihi YYYY-MM-DD formatına çevir
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Tarihi görüntü formatına çevir: "09 Şubat 2026 Pazartesi"
 */
function formatDisplayDate(date: Date): string {
  const day = date.getDate();
  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const dayName = formatDayName(date);
  
  return `${day} ${month} ${year} ${dayName}`;
}

/**
 * Gün adını Türkçe olarak döndür
 */
function formatDayName(date: Date): string {
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return dayNames[date.getDay()];
}

