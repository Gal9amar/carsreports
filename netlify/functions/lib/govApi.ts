const BASE = 'https://data.gov.il/api/3/action/datastore_search'

const RES_MAIN            = '053cea08-09bc-40ec-8f7a-156f0677aff3'
const RES_MAIN_EXT        = '0866573c-40cd-4ca8-91d2-9dd2d7a492e5'
const RES_HISTORY         = '56063a99-8a3e-4ff4-912e-5966c0279bad'
const RES_OWNERSHIP       = 'bb2355dc-9ec7-4f06-9c3f-3344672171da'
const RES_WLTP            = '142afde2-6228-49f9-8a29-9b6c3a0cbe40'
const RES_RECALL          = '2c33523f-87aa-44ec-a736-edbb0a82975e'
const RES_RECALL_CAR      = '36bf1404-0be4-49d2-82dc-2f1ead4a8b93'
const RES_TAG_NACHE       = 'c8b9f9c8-4612-4068-934f-d4acd2e3c06e'
const RES_INACTIVE        = 'f6efe89a-fb3d-43a4-bb61-9bf12a9b9099'
const RES_INACTIVE_NODEG  = '6f6acd03-f351-4a8f-8ecf-df792f4f573a'
const RES_PERSONAL_IMPORT = '03adc637-b6fe-402b-9937-7c3d3afc9140'
const RES_IMPORTER        = '39f455bf-6db0-4926-859d-017f34eacbcb'
const RES_SCRAPPED        = '851ecab1-0622-4dbe-a6c7-f950cf82abf9'

async function searchQ(resourceId: string, q: string, limit = 1): Promise<Record<string, unknown>[]> {
  try {
    const url = `${BASE}?resource_id=${resourceId}&q=${encodeURIComponent(q)}&limit=${limit}`
    const res = await fetch(url)
    const json = await res.json() as { result?: { records?: Record<string, unknown>[] } }
    return json.result?.records ?? []
  } catch { return [] }
}

async function searchFilter(resourceId: string, filters: Record<string, unknown>, limit = 1): Promise<Record<string, unknown>[]> {
  try {
    const url = `${BASE}?resource_id=${resourceId}&filters=${encodeURIComponent(JSON.stringify(filters))}&limit=${limit}`
    const res = await fetch(url)
    const json = await res.json() as { result?: { records?: Record<string, unknown>[]; total?: number } }
    return json.result?.records ?? []
  } catch { return [] }
}

async function searchFilterTotal(resourceId: string, filters: Record<string, unknown>): Promise<number> {
  try {
    const url = `${BASE}?resource_id=${resourceId}&filters=${encodeURIComponent(JSON.stringify(filters))}&limit=1`
    const res = await fetch(url)
    const json = await res.json() as { result?: { total?: number } }
    return json.result?.total ?? 0
  } catch { return 0 }
}

async function searchFilterYearRange(resourceId: string, filters: Record<string, unknown>): Promise<{ total: number; minYear: number | null; maxYear: number | null }> {
  try {
    const base = `${BASE}?resource_id=${resourceId}&filters=${encodeURIComponent(JSON.stringify(filters))}&limit=1`
    const [totalRes, minRes, maxRes] = await Promise.all([
      fetch(base).then(r => r.json()) as Promise<{ result?: { total?: number } }>,
      fetch(`${base}&sort=${encodeURIComponent('shnat_yitzur asc')}`).then(r => r.json()) as Promise<{ result?: { records?: Record<string, unknown>[] } }>,
      fetch(`${base}&sort=${encodeURIComponent('shnat_yitzur desc')}`).then(r => r.json()) as Promise<{ result?: { records?: Record<string, unknown>[] } }>,
    ])
    return {
      total: totalRes.result?.total ?? 0,
      minYear: minRes.result?.records?.[0]?.shnat_yitzur ? Number(minRes.result.records[0].shnat_yitzur) : null,
      maxYear: maxRes.result?.records?.[0]?.shnat_yitzur ? Number(maxRes.result.records[0].shnat_yitzur) : null,
    }
  } catch { return { total: 0, minYear: null, maxYear: null } }
}

async function fetchModelRecalls(record: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const query = String(record.kinuy_mishari || record.degem_nm || '').trim()
  if (query.length < 2) return []
  const raw = await searchQ(RES_RECALL, query.slice(0, 24), 15)
  if (!raw.length) return []
  const year = parseInt(String(record.shnat_yitzur || ''), 10)
  if (!year) return raw.slice(0, 10)
  const matched = raw.filter(r => {
    try {
      const begin = parseInt(String(r.BUILD_BEGIN_A || '').slice(0, 4), 10)
      const end = parseInt(String(r.BUILD_END_A || '').slice(0, 4), 10)
      return begin <= year && year <= end
    } catch { return true }
  })
  return (matched.length ? matched : raw).slice(0, 10)
}

