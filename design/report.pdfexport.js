(function loadPdfLibs() {
  const libs = [
    {
      global: 'html2canvas',
      urls: [
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
        'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
      ]
    },
    {
      global: 'jspdf',
      check: () => typeof window.jspdf !== 'undefined',
      urls: [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
      ]
    }
  ];
  function loadOne(urls, check, cb) {
    if (urls.length === 0) { cb(false); return; }
    const s = document.createElement('script');
    s.src = urls[0];
    s.async = false;
    s.onload = () => { if (check()) cb(true); else loadOne(urls.slice(1), check, cb); };
    s.onerror = () => loadOne(urls.slice(1), check, cb);
    document.head.appendChild(s);
  }
  window.__pdfLibsStatus = 'loading';
  let remaining = libs.length;
  libs.forEach(L => {
    const check = L.check || (() => typeof window[L.global] !== 'undefined');
    loadOne(L.urls, check, (ok) => {
      remaining--;
      if (remaining === 0) {
        window.__pdfLibsStatus = (typeof html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined') ? 'ready' : 'failed';
      }
    });
  });
})();

// =========== PDF GENERATION — CLIENT-SIDE, IFRAME-SAFE ===========
// Generates a real downloadable .pdf using html2canvas + jsPDF.
// Works inside sandboxed iframes (Claude artifact viewer, etc.) where
// window.print() is silently blocked.

function showPdfOverlay(msg) {
  let ov = document.getElementById('pdf-loading-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'pdf-loading-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);font-family:"Plus Jakarta Sans",system-ui,sans-serif;';
    ov.innerHTML = `
      <div style="background:linear-gradient(135deg,#fff,#f8fbff);border-radius:20px;padding:32px 40px;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.4);max-width:380px;">
        <div style="width:54px;height:54px;border:5px solid #E2E8F0;border-top-color:#1976D2;border-radius:50%;margin:0 auto 18px;animation:pdfspin 0.9s linear infinite;"></div>
        <div style="font-size:16px;font-weight:700;color:#0B1929;margin-bottom:6px;font-family:'Sora',sans-serif;">Generating PDF…</div>
        <div id="pdf-loading-msg" style="font-size:13px;color:#4A5568;line-height:1.5;">${msg || 'Capturing high-quality snapshots of each section'}</div>
        <div id="pdf-progress" style="margin-top:14px;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;">
          <div id="pdf-progress-bar" style="height:100%;background:linear-gradient(90deg,#2E7D32,#1976D2);width:0%;transition:width 0.3s;"></div>
        </div>
      </div>
      <style>@keyframes pdfspin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(ov);
  } else {
    if (msg) document.getElementById('pdf-loading-msg').textContent = msg;
    ov.style.display = 'flex';
  }
}
function hidePdfOverlay() {
  const ov = document.getElementById('pdf-loading-ov');
  if (ov) ov.style.display = 'none';
}
function setPdfProgress(pct, msg) {
  const bar = document.getElementById('pdf-progress-bar');
  const m = document.getElementById('pdf-loading-msg');
  if (bar) bar.style.width = pct + '%';
  if (m && msg) m.textContent = msg;
}

async function handlePrint(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }

  showPdfOverlay('Loading PDF engine…');

  // Wait up to 10 seconds for libraries to finish loading
  const waitForLibs = async () => {
    for (let i = 0; i < 100; i++) {
      if (typeof html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined') return true;
      if (window.__pdfLibsStatus === 'failed') return false;
      await new Promise(r => setTimeout(r, 100));
    }
    return typeof html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined';
  };
  const libsReady = await waitForLibs();

  if (!libsReady) {
    hidePdfOverlay();
    // Last-resort: try window.print, then show clear instructions
    let printed = false;
    try { window.print(); printed = true; } catch (_) {}
    if (!printed) {
      alert(
        'Unable to generate PDF inside this viewer (script CDN was blocked).\n\n' +
        'To save as PDF:\n' +
        '1. Download this HTML file using the download icon in the viewer\n' +
        '2. Open the downloaded file in your browser (Chrome / Safari / Edge)\n' +
        '3. Press Ctrl+P (Windows) or Cmd+P (Mac)\n' +
        '4. Choose "Save as PDF" as the destination'
      );
    }
    return false;
  }

  showPdfOverlay('Preparing report…');

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = 210, pageH = 297, marginX = 8, marginY = 8;
    const usableW = pageW - 2 * marginX;
    const usableH = pageH - 2 * marginY;

    const selectors = [
      { sel: '.report-header', name: 'Header' },
      { sel: '.report-title-block', name: 'Title' },
      { sel: '.patient-grid', name: 'Patient Info' },
      { sel: '.hero-section', name: 'Health Score' },
      { sel: '.vitals-halo-section', name: 'Vital Parameters' },
      { sel: '.critical-spotlight', name: 'Critical Parameters' },
      { sel: '.body-section', name: 'Body Map', preceding: 'section-heading' },
      { sel: '#panels-container', name: 'Detailed Tests', preceding: 'section-heading' },
      { sel: '.trends-section', name: 'Historical Trends', preceding: 'section-heading' },
      { sel: '.ai-section', name: 'AI Interpretation', preceding: 'section-heading' },
      { sel: '.future-tests-section', name: 'Follow-Up Plan', preceding: 'section-heading' },
      { sel: '.screening-section', name: 'Age Screening', preceding: 'section-heading' },
      { sel: '.signatures', name: 'Signatures' },
      { sel: '.disclaimer', name: 'Disclaimer' },
      { sel: '.report-footer', name: 'Footer' }
    ];

    const renderOpts = {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        const ab = clonedDoc.querySelector('.action-bar');
        if (ab) ab.style.display = 'none';
        const inst = clonedDoc.querySelector('.body-instruction');
        if (inst) inst.style.display = 'none';
        const s = clonedDoc.createElement('style');
        s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}';
        clonedDoc.head.appendChild(s);
      }
    };

    let isFirst = true;
    let yCursor = marginY;

    for (let i = 0; i < selectors.length; i++) {
      const s = selectors[i];
      const el = document.querySelector(s.sel);
      if (!el) continue;

      setPdfProgress(Math.round(((i + 1) / selectors.length) * 95), `Capturing: ${s.name} (${i + 1}/${selectors.length})`);

      let combined = null;
      if (s.preceding === 'section-heading') {
        let prev = el.previousElementSibling;
        while (prev && !prev.classList.contains('section-heading')) prev = prev.previousElementSibling;
        if (prev) {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px;background:#fff;padding:0;';
          const c1 = prev.cloneNode(true);
          const c2 = el.cloneNode(true);
          wrap.appendChild(c1);
          wrap.appendChild(c2);
          document.body.appendChild(wrap);
          combined = await html2canvas(wrap, renderOpts);
          document.body.removeChild(wrap);
        }
      }

      const canvas = combined || await html2canvas(el, renderOpts);
      const imgW_mm = usableW;
      const imgH_mm = (canvas.height * imgW_mm) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      const needsNewPage = !isFirst && (yCursor + imgH_mm > pageH - marginY);
      const forceBreak = ['Body Map', 'Detailed Tests', 'Historical Trends', 'AI Interpretation', 'Follow-Up Plan', 'Age Screening'].includes(s.name);

      if (!isFirst && (needsNewPage || forceBreak)) {
        pdf.addPage();
        yCursor = marginY;
      }

      if (imgH_mm > usableH) {
        const sliceHeightPx = Math.floor(canvas.width * (usableH / usableW));
        let py = 0;
        while (py < canvas.height) {
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          const remaining = canvas.height - py;
          const sh = Math.min(sliceHeightPx, remaining);
          sliceCanvas.height = sh;
          const ctx = sliceCanvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(canvas, 0, py, canvas.width, sh, 0, 0, canvas.width, sh);
          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
          const sliceHeightMm = (sh * imgW_mm) / canvas.width;
          if (py > 0) { pdf.addPage(); yCursor = marginY; }
          pdf.addImage(sliceData, 'JPEG', marginX, yCursor, imgW_mm, sliceHeightMm);
          py += sh;
          yCursor += sliceHeightMm + 2;
          if (py < canvas.height) yCursor = pageH;
        }
        yCursor = pageH;
      } else {
        pdf.addImage(imgData, 'JPEG', marginX, yCursor, imgW_mm, imgH_mm);
        yCursor += imgH_mm + 3;
      }

      isFirst = false;
      await new Promise(r => setTimeout(r, 10));
    }

    setPdfProgress(98, 'Finalising PDF…');
    await new Promise(r => setTimeout(r, 100));

    const total = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`ZiffyHealth Diagnostic Report  ·  ZH-2026-058421  ·  Page ${p} of ${total}`, pageW / 2, pageH - 4, { align: 'center' });
    }

    setPdfProgress(100, 'Downloading…');
    pdf.save('ZiffyHealth_Report_ZH-2026-058421.pdf');

    setTimeout(hidePdfOverlay, 600);
  } catch (err) {
    console.error('PDF generation failed:', err);
    hidePdfOverlay();
    alert('PDF generation failed: ' + err.message + '\n\nFallback: try Ctrl+P / Cmd+P, or download the HTML and open it in your browser.');
    try { window.print(); } catch (_) {}
  }
  return false;
}

// =========== ORGAN DATA ===========
const organData = {
  brain: {
    title: "Brain & Neural Health",
    tag: "Vitamin B12 affects neural function",
    tests: [
      { name: "Vitamin B12", val: "412 pg/mL", zone: "Normal" },
      { name: "Cognitive Risk Score (AI)", val: "Low", zone: "Normal" }
    ]
  },
  thyroid: {
    title: "Thyroid Profile",
    tag: "Metabolic regulator",
    tests: [
      { name: "TSH", val: "2.84 µIU/mL", zone: "Normal" },
      { name: "Free T3", val: "3.1 pg/mL", zone: "Normal" },
      { name: "Free T4", val: "1.2 ng/dL", zone: "Normal" }
    ]
  },
  heart: {
    title: "Cardiovascular System",
    tag: "Lipid & cardiac markers",
    tests: [
      { name: "Total Cholesterol", val: "232 mg/dL ↑", zone: "Alert1" },
      { name: "LDL Cholesterol", val: "148 mg/dL ↑", zone: "Alert1" },
      { name: "HDL Cholesterol", val: "38 mg/dL ↓", zone: "Borderline" },
      { name: "Triglycerides", val: "186 mg/dL ↑", zone: "Borderline" },
      { name: "Chol/HDL Ratio", val: "6.1 ↑", zone: "Alert1" }
    ]
  },
  "lung-left": {
    title: "Pulmonary Function (Left)",
    tag: "Oxygen exchange",
    tests: [
      { name: "SpO₂ (Pulse Oximetry)", val: "98 %", zone: "Normal" },
      { name: "Respiratory Rate", val: "16 / min", zone: "Normal" }
    ]
  },
  "lung-right": {
    title: "Pulmonary Function (Right)",
    tag: "Oxygen exchange",
    tests: [
      { name: "SpO₂ (Pulse Oximetry)", val: "98 %", zone: "Normal" },
      { name: "Peak Flow", val: "510 L/min", zone: "Normal" }
    ]
  },
  liver: {
    title: "Liver Function Test",
    tag: "Hepatic enzymes",
    tests: [
      { name: "SGPT (ALT)", val: "32 U/L", zone: "Normal" },
      { name: "SGOT (AST)", val: "28 U/L", zone: "Normal" },
      { name: "Total Bilirubin", val: "0.8 mg/dL", zone: "Normal" },
      { name: "Alkaline Phosphatase", val: "84 U/L", zone: "Normal" },
      { name: "Albumin", val: "4.4 g/dL", zone: "Normal" }
    ]
  },
  pancreas: {
    title: "Pancreas & Glucose",
    tag: "Diabetes markers",
    tests: [
      { name: "Fasting Glucose", val: "108 mg/dL ↑", zone: "Borderline" },
      { name: "HbA1c", val: "5.9 % ↑", zone: "Borderline" },
      { name: "Insulin (Fasting)", val: "12.4 µIU/mL", zone: "Normal" }
    ]
  },
  "kidney-left": {
    title: "Renal Function (Left)",
    tag: "Filtration & clearance",
    tests: [
      { name: "Creatinine", val: "0.94 mg/dL", zone: "Normal" },
      { name: "BUN", val: "14 mg/dL", zone: "Normal" },
      { name: "eGFR", val: "98 mL/min/1.73m²", zone: "Normal" }
    ]
  },
  "kidney-right": {
    title: "Renal Function (Right)",
    tag: "Filtration & clearance",
    tests: [
      { name: "Creatinine", val: "0.94 mg/dL", zone: "Normal" },
      { name: "Uric Acid", val: "7.2 mg/dL ↑", zone: "Borderline" },
      { name: "Urine Protein", val: "Negative", zone: "Normal" }
    ]
  },
  intestine: {
    title: "Digestive Health",
    tag: "Gut & absorption",
    tests: [
      { name: "Iron (Serum)", val: "94 µg/dL", zone: "Normal" },
      { name: "Ferritin", val: "138 ng/mL", zone: "Normal" },
      { name: "Stool Test", val: "Normal", zone: "Normal" }
    ]
  },
  blood: {
    title: "Complete Blood Count",
    tag: "Cellular components",
    tests: [
      { name: "Haemoglobin", val: "14.6 g/dL", zone: "Normal" },
      { name: "RBC Count", val: "5.12 M/µL", zone: "Normal" },
      { name: "WBC Count", val: "7,400 /µL", zone: "Normal" },
      { name: "Platelets", val: "248 K/µL", zone: "Normal" }
    ]
  },
  vitamins: {
    title: "Vitamins & Minerals",
    tag: "Micronutrient status",
    tests: [
      { name: "Vitamin D (25-OH)", val: "22 ng/mL ↓", zone: "Borderline" },
      { name: "Vitamin B12", val: "412 pg/mL", zone: "Normal" },
      { name: "Calcium", val: "9.4 mg/dL", zone: "Normal" }
    ]
  }
};

// =========== TOOLTIP ===========
const tooltip = document.getElementById('tooltip');
const bodyWrap = document.getElementById('body-wrap');

function showTooltip(organKey, evt) {
  const data = organData[organKey];
  if (!data) return;

  let html = `<div class="tt-title">${data.title}<span class="tt-organ-tag">${data.tag}</span></div>`;
  data.tests.forEach(t => {
    html += `<div class="tt-row"><span class="name">${t.name}</span><span class="val zone-${t.zone}">${t.val}</span></div>`;
  });
  tooltip.innerHTML = html;

  // Position relative to body-wrap
  const wrapRect = bodyWrap.getBoundingClientRect();
  const targetRect = evt.currentTarget.getBoundingClientRect();
  const cx = targetRect.left + targetRect.width / 2 - wrapRect.left;
  const cy = targetRect.top - wrapRect.top;

  tooltip.style.left = cx + 'px';
  tooltip.style.top = cy + 'px';
  tooltip.classList.add('show');
}
function hideTooltip() {
  tooltip.classList.remove('show');
}

document.querySelectorAll('.organ').forEach(org => {
  const key = org.dataset.organ;
  org.addEventListener('mouseenter', (e) => showTooltip(key, e));
  org.addEventListener('mouseleave', hideTooltip);
  org.addEventListener('focus', (e) => showTooltip(key, e));
  org.addEventListener('blur', hideTooltip);
  // Touch support
  org.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.organ.active').forEach(o => o.classList.remove('active'));
    if (tooltip.classList.contains('show') && tooltip.dataset.current === key) {
      hideTooltip();
      tooltip.dataset.current = '';
    } else {
      showTooltip(key, e);
      tooltip.dataset.current = key;
      org.classList.add('active');
    }
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.organ')) {
    hideTooltip();
    document.querySelectorAll('.organ.active').forEach(o => o.classList.remove('active'));
  }
});

// =========== TEST PANELS ===========
const panels = [
  {
    icon: "❤️",
    title: "Lipid Profile Test",
    sub: "Cardiovascular risk — fats & cholesterol",
    summary: [{ cls: "pill-alert", txt: "3 Alert L-1" }, { cls: "pill-warn", txt: "2 Borderline" }],
    tests: [
      { name: "Total Cholesterol", desc: "Sum of all cholesterol", val: "232", unit: "mg/dL", min: 130, max: 280, optLow: 170, optHigh: 200, zone: "Alert1", flag: "H" },
      { name: "LDL Cholesterol", desc: "'Bad' cholesterol", val: "148", unit: "mg/dL", min: 50, max: 200, optLow: 70, optHigh: 100, zone: "Alert1", flag: "H" },
      { name: "HDL Cholesterol", desc: "'Good' cholesterol", val: "38", unit: "mg/dL", min: 20, max: 80, optLow: 40, optHigh: 60, zone: "Borderline", flag: "L", reverse: true },
      { name: "Triglycerides", desc: "Blood fats", val: "186", unit: "mg/dL", min: 50, max: 300, optLow: 80, optHigh: 150, zone: "Borderline", flag: "H" },
      { name: "VLDL", desc: "Very low density lipo", val: "37", unit: "mg/dL", min: 10, max: 60, optLow: 15, optHigh: 30, zone: "Borderline", flag: "H" },
      { name: "Chol / HDL Ratio", desc: "Cardiac risk ratio", val: "6.1", unit: "Ratio", min: 2, max: 9, optLow: 3, optHigh: 4.5, zone: "Alert1", flag: "H" }
    ]
  },
  {
    icon: "🩸",
    title: "Diabetic Profile Test",
    sub: "Blood sugar & insulin sensitivity",
    summary: [{ cls: "pill-warn", txt: "3 Borderline" }, { cls: "pill-normal", txt: "1 Normal" }],
    tests: [
      { name: "Fasting Glucose", desc: "After 12hr fast", val: "108", unit: "mg/dL", min: 60, max: 200, optLow: 70, optHigh: 99, zone: "Borderline", flag: "H" },
      { name: "HbA1c", desc: "3-month avg glucose", val: "5.9", unit: "%", min: 4, max: 10, optLow: 4.5, optHigh: 5.7, zone: "Borderline", flag: "H" },
      { name: "Estimated Avg. Glucose", desc: "Derived from HbA1c", val: "123", unit: "mg/dL", min: 80, max: 200, optLow: 90, optHigh: 117, zone: "Borderline", flag: "H" },
      { name: "Insulin (Fasting)", desc: "Insulin level", val: "12.4", unit: "µIU/mL", min: 0, max: 35, optLow: 2.6, optHigh: 24.9, zone: "Normal", flag: "" }
    ]
  },
  {
    icon: "🫘",
    title: "Kidney Function Test",
    sub: "Renal filtration & clearance",
    summary: [{ cls: "pill-normal", txt: "3 Normal" }, { cls: "pill-warn", txt: "1 Borderline" }],
    tests: [
      { name: "Creatinine", desc: "Waste product filter", val: "0.94", unit: "mg/dL", min: 0.3, max: 2, optLow: 0.7, optHigh: 1.3, zone: "Normal", flag: "" },
      { name: "BUN", desc: "Blood urea nitrogen", val: "14", unit: "mg/dL", min: 4, max: 35, optLow: 7, optHigh: 20, zone: "Normal", flag: "" },
      { name: "Uric Acid", desc: "Purine metabolite", val: "7.2", unit: "mg/dL", min: 2, max: 11, optLow: 3.4, optHigh: 7.0, zone: "Borderline", flag: "H" },
      { name: "eGFR", desc: "Filtration rate", val: "98", unit: "mL/min/1.73m²", min: 30, max: 130, optLow: 90, optHigh: 120, zone: "Normal", flag: "" }
    ]
  },
  {
    icon: "🟤",
    title: "Liver Function Test",
    sub: "Hepatic enzymes & bilirubin",
    summary: [{ cls: "pill-normal", txt: "All Normal" }],
    tests: [
      { name: "SGPT (ALT)", desc: "Liver cell enzyme", val: "32", unit: "U/L", min: 0, max: 100, optLow: 7, optHigh: 56, zone: "Normal", flag: "" },
      { name: "SGOT (AST)", desc: "Liver/muscle enzyme", val: "28", unit: "U/L", min: 0, max: 80, optLow: 10, optHigh: 40, zone: "Normal", flag: "" },
      { name: "Total Bilirubin", desc: "Bile pigment", val: "0.8", unit: "mg/dL", min: 0, max: 3, optLow: 0.3, optHigh: 1.2, zone: "Normal", flag: "" },
      { name: "Alkaline Phosphatase", desc: "Bone/liver enzyme", val: "84", unit: "U/L", min: 20, max: 200, optLow: 44, optHigh: 147, zone: "Normal", flag: "" },
      { name: "Albumin", desc: "Liver protein", val: "4.4", unit: "g/dL", min: 2, max: 6, optLow: 3.5, optHigh: 5.0, zone: "Normal", flag: "" }
    ]
  },
  {
    icon: "🦋",
    title: "Thyroid Profile Test",
    sub: "Hormonal metabolism regulation",
    summary: [{ cls: "pill-normal", txt: "All Normal" }],
    tests: [
      { name: "TSH", desc: "Thyroid stim. hormone", val: "2.84", unit: "µIU/mL", min: 0.1, max: 6, optLow: 0.4, optHigh: 4.5, zone: "Normal", flag: "" },
      { name: "Free T3", desc: "Active thyroid hormone", val: "3.1", unit: "pg/mL", min: 1, max: 5, optLow: 2.3, optHigh: 4.2, zone: "Normal", flag: "" },
      { name: "Free T4", desc: "Storage hormone", val: "1.2", unit: "ng/dL", min: 0.4, max: 2.4, optLow: 0.8, optHigh: 1.8, zone: "Normal", flag: "" }
    ]
  },
  {
    icon: "💊",
    title: "Vitamins & Minerals Profile Test",
    sub: "Micronutrient status",
    summary: [{ cls: "pill-warn", txt: "1 Borderline" }, { cls: "pill-normal", txt: "3 Normal" }],
    tests: [
      { name: "Vitamin D (25-OH)", desc: "Sunshine vitamin", val: "22", unit: "ng/mL", min: 5, max: 100, optLow: 30, optHigh: 100, zone: "Borderline", flag: "L", reverse: true },
      { name: "Vitamin B12", desc: "Neural & RBC health", val: "412", unit: "pg/mL", min: 100, max: 1000, optLow: 211, optHigh: 911, zone: "Normal", flag: "" },
      { name: "Iron, Serum", desc: "Iron level", val: "94", unit: "µg/dL", min: 30, max: 250, optLow: 65, optHigh: 175, zone: "Normal", flag: "" },
      { name: "Ferritin", desc: "Iron storage protein", val: "138", unit: "ng/mL", min: 10, max: 500, optLow: 30, optHigh: 400, zone: "Normal", flag: "" }
    ]
  },
  {
    icon: "🔴",
    title: "Complete Blood Count (CBC) Test",
    sub: "Cellular components of blood",
    summary: [{ cls: "pill-normal", txt: "All Normal" }],
    tests: [
      { name: "Haemoglobin", desc: "Oxygen carrier", val: "14.6", unit: "g/dL", min: 8, max: 20, optLow: 13.0, optHigh: 17.0, zone: "Normal", flag: "" },
      { name: "RBC Count", desc: "Red blood cells", val: "5.12", unit: "M/µL", min: 3, max: 7, optLow: 4.5, optHigh: 5.9, zone: "Normal", flag: "" },
      { name: "WBC Count", desc: "White blood cells", val: "7400", unit: "/µL", min: 2000, max: 15000, optLow: 4000, optHigh: 11000, zone: "Normal", flag: "" },
      { name: "Platelets", desc: "Clotting cells", val: "248", unit: "K/µL", min: 50, max: 600, optLow: 150, optHigh: 450, zone: "Normal", flag: "" }
    ]
  }
];

function renderPanels() {
  const container = document.getElementById('panels-container');
  let html = '';
  panels.forEach(p => {
    html += `<div class="panel-card">
      <div class="panel-head">
        <div class="panel-icon">${p.icon}</div>
        <div>
          <h3>${p.title}</h3>
          <div class="sub">${p.sub}</div>
        </div>
        <div class="panel-summary">
          ${p.summary.map(s => `<span class="summary-pill ${s.cls}">${s.txt}</span>`).join('')}
        </div>
      </div>
      <div style="overflow-x: auto;">
      <table class="test-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Result</th>
            <th>Unit</th>
            <th>Reference Range</th>
            <th style="text-align:center;">Position in Range</th>
            <th style="text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${p.tests.map(t => {
            const valNum = parseFloat(t.val.replace(/,/g, ''));
            // Calculate position on bar (0-100)
            let pos = ((valNum - t.min) / (t.max - t.min)) * 100;
            pos = Math.max(2, Math.min(98, pos));

            const zoneClass = `pill-${t.zone === 'Normal' ? 'normal' : t.zone === 'Borderline' ? 'warn' : t.zone === 'Alert1' ? 'alert' : 'critical'}`;
            const zoneLabelMap = { Normal: 'NORMAL', Borderline: 'BORDERLINE', Alert1: 'ALERT L-1', Alert2: 'ALERT L-2' };
            const zoneColorMap = { Normal: 'var(--zone-normal)', Borderline: '#B58300', Alert1: 'var(--zone-alert1)', Alert2: 'var(--zone-alert2)' };
            const zoneBgMap = { Normal: 'rgba(46,125,50,0.12)', Borderline: 'rgba(249,168,37,0.18)', Alert1: 'rgba(239,108,0,0.18)', Alert2: 'rgba(198,40,40,0.15)' };

            const statusText = t.flag === 'H' ? '↑ High' : t.flag === 'L' ? '↓ Low' : '✓ Normal';
            const flagClass = t.flag === 'H' ? 'flag-H' : t.flag === 'L' ? 'flag-L' : 'flag-OK';

            return `<tr>
              <td class="t-name">${t.name}<div class="desc">${t.desc}</div></td>
              <td class="t-value ${flagClass}">${t.val}</td>
              <td class="t-unit">${t.unit}</td>
              <td class="t-range">${t.optLow} – ${t.optHigh}</td>
              <td class="t-bar-cell">
                <div class="range-bar"${t.reverse ? ' style="background: linear-gradient(90deg, var(--zone-alert2) 0%, var(--zone-alert1) 12%, var(--zone-borderline) 22%, var(--zone-normal) 35%, var(--zone-normal) 100%);"' : ''}>
                  <div class="range-marker" style="left: ${pos}%;"></div>
                </div>
                <span class="range-zone-label" style="background:${zoneBgMap[t.zone]}; color:${zoneColorMap[t.zone]};">${zoneLabelMap[t.zone]}</span>
              </td>
              <td class="t-status">
                <span class="status-badge" style="background:${zoneBgMap[t.zone]}; color:${zoneColorMap[t.zone]};">${statusText}</span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}
renderPanels();

// =========== HISTORICAL TREND CHARTS ===========
// trend: 'improving' (green ↓ or ↑ toward normal), 'worsening' (orange away from normal), 'stable' (blue)
const trendData = [
  { name: 'Total Cholesterol', unit: 'mg/dL', values: [198, 215, 232], dates: ['Sep 2024', 'Feb 2025', 'May 2026'], optHigh: 200, optLow: 130, zone: 'alert1', trend: 'worsening' },
  { name: 'LDL Cholesterol', unit: 'mg/dL', values: [118, 132, 148], dates: ['Sep 2024', 'Feb 2025', 'May 2026'], optHigh: 100, optLow: 50, zone: 'alert1', trend: 'worsening' },
  { name: 'HDL Cholesterol', unit: 'mg/dL', values: [44, 41, 38], dates: ['Sep 2024', 'Feb 2025', 'May 2026'], optHigh: 60, optLow: 40, zone: 'border', trend: 'worsening', higherBetter: true },
  { name: 'Triglycerides', unit: 'mg/dL', values: [145, 168, 186], dates: ['Sep 2024', 'Feb 2025', 'May 2026'], optHigh: 150, optLow: 50, zone: 'border', trend: 'worsening' },
  { name: 'HbA1c', unit: '%', values: [5.4, 5.6, 5.9], dates: ['Sep 2024', 'Feb 2025', 'May 2026'], optHigh: 5.7, optLow: 4.0, zone: 'border', trend: 'worsening' },
  { name: 'Fasting Glucose', unit: 'mg/dL', values: [94, 101, 108], dates: ['Sep 2024', 'Feb 2025', 'May 2026'], optHigh: 99, optLow: 70, zone: 'border', trend: 'worsening' },
  { name: 'Vitamin D', unit: 'ng/mL', values: [18, 20, 22], dates: ['Sep 2024', 'Feb 2025', 'May 2026'], optHigh: 100, optLow: 30, zone: 'border', trend: 'improving', higherBetter: true },
  { name: 'Haemoglobin', unit: 'g/dL', values: [14.2, 14.5, 14.6], dates: ['Sep 2024', 'Feb 2025', 'May 2026'], optHigh: 17.0, optLow: 13.0, zone: 'normal', trend: 'stable' },
  { name: 'Serum Creatinine', unit: 'mg/dL', values: [0.92, 0.93, 0.94], dates: ['Sep 2024', 'Feb 2025', 'May 2026'], optHigh: 1.3, optLow: 0.8, zone: 'normal', trend: 'stable' }
];

function renderTrendCard(t) {
  const W = 240, H = 70, padL = 14, padR = 14, padT = 8, padB = 8;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const allVals = [...t.values, t.optHigh, t.optLow];
  const yMin = Math.min(...allVals) * 0.92;
  const yMax = Math.max(...allVals) * 1.08;
  const yScale = (v) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const xScale = (i) => padL + (i / (t.values.length - 1)) * innerW;

  const path = t.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
  const refHi = yScale(t.optHigh);
  const refLo = yScale(t.optLow);

  const lastVal = t.values[t.values.length - 1];
  const firstVal = t.values[0];
  const delta = lastVal - firstVal;
  const pctChange = ((lastVal - firstVal) / firstVal * 100);
  const isFloat = firstVal % 1 !== 0;

  // Color & icon based on trend (improving/worsening/stable), not just direction
  let lineColor, dirIcon, dirText, dirClass;
  if (t.trend === 'stable') {
    lineColor = '#1976D2'; dirIcon = '→'; dirText = 'Stable'; dirClass = 'stable';
  } else if (t.trend === 'improving') {
    lineColor = '#2E7D32';
    dirIcon = delta > 0 ? '↑' : '↓';
    dirText = `Improving (${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%)`;
    dirClass = 'down';
  } else {
    // worsening
    lineColor = '#EF6C00';
    dirIcon = delta > 0 ? '↑' : '↓';
    dirText = `${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%`;
    dirClass = 'up';
  }

  const zoneCls = `zone-${t.zone}`;
  const dots = t.values.map((v, i) => {
    const cx = xScale(i), cy = yScale(v);
    const isLast = i === t.values.length - 1;
    return `<circle cx="${cx}" cy="${cy}" r="${isLast ? 4.5 : 3}" fill="${lineColor}" stroke="#fff" stroke-width="${isLast ? 2 : 1.5}"/>`;
  }).join('');

  // Reference band: light green strip showing the "normal" zone on the chart
  const refTop = Math.min(refHi, refLo), refBot = Math.max(refHi, refLo);

  return `
    <div class="trend-card">
      <div class="trend-head">
        <div class="trend-name">${t.name} <span class="unit">(${t.unit})</span></div>
        <div class="trend-badge ${dirClass}">${dirIcon} ${dirText}</div>
      </div>
      <div class="trend-current">
        <span class="now ${zoneCls}">${lastVal}</span>
        <span class="delta ${dirClass}">${delta > 0 ? '+' : ''}${isFloat ? delta.toFixed(1) : delta} vs first test</span>
      </div>
      <div class="trend-chart">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ta-${t.name.replace(/\s/g,'')}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <rect x="${padL}" y="${refTop}" width="${innerW}" height="${refBot - refTop}" fill="rgba(46,125,50,0.10)" rx="2"/>
          <line x1="${padL}" y1="${refHi}" x2="${W-padR}" y2="${refHi}" stroke="rgba(46,125,50,0.4)" stroke-width="0.7" stroke-dasharray="3,2"/>
          <path d="${path} L ${xScale(t.values.length-1)} ${padT+innerH} L ${xScale(0)} ${padT+innerH} Z" fill="url(#ta-${t.name.replace(/\s/g,'')})"/>
          <path d="${path}" fill="none" stroke="${lineColor}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
          ${dots}
        </svg>
      </div>
      <div class="trend-labels">
        ${t.dates.map(d => `<span>${d}</span>`).join('')}
      </div>
    </div>`;
}

const trendsGrid = document.getElementById('trends-grid');
if (trendsGrid) {
  trendsGrid.innerHTML = trendData.map(renderTrendCard).join('');
}

// =========== KEYBOARD ACCESSIBILITY ===========
document.querySelectorAll('.organ').forEach(org => {
  org.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const key = org.dataset.organ;
      document.querySelectorAll('.organ.active').forEach(o => o.classList.remove('active'));
      org.classList.add('active');
      showTooltip(key, { currentTarget: org });
    }
  });
});
