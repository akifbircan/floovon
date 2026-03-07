/* #region Türkiye Adres — Runtime (API'siz, tek dosya bundle destekli) */
(function (global) {
  const NS = 'traddr:v1';

  // Bundle dosyası, window.__TR_ADDR__ içine {provinces, districtsByProv, neighByDist} basar.
  function assertData() {
    const d = global.__TR_ADDR__;
    if (!d || !d.provinces || !d.districtsByProv || !d.neighByDist) {
      throw new Error('Türkiye adres verisi yüklenemedi. turkiye-adres.bundle.js sayfaya dahil mi?');
    }
    return d;
  }

  function normalizeStr(a) { return String(a ?? ''); }

  function sortTR(arr, key) {
    return arr.slice().sort((a, b) =>
      normalizeStr(a[key]).localeCompare(normalizeStr(b[key]), 'tr', { sensitivity: 'base' })
    );
  }

  function byId(list, id) { return list.find(x => String(x.id) === String(id)) || null; }

  /* ---- Public API ---- */
  async function getProvinces() {
    const d = assertData();
    return sortTR(d.provinces, 'name');
  }

  async function getDistricts(provinceId) {
    const d = assertData();
    const list = d.districtsByProv[String(provinceId)] || [];
    return sortTR(list, 'name');
  }

  async function getNeighborhoods(districtId) {
    const d = assertData();
    const list = d.neighByDist[String(districtId)] || [];
    return sortTR(list, 'name');
  }

  async function bindAddressSelects(ilSelect, ilceSelect, mahalleSelect, opts = {}) {
    const $ = (x) => (typeof x === 'string' ? document.getElementById(x) : x);
    const selIl = $(ilSelect), selIlce = $(ilceSelect), selMah = $(mahalleSelect);
    const ph = Object.assign({ il: 'İl seçin', ilce: 'İlçe seçin', mahalle: 'Mahalle seçin' }, opts.placeholder || {});
    const onChange = Object.assign({}, opts.onChange || {});

    const reset = (el, text) => { el.innerHTML = ''; el.disabled = true; el.append(new Option(text, '')); };
    const fill = (el, items, map = (x)=>({text:x.name, value:x.name})) => {
      el.innerHTML = ''; items.forEach(item => { const {text, value} = map(item); el.append(new Option(text, value)); });
      el.disabled = false;
    };

    reset(selIl, ph.il); reset(selIlce, ph.ilce); reset(selMah, ph.mahalle);

    const provinces = await getProvinces();
    fill(selIl, provinces);

    let currentDistricts = [];

    selIl.addEventListener('change', async () => {
      const ilName = selIl.value; reset(selIlce, ph.ilce); reset(selMah, ph.mahalle);
      if (!ilName) { onChange.il && onChange.il(null); return; }
      const selectedProvince = provinces.find(p => p.name === ilName);
      if (selectedProvince) {
        currentDistricts = await getDistricts(selectedProvince.id); 
        fill(selIlce, currentDistricts);
        onChange.il && onChange.il(selectedProvince);
      }
    });

    selIlce.addEventListener('change', async () => {
      const ilceName = selIlce.value; reset(selMah, ph.mahalle);
      if (!ilceName) { onChange.ilce && onChange.ilce(null); return; }
      const selectedDistrict = currentDistricts.find(d => d.name === ilceName);
      if (selectedDistrict) {
        const neigh = await getNeighborhoods(selectedDistrict.id); 
        fill(selMah, neigh);
        onChange.ilce && onChange.ilce({ districtId: selectedDistrict.id, count: neigh.length });
      }
    });

    selMah.addEventListener('change', () => { onChange.mahalle && onChange.mahalle(selMah.value); });
  }

  // export to global
  global.TRAddress = { getProvinces, getDistricts, getNeighborhoods, bindAddressSelects };
})(window);
/* #endregion */