export async function fetchVehicleData(plate: string): Promise<Record<string, unknown> | null> {
  const clean = plate.replace(/-/g, '').trim()

  const [mainRecords, historyRecords, extRecords] = await Promise.all([
    searchQ(RES_MAIN, clean),
    searchQ(RES_HISTORY, clean),
    searchFilter(RES_MAIN_EXT, { mispar_rechev: parseInt(clean, 10) }),
  ])

  if (!mainRecords.length) return null

  const record: Record<string, unknown> = { ...mainRecords[0] }
  const rawPlate = String(record.mispar_rechev || '').replace(/-/g, '').trim()
  if (rawPlate !== clean) return null

  // Merge ext fields
  if (extRecords.length) {
    const ext = extRecords[0]
    for (const key of ['grira_nm','kod_omes_tzmig_kidmi','kod_omes_tzmig_ahori','kod_mehirut_tzmig_kidmi','kod_mehirut_tzmig_ahori']) {
      if (ext[key] != null && String(ext[key]).trim() !== '') record[key] = ext[key]
    }
  }

  // Merge history fields
  if (historyRecords.length) {
    const h = historyRecords[0]
    record.mispar_manoa          = h.mispar_manoa
    record.kilometer_test_aharon = h.kilometer_test_aharon
    record.shinui_mivne_ind      = h.shinui_mivne_ind
    record.gapam_ind             = h.gapam_ind
    record.shnui_zeva_ind        = h.shnui_zeva_ind
    record.shinui_zmig_ind       = h.shinui_zmig_ind
    record.rishum_rishon_dt      = h.rishum_rishon_dt || record.rishum_rishon_dt
    record.mkoriut_nm            = h.mkoriut_nm
  }

  const degemCd   = record.degem_cd || record.sug_degem
  const tozetCd   = record.tozeret_cd
  const mispar    = parseInt(clean, 10)

  // Fetch WLTP with fallback
  async function fetchWltp() {
    if (!degemCd || !tozetCd) return []
    const shnat = record.shnat_yitzur
    if (shnat) {
      const res = await searchFilter(RES_WLTP, { degem_cd: degemCd, tozeret_cd: tozetCd, shnat_yitzur: shnat })
      if (res.length) return res
    }
    return searchFilter(RES_WLTP, { degem_cd: degemCd, tozeret_cd: tozetCd })
  }

  const [
    ownershipRecords, wltpRecords, recallCarRecords,
    tagNacheRecords, inactiveRecords, inactiveNodegRecords,
    importRecords, importerRecords, scrappedRecords,
    degemYearTotal, degemAllYears,
  ] = await Promise.all([
    searchFilter(RES_OWNERSHIP, { mispar_rechev: mispar }, 50),
    fetchWltp(),
    searchFilter(RES_RECALL_CAR, { MISPAR_RECHEV: mispar }, 10),
    searchFilter(RES_TAG_NACHE, { 'MISPAR RECHEV': mispar }),
    searchFilter(RES_INACTIVE, { mispar_rechev: mispar }),
    searchFilter(RES_INACTIVE_NODEG, { mispar_rechev: mispar }),
    searchFilter(RES_PERSONAL_IMPORT, { mispar_rechev: mispar }),
    (degemCd && tozetCd)
      ? searchFilter(RES_IMPORTER, { tozeret_cd: tozetCd, degem_cd: degemCd, shnat_yitzur: record.shnat_yitzur })
      : Promise.resolve([]),
    searchFilter(RES_SCRAPPED, { mispar_rechev: mispar }),
    (degemCd && tozetCd && record.shnat_yitzur)
      ? searchFilterTotal(RES_MAIN, { degem_cd: degemCd, tozeret_cd: tozetCd, shnat_yitzur: record.shnat_yitzur })
      : Promise.resolve(0),
    Promise.resolve({ total: 0, minYear: null, maxYear: null }),
  ])

  if (ownershipRecords.length) {
    record._ownership = ownershipRecords.sort((a, b) =>
      String(a.baalut_dt || '').localeCompare(String(b.baalut_dt || ''))
    )
  }

  if (wltpRecords.length) record._wltp = wltpRecords[0]

  if (recallCarRecords.length) {
    record._recalls = recallCarRecords
    record._recalls_by_plate = true
  } else {
    const modelRecalls = await fetchModelRecalls(record)
    if (modelRecalls.length) {
      record._recalls = modelRecalls
      record._recalls_by_plate = false
    }
  }

  if (tagNacheRecords.length) {
    const t = tagNacheRecords[0]
    record._tag_nache = { sug_tav: t['SUG TAV'], hafakat: t['TAARICH HAFAKAT TAG'] }
  }

  record._inactive_registry = inactiveRecords.length > 0
  record._inactive_no_degem = inactiveNodegRecords.length > 0
  record._was_rental        = inactiveRecords.length > 0

  if (importRecords.length)    record._personal_import  = importRecords[0]
  if (importerRecords.length)  record._importer_price   = importerRecords[0].mehir
  if (scrappedRecords.length)  record._scrapped_dt      = scrappedRecords[0].bitul_dt || ''
  if (degemYearTotal > 0)      record._degem_total      = degemYearTotal
  if (degemAllYears.total > 0) {
    record._degem_total_all  = degemAllYears.total
    record._degem_year_min   = degemAllYears.minYear
    record._degem_year_max   = degemAllYears.maxYear
  }

  return record
}
