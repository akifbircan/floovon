/**
 * Date utility functions
 * Moment.js yerine native Date kullanarak tarih işlemleri
 */

/**
 * Tarihi "DD MMMM YYYY dddd" formatına çevir
 * Moment.js yerine native Date kullan
 */
export function formatDateToDisplay(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    
    const day = dateObj.getDate();
    const monthNames = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    const month = monthNames[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const dayName = dayNames[dateObj.getDay()];
    
    return `${day} ${month} ${year} ${dayName}`;
  } catch (e) {
    console.warn('⚠️ Date formatı hatası:', e);
    return null;
  }
}

/**
 * ISO hafta numarasını hesapla
 * Moment.js yerine native Date kullan
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const jan4Day = jan4.getDay();
  const daysToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
  const firstMonday = new Date(d.getFullYear(), 0, 4 + daysToMonday);
  const dateDay = d.getDay();
  const daysToDateMonday = dateDay === 0 ? -6 : 1 - dateDay;
  const dateMonday = new Date(d);
  dateMonday.setDate(d.getDate() + daysToDateMonday);
  const diffTime = dateMonday.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Yılın toplam hafta sayısını hesapla
 * Moment.js yerine native Date kullan
 */
export function getWeeksInYear(year: number): number {
  // ISO 8601: Yılın ilk haftası, 4 Ocak'ı içeren haftadır
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay();
  const daysToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
  const firstMonday = new Date(year, 0, 4 + daysToMonday);
  
  // Sonraki yılın 4 Ocak'ı
  const nextJan4 = new Date(year + 1, 0, 4);
  const nextJan4Day = nextJan4.getDay();
  const nextDaysToMonday = nextJan4Day === 0 ? -6 : 1 - nextJan4Day;
  const nextFirstMonday = new Date(year + 1, 0, 4 + nextDaysToMonday);
  
  const diffTime = nextFirstMonday.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

/**
 * ISO hafta string'inden (YYYY-Www) önceki haftayı döndür
 */
export function getPrevWeekString(weekStr: string): string {
  const parts = weekStr.split('-W');
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  if (week <= 1) {
    const prevYear = year - 1;
    const prevWeek = getWeeksInYear(prevYear);
    return `${prevYear}-W${String(prevWeek).padStart(2, '0')}`;
  }
  return `${year}-W${String(week - 1).padStart(2, '0')}`;
}

/**
 * ISO hafta string'inden (YYYY-Www) sonraki haftayı döndür
 */
export function getNextWeekString(weekStr: string): string {
  const parts = weekStr.split('-W');
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  const maxWeeks = getWeeksInYear(year);
  if (week >= maxWeeks) {
    return `${year + 1}-W01`;
  }
  return `${year}-W${String(week + 1).padStart(2, '0')}`;
}

/**
 * Bugünün bulunduğu haftanın ISO hafta string'ini döndür (YYYY-Www).
 * Web'deki "Bu Haftaya Git" butonu ile aynı mantık.
 */
export function getCurrentWeekString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const week = getISOWeekNumber(today);
  return `${year}-W${String(week).padStart(2, '0')}`;
}



