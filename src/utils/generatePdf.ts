export function generateReportPdf(
  plate: string,
  data: Record<string, unknown>,
  marketPrice?: { avg: number; min: number; max: number; count: number } | null
): void {
  function v(...keys: string[]): string {
    for (const k of keys) {
      const val = data[k]
      if (val != null && !['', 'None', 'nan', '0'].includes(String(val).trim())) return String(val).trim()
    }
    return ''
  }

  function vw(...keys: string[]): string {
    const w = (data._wltp as Record<string, unknown>) || {}
    for (const k of keys) {
      const val = w[k]
      if (val != null && !['', 'None', 'nan', '0'].includes(String(val).trim())) return String(val).trim()
    }
    return ''
  }

  function fmtDate(raw: unknown): string {
    if (!raw) return ''
    try { return new Date(String(raw).slice(0, 10)).toLocaleDateString('he-IL') } catch { return String(raw).slice(0, 10) }
  }

  function fmtNum(n: number): string {
    return n.toLocaleString('he-IL')
  }

  const w = (data._wltp as Record<string, unknown>) || {}

  const carName = [v('tozeret_nm'), v('kinuy_mishari', 'degem_nm')].filter(Boolean).join(' ')
  const km = (() => {
    const raw = data['kilometer_test_aharon']
    if (raw != null && !['', 'None', 'nan', '0'].includes(String(raw).trim())) return String(raw).trim()
    return ''
  })()

  function testStatusText(tokef: unknown): string {
    if (!tokef) return 'לא ידוע'
    try {
      const d = new Date(String(tokef).slice(0, 10))
      const delta = Math.floor((d.getTime() - Date.now()) / 86400000)
      if (delta < 0) return `פג תוקף לפני ${Math.abs(delta)} ימים`
      if (delta <= 30) return `פג תוקף בעוד ${delta} ימים`
      return `בתוקף עד ${d.toLocaleDateString('he-IL')}`
    } catch { return 'לא ידוע' }
  }

  function row(label: string, value: string): string {
    if (!value) return ''
    return `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`
  }

  const gearbox = w.automatic_ind === 1 || w.automatic_ind === '1' ? 'אוטומטית'
    : w.automatic_ind === 0 || w.automatic_ind === '0' ? 'ידנית' : ''

  const insuranceName = (() => {
    const ins = data['name_of_insurance']
    if (ins != null && !['', 'None', 'nan'].includes(String(ins).trim())) return String(ins).trim()
    return ''
  })()

  const dateStr = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<title>דוח רכב ${plate}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    direction: rtl;
    color: #1a1a1a;
    background: #fff;
    padding: 32px;
    font-size: 14px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1e40af;
    padding-bottom: 18px;
    margin-bottom: 24px;
  }
  .logo {
    font-size: 26px;
    font-weight: 900;
    color: #1e40af;
    letter-spacing: -0.5px;
  }
  .logo span { color: #7c3aed; }
  .header-meta { text-align: left; font-size: 12px; color: #6b7280; }
  .plate-box {
    display: inline-flex;
    align-items: center;
    border-radius: 8px;
    border: 2px solid #1a56a0;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .plate-flag {
    background: #003399;
    color: #fff;
    padding: 5px 7px;
    font-size: 9px;
    font-weight: 700;
    text-align: center;
  }
  .plate-num {
    background: #fff8c0;
    padding: 5px 14px;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 3px;
    color: #111;
    font-family: monospace;
  }
  .car-title { font-size: 20px; font-weight: 800; margin-top: 8px; }
  .car-sub { color: #6b7280; font-size: 13px; margin-top: 4px; }
  .sections { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .section { break-inside: avoid; }
  .section-title {
    font-size: 13px;
    font-weight: 800;
    color: #1e40af;
    border-bottom: 1.5px solid #dbeafe;
    padding-bottom: 6px;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 4px; font-size: 13px; vertical-align: top; }
  td.label { color: #6b7280; width: 48%; font-weight: 500; }
  td.value { font-weight: 600; color: #111; }
  .market-box {
    margin-top: 18px;
    background: linear-gradient(135deg, #1e40af, #7c3aed);
    color: #fff;
    border-radius: 10px;
    padding: 16px 18px;
    break-inside: avoid;
  }
  .market-title { font-size: 14px; font-weight: 800; margin-bottom: 12px; }
  .market-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .market-cell { background: rgba(255,255,255,0.15); border-radius: 7px; padding: 10px; text-align: center; }
  .market-cell-label { font-size: 10px; opacity: 0.8; margin-bottom: 4px; }
  .market-cell-value { font-size: 15px; font-weight: 800; }
  .footer {
    margin-top: 28px;
    border-top: 1px solid #e5e7eb;
    padding-top: 12px;
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
  }
  .no-print { }
  @media print {
    body { padding: 18px; }
    .no-print { display: none !important; }
    .sections { grid-template-columns: 1fr 1fr; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Cars<span>Reports</span></div>
    <div style="font-size:11px;color:#6b7280;margin-top:3px;">בדיקת רכב מהירה ומקצועית</div>
  </div>
  <div class="header-meta">
    <div>תאריך הפקה: ${dateStr}</div>
    <div style="margin-top:4px;">דוח רכב מקצועי</div>
    <button class="no-print" onclick="window.print()" style="margin-top:10px;padding:7px 18px;background:#1e40af;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">🖨️ הדפס</button>
  </div>
</div>

<div style="margin-bottom:20px;">
  <div class="plate-box">
    <div class="plate-flag">🇮🇱<br>IL</div>
    <div class="plate-num">${plate}</div>
  </div>
  <div class="car-title">${carName || plate}</div>
  <div class="car-sub">${[v('shnat_yitzur'), v('tzeva_rechev'), v('sug_delek_nm')].filter(Boolean).join(' · ')}</div>
</div>

<div class="sections">
  <div class="section">
    <div class="section-title">פרטים כלליים</div>
    <table>
      ${row('יצרן', v('tozeret_nm'))}
      ${row('דגם', v('kinuy_mishari', 'degem_nm'))}
      ${row('שנת ייצור', v('shnat_yitzur'))}
      ${row('צבע', v('tzeva_rechev'))}
      ${row('ארץ ייצור', vw('tozeret_eretz_nm'))}
      ${row('סוג מרכב', vw('merkav'))}
      ${row('מסגרת (שלדה)', v('misgeret'))}
      ${row('מקוריות', v('mkoriut_nm'))}
    </table>
  </div>
  <div class="section">
    <div class="section-title">מפרט טכני</div>
    <table>
      ${row('סוג דלק', v('sug_delek_nm'))}
      ${row('נפח מנוע', vw('nefah_manoa') ? `${vw('nefah_manoa')} סמ"ק` : '')}
      ${row('כוח סוס', vw('koah_sus'))}
      ${row('תיבת הילוכים', gearbox)}
      ${row('מושבים', vw('mispar_moshavim'))}
      ${row('דלתות', vw('mispar_dlatot'))}
      ${row('משקל כולל', vw('mishkal_kolel') ? `${vw('mishkal_kolel')} ק"ג` : '')}
      ${row('טכנולוגיית הנעה', vw('technologiat_hanaa_nm'))}
    </table>
  </div>
  <div class="section">
    <div class="section-title">בדיקות ורישוי</div>
    <table>
      ${row('תוקף טסט', testStatusText(data.tokef_dt))}
      ${row('ק"מ בטסט אחרון', km ? `${parseInt(km).toLocaleString('he-IL')} ק"מ` : '')}
      ${row('טסט אחרון', fmtDate(data.mivchan_acharon_dt))}
      ${row('תאריך רישום ראשון', fmtDate(data.rishum_rishon_dt))}
      ${row('חברת ביטוח', insuranceName)}
      ${row('סטטוס רישום', data._inactive_no_degem ? 'לא פעיל (ללא קוד דגם)' : data._inactive_registry ? 'לא פעיל' : 'פעיל')}
    </table>
  </div>
  <div class="section">
    <div class="section-title">בטיחות ופליטות</div>
    <table>
      ${row('ניקוד בטיחות', vw('nikud_betihut'))}
      ${row('כריות אוויר', vw('mispar_kariot_avir') ? `${vw('mispar_kariot_avir')} כריות` : '')}
      ${row('קבוצת זיהום', v('kvutzat_zihum', 'kvuzat_zihum'))}
      ${row('מדד ירוק', vw('madad_yarok'))}
      ${row('CO2 (WLTP)', vw('CO2_WLTP') ? `${vw('CO2_WLTP')} גר'/ק"מ` : '')}
    </table>
  </div>
</div>

${marketPrice ? `
<div class="market-box">
  <div class="market-title">💰 מחיר שוק — Yad2</div>
  <div class="market-grid">
    <div class="market-cell">
      <div class="market-cell-label">ממוצע שוק</div>
      <div class="market-cell-value">₪${fmtNum(marketPrice.avg)}</div>
    </div>
    <div class="market-cell">
      <div class="market-cell-label">מינימום</div>
      <div class="market-cell-value">₪${fmtNum(marketPrice.min)}</div>
    </div>
    <div class="market-cell">
      <div class="market-cell-label">מקסימום</div>
      <div class="market-cell-value">₪${fmtNum(marketPrice.max)}</div>
    </div>
  </div>
</div>` : ''}

<div class="footer">
  המידע נאסף ממאגרים ממשלתיים וציבוריים. אין להסתמך על דוח זה כתחליף לבדיקה מקצועית.
  | CarsReports © ${new Date().getFullYear()}
</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 600)
}
