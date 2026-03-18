/**
 * TRAddress (turkiye-adres) verisiyle il / ilçe / mahalle eşleştirme.
 * Yazım hataları ve kısaltmalar için fuzzy eşleşme.
 */

type AddrItem = { id: string | number; name: string };

function fold(s: string): string {
  return String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[.\s]+/g, '')
    .replace(/mahallesi|mahalle|mah\b/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[] = Array(n + 1)
    .fill(0)
    .map((_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

/** Aday listeden en iyi eşleşen isim (tam eşleşme > içerme > Levenshtein) */
export function fuzzyPickName(needle: string, candidates: AddrItem[]): string | null {
  const raw = String(needle || '').trim();
  if (!raw || !candidates.length) return null;

  const nFold = fold(raw);
  const nNorm = raw.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();

  for (const c of candidates) {
    const name = c.name;
    if (name.localeCompare(raw, 'tr-TR', { sensitivity: 'accent' }) === 0) return name;
  }
  for (const c of candidates) {
    const cf = fold(c.name);
    if (cf === nFold) return c.name;
  }
  for (const c of candidates) {
    const cn = c.name.toLocaleLowerCase('tr-TR');
    if (cn.includes(nNorm) || nNorm.includes(cn)) return c.name;
  }

  let best: string | null = null;
  let bestScore = 0;
  const maxLen = Math.max(nFold.length, 4);
  for (const c of candidates) {
    const cf = fold(c.name);
    if (!cf || cf.length < 3) continue;
    const d = levenshtein(nFold, cf);
    const len = Math.max(nFold.length, cf.length) || 1;
    const ratio = 1 - d / len;
    if (d <= Math.ceil(maxLen * 0.34) && ratio > bestScore && ratio >= 0.65) {
      bestScore = ratio;
      best = c.name;
    }
  }
  return best;
}

function lettersTr(s: string): string {
  return String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-zğıöüşçi]/gi, '');
}

/**
 * "içeri çuma" gibi kelimeler ayrı + yazım hatası; "İçeri Çumra Mah." ile eşler.
 */
export function fuzzyPickMahalleLoose(needle: string, candidates: AddrItem[]): string | null {
  const raw = String(needle || '').trim();
  if (!raw || !candidates.length) return null;

  const fromStandard = fuzzyPickName(raw, candidates);
  if (fromStandard) return fromStandard;

  const nFold = fold(raw);
  const nJoined = raw.toLocaleLowerCase('tr-TR').replace(/[.\s,;]+/g, '');
  let best: string | null = null;
  let bestScore = -1;
  for (const c of candidates) {
    const cf = fold(c.name);
    if (!cf || cf.length < 3) continue;
    for (const nf of [nFold, nJoined]) {
      if (nf.length < 3) continue;
      const d = levenshtein(nf, cf);
      const len = Math.max(nf.length, cf.length) || 1;
      const ratio = 1 - d / len;
      const maxDist = Math.min(6, Math.max(2, Math.ceil(len * 0.34)));
      if (d <= maxDist && ratio >= 0.6 && ratio > bestScore) {
        bestScore = ratio;
        best = c.name;
      }
    }
  }
  if (best) return best;

  const tokens = raw
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map((t) => lettersTr(t))
    .filter((t) => t.length >= 2);
  if (tokens.length < 2) return null;

  for (const c of candidates) {
    const words = c.name
      .toLocaleLowerCase('tr-TR')
      .replace(/mahallesi|mahalle|mah\.?/gi, ' ')
      .split(/\s+/)
      .map((w) => lettersTr(w))
      .filter((w) => w.length >= 2);
    if (words.length < tokens.length) continue;
    let wi = 0;
    let matched = 0;
    for (const tn of tokens) {
      let found = false;
      while (wi < words.length) {
        const wn = words[wi++];
        const L = Math.max(tn.length, wn.length);
        const d = levenshtein(tn, wn);
        if (L <= 5 && d <= 1) {
          found = true;
          break;
        }
        if (L > 5 && d <= Math.max(2, Math.ceil(L * 0.32))) {
          found = true;
          break;
        }
      }
      if (found) matched++;
      else break;
    }
    if (matched === tokens.length) return c.name;
  }
  return null;
}

export interface ResolvedAddress {
  teslim_il: string;
  teslim_ilce: string;
  teslim_mahalle: string;
  /** Mahalle eşlemesi teslim_kisisi metninden yapıldıysa kişi alanını temizle */
  clearedKisisiBecauseMahalle?: boolean;
}

export type ResolveAddressOptions = {
  /** Mahalle boş/uyumsuzken denenecek ek metinler (adres satırı vb.) */
  fallbackMahalleHints?: string[];
  /** Mahalle alanı boşken teslim edilecek kişi satırı mahalle adı olabilir (örn. içeri çuma) */
  kisisiMahalleFallback?: string;
};

/**
 * Önce il ipucu + ilçe ile dene; olmazsa tüm illerde ilçe ara (aynı isimli ilçe: il ipucu varsa onu tercih et).
 */
export async function resolveIlIlceMahalleWithTRAddress(
  ilGuess: string,
  ilceGuess: string,
  mahalleGuess: string,
  options?: ResolveAddressOptions
): Promise<ResolvedAddress> {
  const TR = (typeof window !== 'undefined' && (window as any).TRAddress) as
    | { getProvinces: () => Promise<AddrItem[]>; getDistricts: (id: string | number) => Promise<AddrItem[]>; getNeighborhoods: (id: string | number) => Promise<AddrItem[]> }
    | undefined;

  /** Yalnızca TRAddress listesinden eşleşen resmi adlar; tahmin/taslak yazılmaz */
  const out: ResolvedAddress = {
    teslim_il: '',
    teslim_ilce: '',
    teslim_mahalle: '',
    clearedKisisiBecauseMahalle: false,
  };

  if (!TR?.getProvinces) return out;

  try {
    const provinces = await TR.getProvinces();
    if (!provinces.length) return out;

    let ilName = '';
    let ilceName = '';
    const ilPick = fuzzyPickName(ilGuess, provinces);

    if (ilPick && ilceGuess.trim()) {
      const p = provinces.find((x) => x.name === ilPick);
      if (p) {
        const dists = await TR.getDistricts(p.id);
        const dPick = fuzzyPickName(ilceGuess, dists);
        if (dPick) {
          ilName = ilPick;
          ilceName = dPick;
        }
      }
    }

    if (!ilceName && ilceGuess.trim()) {
      type Hit = { il: string; ilce: string; pid: string | number; did: string | number };
      const hits: Hit[] = [];
      for (const p of provinces) {
        const dists = await TR.getDistricts(p.id);
        const dPick = fuzzyPickName(ilceGuess, dists);
        if (dPick) {
          const d = dists.find((x) => x.name === dPick);
          if (d) hits.push({ il: p.name, ilce: dPick, pid: p.id, did: d.id });
        }
      }
      if (hits.length === 1) {
        ilName = hits[0].il;
        ilceName = hits[0].ilce;
      } else if (hits.length > 1 && ilPick) {
        const sameIl = hits.find((h) => h.il === ilPick);
        if (sameIl) {
          ilName = sameIl.il;
          ilceName = sameIl.ilce;
        } else {
          ilName = hits[0].il;
          ilceName = hits[0].ilce;
        }
      } else if (hits.length > 1) {
        ilName = hits[0].il;
        ilceName = hits[0].ilce;
      }
    }

    if (!ilName && ilPick && !ilceName) {
      ilName = ilPick;
    }

    if (ilName) out.teslim_il = ilName;
    if (ilceName) out.teslim_ilce = ilceName;

    if (ilName && ilceName) {
      const p = provinces.find((x) => x.name === ilName);
      if (p) {
        const dists = await TR.getDistricts(p.id);
        const d = dists.find((x) => x.name === ilceName);
        if (d) {
          const neigh = await TR.getNeighborhoods(d.id);
          if (neigh?.length) {
            const pickM = (needle: string) =>
              fuzzyPickMahalleLoose(needle, neigh) || fuzzyPickName(needle, neigh);

            let mPick: string | null = null;
            let mahalleSource: 'mahalle' | 'kisisi' | 'fallback' | null = null;
            const mg = (mahalleGuess || '').trim();
            if (mg) {
              mPick = pickM(mg);
              if (mPick) mahalleSource = 'mahalle';
            }

            const kf = (options?.kisisiMahalleFallback || '').trim();
            if (!mPick && kf) {
              const km = pickM(kf);
              if (km) {
                mPick = km;
                mahalleSource = 'kisisi';
              }
            }

            if (!mPick && options?.fallbackMahalleHints?.length) {
              for (const h of options.fallbackMahalleHints) {
                const t = String(h || '').trim();
                if (t.length < 3 || /\d{9,}/.test(t.replace(/\s/g, ''))) continue;
                mPick = pickM(t);
                if (mPick) {
                  mahalleSource = 'fallback';
                  break;
                }
              }
            }

            if (mPick) out.teslim_mahalle = mPick;
            out.clearedKisisiBecauseMahalle = mahalleSource === 'kisisi';
          }
        }
      }
    }
    if (!ilName) {
      out.teslim_ilce = '';
      out.teslim_mahalle = '';
    }
    if (!ilceName) out.teslim_mahalle = '';
  } catch {
    /* sessiz */
  }

  return out;
}
