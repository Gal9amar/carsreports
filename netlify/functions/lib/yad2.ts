import modelsData from './yad2_models.json'

function getModelsData() {
  return modelsData as Record<string, unknown>
}

const MAKES: Record<string, number> = {
  'אאודי': 1, 'אופל': 2, 'אינפיניטי': 3, 'איסוזו': 4, 'אלפא רומיאו': 5,
  'אם ג\'י': 6, 'ב מ וו': 7, 'ג\'יפ': 10, 'גרייט וול': 11, 'דאצ\'יה': 12,
  'הונדה': 17, 'וולוו': 18, 'טויוטה': 19, 'יגואר': 20, 'יונדאי': 21,
  'לנד רובר': 24, 'לקסוס': 26, 'מאזדה': 27, 'מיני': 29, 'מיצובישי': 30,
  'מרצדס-בנץ': 31, 'ניסאן': 32, 'סאנגיונג': 34, 'סובארו': 35, 'סוזוקי': 36,
  'סיאט': 37, 'סיטרואן': 38, 'סמארט': 39, 'סקודה': 40, 'פולקסווגן': 41,
  'פורד': 43, 'פורשה': 44, 'פיאט': 45, 'פיג\'ו': 46, 'קיה': 48, 'רנו': 51,
  'שברולט': 52, 'טסלה': 62, 'לאדה': 80, 'דונגפנג': 88, 'מקסוס': 89,
  'ראם': 91, 'קופרה': 92, 'ג\'נסיס': 93, 'בי.ווי.די': 141, 'ניאו': 289,
  // aliases
  'מזדה': 27, 'מרצדס בנץ': 31, 'סיט': 37, 'מג': 6, 'ב י ד': 141,
  'צ\'ביה': 48,
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
    .replace(/['''׳]/g, '')
    .replace(/[-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getManufacturerId(make: string): number | null {
  const n = normalize(make)
  console.log(`[yad2] getManufacturerId input="${make}" normalized="${n}"`)
  // Exact match
  for (const [k, v] of Object.entries(MAKES)) {
    if (normalize(k) === n) {
      console.log(`[yad2] exact match: "${k}"=${v}`)
      return v
    }
  }
  // Substring fallback — prefer longest key match to avoid false positives
  const matches: Array<{ len: number; key: string; val: number }> = []
  for (const [k, v] of Object.entries(MAKES)) {
    const kn = normalize(k)
    if (n.includes(kn) || kn.includes(n)) {
      matches.push({ len: kn.length, key: k, val: v })
    }
  }
  if (matches.length) {
    matches.sort((a, b) => b.len - a.len)
    console.log(`[yad2] substring matches: ${JSON.stringify(matches.slice(0, 3))} → using "${matches[0].key}"=${matches[0].val}`)
    return matches[0].val
  }
  console.log(`[yad2] no match for "${make}"`)
  return null
}

export function getModelId(manufacturerId: number, model: string): number | null {
  try {
    const md = getModelsData()
    type ModelEntry = { id: string; name_he: string; name_en: string }
    type MfrEntry = { id: string; name_he: string; name_en: string; models: Record<string, ModelEntry> }
    const mfr = md.manufacturers as Record<string, MfrEntry>
    const mfrData = mfr[String(manufacturerId)]
    if (!mfrData?.models) {
      console.log(`[yad2] no models for manufacturerId=${manufacturerId}`)
      return null
    }
    const nm = normalize(model)
    const allModels = Object.values(mfrData.models)
    console.log(`[yad2] getModelId mfrId=${manufacturerId} model="${model}" nm="${nm}" total=${allModels.length}`)
    console.log(`[yad2] first 5 models:`, allModels.slice(0, 5).map(v => `id=${v.id} he="${v.name_he}" en="${v.name_en}"`))
    // Exact match
    for (const v of allModels) {
      const hn = normalize(v.name_he), en = normalize(v.name_en)
      if (hn === nm || en === nm) {
        console.log(`[yad2] exact model match: id=${v.id} en="${v.name_en}"`)
        return Number(v.id)
      }
    }
    // Substring fallback — longest match wins
    const matches: Array<{ len: number; id: number; name: string }> = []
    for (const v of allModels) {
      const hn = normalize(v.name_he), en = normalize(v.name_en)
      if (nm.includes(hn) || hn.includes(nm) || nm.includes(en) || en.includes(nm)) {
        const len = Math.max(hn.length, en.length)
        matches.push({ len, id: Number(v.id), name: v.name_en })
      }
    }
    if (matches.length) {
      matches.sort((a, b) => b.len - a.len)
      console.log(`[yad2] substring model matches: ${JSON.stringify(matches.slice(0, 3))} → using id=${matches[0].id}`)
      return matches[0].id
    }
    console.log(`[yad2] no model match for "${model}" in mfr=${manufacturerId}`)
    return null
  } catch (e) {
    console.log(`[yad2] getModelId error:`, e)
    return null
  }
}
