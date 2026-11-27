/**
 * Generador de Reportes PDF en formato vectorial estándar (PDF 1.4).
 * Replica con absoluta fidelidad visual el diseño de EvaluationPdfReport:
 * - Logo cuatricolor GuiosPro y membrete institucional con REF
 * - Ficha técnica de 4 columnas (Software, Decisor, Fecha, Dictamen con color)
 * - 4 cuadrantes FODA con línea superior de color y badges de porcentaje
 * - Tablas por dimensión con pills: • Fortaleza, • Oportunidad, ▲ Debilidad, ✕ Amenaza
 * - Cuadro de Dictamen Técnico Oficial (Categoría A/B/C) con factores críticos
 * - Firma formal centrada del Decisor / Evaluador Responsable
 * - Paginación inteligente ("Página X de Y") y descarga automática directa sin window.print()
 */

export interface EvaluationPdfData {
  evaluationName: string;
  softwareName: string;
  softwareVersion?: string;
  decisorName: string;
  completionDate: string;
  organizationName?: string;
  fodaCounts: {
    Fortalezas: number;
    Oportunidades: number;
    Debilidades: number;
    Amenazas: number;
    total: number;
  };
  dimensionGroups: Array<{
    dimensionId: number;
    dimensionName: string;
    order: number;
    factors: Array<{
      factor_id: number;
      factor_name: string;
      average_weighting?: number;
      average_weighting_display?: string;
      scope?: string;
      scope_display?: string;
      foda_classification?: string;
      foda_classification_display?: string;
      swot_classification?: string;
      swot_code?: string;
    }>;
    counts?: { total: number; F: number; O: number; D: number; A: number };
  }>;
  recommendation: {
    categoria: 'A' | 'B' | 'C';
    titulo: string;
    texto: string;
    factores_desfavorables_criticos?: Array<{ nombre: string; foda: string; relativa: number }>;
  };
}

/**
 * Mapeo de caracteres especiales en español a códigos octales de WinAnsiEncoding
 */
function escapePdfText(str: string): string {
  if (!str) return '';
  const winAnsiMap: Record<string, string> = {
    'á': '\\341',
    'é': '\\351',
    'í': '\\355',
    'ó': '\\363',
    'ú': '\\372',
    'Á': '\\301',
    'É': '\\311',
    'Í': '\\315',
    'Ó': '\\323',
    'Ú': '\\332',
    'ñ': '\\361',
    'Ñ': '\\321',
    'ü': '\\374',
    'Ü': '\\334',
    '¿': '\\277',
    '¡': '\\241',
    '•': '\\225',
    '—': '\\227',
    '–': '\\226',
    '“': '\\223',
    '”': '\\224',
    '‘': '\\221',
    '’': '\\222',
    '°': '\\260',
    '≥': '>=',
    '≤': '<=',
    '➔': '->',
    '✓': '[OK]',
    '▲': '^',
    '✕': 'x',
    '·': '\\225',
  };

  let out = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') {
      out += '\\(';
    } else if (char === ')') {
      out += '\\)';
    } else if (char === '\\') {
      out += '\\\\';
    } else if (winAnsiMap[char]) {
      out += winAnsiMap[char];
    } else {
      const code = char.charCodeAt(0);
      if (code >= 32 && code <= 126) {
        out += char;
      } else {
        const normalized = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalized.length > 0 && normalized.charCodeAt(0) >= 32 && normalized.charCodeAt(0) <= 126) {
          out += normalized;
        } else {
          out += ' ';
        }
      }
    }
  }
  return out;
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const w of words) {
    if (!currentLine) {
      currentLine = w;
    } else if ((currentLine + ' ' + w).length <= maxCharsPerLine) {
      currentLine += ' ' + w;
    } else {
      lines.push(currentLine);
      currentLine = w;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function generateEvaluationPdfBlob(data: EvaluationPdfData): Blob {
  const pageWidth = 595.28; // A4 ancho en puntos
  const pageHeight = 841.89; // A4 alto en puntos
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2; // 515.28

  const pages: string[][] = [[]];
  let currentPageIndex = 0;
  let y = 795;

  const currentStream = () => pages[currentPageIndex];

  const checkPageBreak = (neededHeight: number): boolean => {
    if (y - neededHeight < 55) {
      pages.push([]);
      currentPageIndex++;
      y = 790;

      // Cabecera compacta en páginas 2+
      const p = currentStream();
      p.push('q');
      p.push('0.14 0.21 0.26 rg');
      p.push(`BT /F2 8 Tf ${marginX} ${y} Td (${escapePdfText('GUIOSPRO • Informe de Evaluación Metodológica: ' + (data.softwareName || 'Software'))}) Tj ET`);
      p.push('0.50 0.75 0.76 RG 1 w');
      p.push(`${marginX} ${y - 6} m ${pageWidth - marginX} ${y - 6} l S`);
      p.push('Q');
      y -= 26;
      return true;
    }
    return false;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PÁGINA 1: ENCABEZADO INSTITUCIONAL CON LOGO GUIOSPRO
  // ──────────────────────────────────────────────────────────────────────────
  const p1 = currentStream();

  p1.push('q');
  // Icono oficial GuiosPro: Contenedor oscuro redondeado (#243642) con 4 cuadrantes interiores:
  // Superior Izq: Teal (#7FBFC1), Superior Der: Naranja (#F7A35F)
  // Inferior Izq: Amarillo (#F9E8A0), Inferior Der: Terracota (#B8421A)
  const iconX = marginX;
  const iconY = 765;
  const iconSize = 22;

  // Contenedor oscuro
  p1.push(`0.141 0.212 0.259 rg ${iconX} ${iconY} ${iconSize} ${iconSize} re f`);

  // 4 Cuadrantes internos
  const pad = 3.5;
  const sq = 6.5;
  const gap = 2;

  // Inferior Izquierdo: Amarillo (#F9E8A0)
  p1.push(`0.976 0.910 0.627 rg ${iconX + pad} ${iconY + pad} ${sq} ${sq} re f`);
  // Inferior Derecho: Terracota (#B8421A)
  p1.push(`0.722 0.259 0.102 rg ${iconX + pad + sq + gap} ${iconY + pad} ${sq} ${sq} re f`);
  // Superior Izquierdo: Teal (#7FBFC1)
  p1.push(`0.498 0.749 0.757 rg ${iconX + pad} ${iconY + pad + sq + gap} ${sq} ${sq} re f`);
  // Superior Derecho: Naranja (#F7A35F)
  p1.push(`0.969 0.639 0.373 rg ${iconX + pad + sq + gap} ${iconY + pad + sq + gap} ${sq} ${sq} re f`);

  // Texto "GuiosPro" con espaciado tipográfico exacto para evitar superposición
  const textX = iconX + iconSize + 8;
  const textY = iconY + 4;
  p1.push(`0.141 0.212 0.259 rg`);
  p1.push(`BT /F2 18 Tf ${textX} ${textY} Td (Guios) Tj ET`);
  p1.push(`0.722 0.259 0.102 rg`); // Terracota #B8421A
  p1.push(`BT /F2 18 Tf ${textX + 53} ${textY} Td (Pro) Tj ET`);

  // Separador vertical
  const sepX = textX + 94;
  p1.push(`0.80 0.83 0.88 RG 1 w ${sepX} ${iconY - 1} m ${sepX} ${iconY + 23} l S`);

  // Subtítulo Metodología GUIOS
  p1.push(`0.141 0.212 0.259 rg`);
  p1.push(`BT /F2 8.5 Tf ${sepX + 8} ${iconY + 12} Td (${escapePdfText('METODOLOGÍA GUIOS')}) Tj ET`);
  p1.push(`0.40 0.45 0.50 rg`);
  p1.push(`BT /F1 7.5 Tf ${sepX + 8} ${iconY + 2} Td (${escapePdfText('Software Quality Assessment System')}) Tj ET`);

  // Lado derecho: Badge INFORME TÉCNICO OFICIAL + REF
  const badgeW = 125;
  const badgeRightX = pageWidth - marginX - badgeW;
  p1.push(`0.95 0.96 0.98 rg ${badgeRightX} ${iconY + 6} ${badgeW} 16 re f`);
  p1.push(`0.80 0.83 0.88 RG 0.75 w ${badgeRightX} ${iconY + 6} ${badgeW} 16 re S`);
  p1.push(`0.14 0.21 0.26 rg`);
  p1.push(`BT /F2 7.5 Tf ${badgeRightX + 10} ${iconY + 11} Td (${escapePdfText('INFORME TÉCNICO OFICIAL')}) Tj ET`);

  const refCode = `REF: GUIOS-${new Date().getFullYear()}-${(data.softwareName || 'SW').slice(0, 4).toUpperCase()}`;
  p1.push(`0.40 0.45 0.50 rg`);
  p1.push(`BT /F1 7.5 Tf ${badgeRightX + 22} ${iconY - 6} Td (${escapePdfText(refCode)}) Tj ET`);

  // Línea gruesa oscura institucional bajo la cabecera
  p1.push(`0.14 0.21 0.26 RG 2 w`);
  p1.push(`${marginX} 752 m ${pageWidth - marginX} 752 l S`);
  p1.push('Q');

  // ──────────────────────────────────────────────────────────────────────────
  // TÍTULO DE EVALUACIÓN
  // ──────────────────────────────────────────────────────────────────────────
  y = 736;
  p1.push('q');
  p1.push(`0.40 0.45 0.50 rg`);
  p1.push(`BT /F2 7.5 Tf ${marginX} ${y} Td (${escapePdfText('DICTAMEN Y RESULTADOS METODOLÓGICOS')}) Tj ET`);
  y -= 17;
  p1.push(`0.09 0.13 0.17 rg`);
  p1.push(`BT /F2 18 Tf ${marginX} ${y} Td (${escapePdfText('Informe de Evaluación: ' + (data.softwareName || data.evaluationName || 'Software'))}) Tj ET`);
  p1.push('Q');

  y -= 18;

  // ──────────────────────────────────────────────────────────────────────────
  // FICHA TÉCNICA (4 COLUMNAS CON DIVISIONES)
  // ──────────────────────────────────────────────────────────────────────────
  const cardH = 42;
  y -= cardH;
  const colW = contentWidth / 4;

  p1.push('q');
  p1.push(`0.97 0.98 0.99 rg ${marginX} ${y} ${contentWidth} ${cardH} re f`);
  p1.push(`0.80 0.83 0.88 RG 1 w ${marginX} ${y} ${contentWidth} ${cardH} re S`);

  // Líneas divisorias verticales
  p1.push(`0.88 0.90 0.93 RG 0.75 w`);
  p1.push(`${marginX + colW} ${y + 4} m ${marginX + colW} ${y + cardH - 4} l S`);
  p1.push(`${marginX + colW * 2} ${y + 4} m ${marginX + colW * 2} ${y + cardH - 4} l S`);
  p1.push(`${marginX + colW * 3} ${y + 4} m ${marginX + colW * 3} ${y + cardH - 4} l S`);

  // Col 1: Software
  p1.push(`0.40 0.45 0.50 rg BT /F2 6.5 Tf ${marginX + 8} ${y + 28} Td (${escapePdfText('SOFTWARE EVALUADO')}) Tj ET`);
  p1.push(`0.09 0.13 0.17 rg BT /F2 8.5 Tf ${marginX + 8} ${y + 14} Td (${escapePdfText(data.softwareName || '—')}) Tj ET`);

  // Col 2: Decisor / Evaluador
  p1.push(`0.40 0.45 0.50 rg BT /F2 6.5 Tf ${marginX + colW + 8} ${y + 28} Td (${escapePdfText('DECISOR / EVALUADOR')}) Tj ET`);
  p1.push(`0.09 0.13 0.17 rg BT /F2 8.5 Tf ${marginX + colW + 8} ${y + 14} Td (${escapePdfText(data.decisorName || 'Adrian Avila')}) Tj ET`);

  // Col 3: Fecha
  p1.push(`0.40 0.45 0.50 rg BT /F2 6.5 Tf ${marginX + colW * 2 + 8} ${y + 28} Td (${escapePdfText('FECHA DE EVALUACIÓN')}) Tj ET`);
  p1.push(`0.09 0.13 0.17 rg BT /F2 8.5 Tf ${marginX + colW * 2 + 8} ${y + 14} Td (${escapePdfText(data.completionDate || '25 de noviembre de 2026')}) Tj ET`);

  // Col 4: Dictamen Final con color
  const recCat = data.recommendation.categoria || 'A';
  let dictamenColor = [0.04, 0.47, 0.34]; // Verde
  let dictamenText = `Categoría A (${data.recommendation.titulo || 'Favorable'})`;
  if (recCat === 'B') {
    dictamenColor = [0.70, 0.33, 0.04]; // Ámbar
    dictamenText = `Categoría B (${data.recommendation.titulo || 'Condicionada'})`;
  } else if (recCat === 'C') {
    dictamenColor = [0.75, 0.07, 0.24]; // Rojo/Rose
    dictamenText = `Categoría C (${data.recommendation.titulo || 'No se debe adoptar'})`;
  }

  p1.push(`0.40 0.45 0.50 rg BT /F2 6.5 Tf ${marginX + colW * 3 + 8} ${y + 28} Td (${escapePdfText('DICTAMEN FINAL')}) Tj ET`);
  p1.push(`${dictamenColor[0]} ${dictamenColor[1]} ${dictamenColor[2]} rg BT /F2 8 Tf ${marginX + colW * 3 + 8} ${y + 14} Td (${escapePdfText(dictamenText)}) Tj ET`);
  p1.push('Q');

  y -= 22;

  // ──────────────────────────────────────────────────────────────────────────
  // DISTRIBUCIÓN DE FACTORES POR CUADRANTE FODA
  // ──────────────────────────────────────────────────────────────────────────
  const totalFactors = data.fodaCounts.total || (data.fodaCounts.Fortalezas + data.fodaCounts.Oportunidades + data.fodaCounts.Debilidades + data.fodaCounts.Amenazas) || 1;
  const pct = (val: number) => Math.round((val / totalFactors) * 100);

  p1.push('q');
  p1.push(`0.14 0.21 0.26 rg BT /F2 8.5 Tf ${marginX} ${y} Td (${escapePdfText('DISTRIBUCIÓN DE FACTORES POR CUADRANTE FODA')}) Tj ET`);
  p1.push(`0.40 0.45 0.50 rg BT /F1 7.5 Tf ${pageWidth - marginX - 140} ${y} Td (${escapePdfText(`Total evaluado: ${totalFactors} factores técnicos`)}) Tj ET`);
  p1.push('Q');

  y -= 8;

  const fodaW = (contentWidth - 27) / 4; // ~122
  const fodaH = 56;
  y -= fodaH;

  const fodaCards = [
    {
      title: 'FORTALEZAS',
      sub: 'Factores internos favorables',
      count: data.fodaCounts.Fortalezas,
      barColor: [0.06, 0.46, 0.43], // teal-700
      badgeBg: [0.94, 0.99, 0.98], // teal-50
      badgeBorder: [0.60, 0.96, 0.89], // teal-200
      badgeText: [0.07, 0.37, 0.35], // teal-800
    },
    {
      title: 'OPORTUNIDADES',
      sub: 'Factores externos favorables',
      count: data.fodaCounts.Oportunidades,
      barColor: [0.01, 0.41, 0.63], // sky-700
      badgeBg: [0.94, 0.98, 1.00], // sky-50
      badgeBorder: [0.73, 0.90, 0.99], // sky-200
      badgeText: [0.03, 0.35, 0.52], // sky-800
    },
    {
      title: 'DEBILIDADES',
      sub: 'Riesgos internos a subsanar',
      count: data.fodaCounts.Debilidades,
      barColor: [0.85, 0.47, 0.02], // amber-600
      badgeBg: [1.00, 0.98, 0.92], // amber-50
      badgeBorder: [0.99, 0.90, 0.54], // amber-200
      badgeText: [0.57, 0.25, 0.05], // amber-800
    },
    {
      title: 'AMENAZAS',
      sub: 'Riesgos externos críticos',
      count: data.fodaCounts.Amenazas,
      barColor: [0.75, 0.07, 0.24], // rose-700
      badgeBg: [1.00, 0.95, 0.95], // rose-50
      badgeBorder: [0.99, 0.80, 0.83], // rose-200
      badgeText: [0.62, 0.07, 0.22], // rose-800
    },
  ];

  fodaCards.forEach((card, i) => {
    const cX = marginX + i * (fodaW + 9);
    p1.push('q');
    // Fondo blanco y borde
    p1.push(`1 1 1 rg ${cX} ${y} ${fodaW} ${fodaH} re f`);
    p1.push(`0.88 0.90 0.93 RG 1 w ${cX} ${y} ${fodaW} ${fodaH} re S`);
    // Línea superior de color (3.5pt)
    p1.push(`${card.barColor[0]} ${card.barColor[1]} ${card.barColor[2]} rg ${cX} ${y + fodaH - 3.5} ${fodaW} 3.5 re f`);

    // Número grande
    p1.push(`0.09 0.13 0.17 rg BT /F2 24 Tf ${cX + 10} ${y + 26} Td (${card.count}) Tj ET`);

    // Badge de porcentaje
    const bW = 28;
    const bH = 13;
    const bX = cX + fodaW - bW - 8;
    const bY = y + 33;
    p1.push(`${card.badgeBg[0]} ${card.badgeBg[1]} ${card.badgeBg[2]} rg ${bX} ${bY} ${bW} ${bH} re f`);
    p1.push(`${card.badgeBorder[0]} ${card.badgeBorder[1]} ${card.badgeBorder[2]} RG 0.5 w ${bX} ${bY} ${bW} ${bH} re S`);
    p1.push(`${card.badgeText[0]} ${card.badgeText[1]} ${card.badgeText[2]} rg BT /F2 7.5 Tf ${bX + 5} ${bY + 3.5} Td (${pct(card.count)}%) Tj ET`);

    // Título y subtítulo
    p1.push(`0.14 0.21 0.26 rg BT /F2 8 Tf ${cX + 10} ${y + 14} Td (${escapePdfText(card.title)}) Tj ET`);
    p1.push(`0.40 0.45 0.50 rg BT /F1 6.5 Tf ${cX + 10} ${y + 4.5} Td (${escapePdfText(card.sub)}) Tj ET`);
    p1.push('Q');
  });

  y -= 14;

  // Nota técnica bajo las tarjetas FODA
  p1.push('q');
  p1.push(`0.20 0.25 0.29 rg BT /F2 7 Tf ${marginX} ${y} Td (${escapePdfText('Nota técnica:')}) Tj ET`);
  p1.push(`0.40 0.45 0.50 rg BT /F1 7 Tf ${marginX + 55} ${y} Td (${escapePdfText('Los factores clasificados como Debilidades y Amenazas corresponden a condiciones desfavorables computadas por el modelo matemático GUIOS.')}) Tj ET`);
  p1.push('Q');

  y -= 22;

  // ──────────────────────────────────────────────────────────────────────────
  // TABLAS DETALLADAS POR DIMENSIÓN
  // ──────────────────────────────────────────────────────────────────────────
  data.dimensionGroups.forEach((dim, dIdx) => {
    checkPageBreak(55);
    const pDim = currentStream();

    // Encabezado de Dimensión con Pill DIM X
    pDim.push('q');
    // Pill DIM X
    const dimPillW = 30;
    pDim.push(`0.88 0.90 0.93 rg ${marginX} ${y - 1} ${dimPillW} 12 re f`);
    pDim.push(`0.14 0.21 0.26 rg BT /F2 7 Tf ${marginX + 4} ${y + 2.5} Td (${escapePdfText(`DIM ${dIdx + 1}`)}) Tj ET`);

    // Nombre de Dimensión (Serif / Bold)
    pDim.push(`0.09 0.13 0.17 rg BT /F2 10.5 Tf ${marginX + 36} ${y + 1.5} Td (${escapePdfText(dim.dimensionName)}) Tj ET`);

    // Conteo en mono a la derecha
    const cF = dim.counts?.F ?? dim.factors.filter((f) => (f.foda_classification || '').toUpperCase().includes('FORTALEZA') || f.foda_classification === 'F').length;
    const cO = dim.counts?.O ?? dim.factors.filter((f) => (f.foda_classification || '').toUpperCase().includes('OPORTUNIDAD') || f.foda_classification === 'O').length;
    const cD = dim.counts?.D ?? dim.factors.filter((f) => (f.foda_classification || '').toUpperCase().includes('DEBILIDAD') || f.foda_classification === 'D').length;
    const cA = dim.counts?.A ?? dim.factors.filter((f) => (f.foda_classification || '').toUpperCase().includes('AMENAZA') || f.foda_classification === 'A').length;
    const countStr = `${dim.factors.length} factores (${cF} F · ${cO} O · ${cD} D · ${cA} A)`;
    pDim.push(`0.40 0.45 0.50 rg BT /F1 7.5 Tf ${pageWidth - marginX - 160} ${y + 2} Td (${escapePdfText(countStr)}) Tj ET`);

    // Línea divisoria bajo el título de dimensión
    pDim.push(`0.80 0.83 0.88 RG 0.75 w ${marginX} ${y - 4} m ${pageWidth - marginX} ${y - 4} l S`);
    pDim.push('Q');

    y -= 14;

    // Cabecera de la tabla de factores
    pDim.push('q');
    pDim.push(`0.95 0.96 0.98 rg ${marginX} ${y - 14} ${contentWidth} 14 re f`);
    pDim.push(`0.80 0.83 0.88 RG 0.5 w ${marginX} ${y - 14} ${contentWidth} 14 re S`);
    pDim.push(`0.20 0.25 0.29 rg`);
    pDim.push(`BT /F2 6.5 Tf ${marginX + 8} ${y - 9.5} Td (${escapePdfText('FACTOR TÉCNICO')}) Tj ET`);
    pDim.push(`BT /F2 6.5 Tf ${marginX + 270} ${y - 9.5} Td (${escapePdfText('PONDERACIÓN MEDIA')}) Tj ET`);
    pDim.push(`BT /F2 6.5 Tf ${marginX + 370} ${y - 9.5} Td (${escapePdfText('ALCANCE')}) Tj ET`);
    pDim.push(`BT /F2 6.5 Tf ${marginX + 440} ${y - 9.5} Td (${escapePdfText('CLASIFICACIÓN')}) Tj ET`);
    pDim.push('Q');

    y -= 14;

    // Filas de Factores
    dim.factors.forEach((f) => {
      checkPageBreak(18);
      const pF = currentStream();
      const rowH = 16;
      y -= rowH;

      const fRaw = (f.foda_classification_display || f.foda_classification || f.swot_classification || '').trim().toUpperCase();
      const isAttention = fRaw.includes('DEBILIDAD') || fRaw.includes('AMENAZA') || fRaw === 'D' || fRaw === 'A';

      pF.push('q');
      // Fondo de fila
      if (isAttention) {
        pF.push(`1.00 0.98 0.96 rg ${marginX} ${y} ${contentWidth} ${rowH} re f`);
      } else {
        pF.push(`1 1 1 rg ${marginX} ${y} ${contentWidth} ${rowH} re f`);
      }
      pF.push(`0.92 0.94 0.96 RG 0.5 w ${marginX} ${y} ${contentWidth} ${rowH} re S`);

      // Nombre del factor
      pF.push(`0.09 0.13 0.17 rg BT /F2 7.5 Tf ${marginX + 8} ${y + 5} Td (${escapePdfText(f.factor_name)}) Tj ET`);

      // Ponderación media
      const avgStr = f.average_weighting_display || (typeof f.average_weighting === 'number' ? f.average_weighting.toFixed(1) : '3.0');
      pF.push(`0.20 0.25 0.29 rg BT /F1 7.5 Tf ${marginX + 300} ${y + 5} Td (${escapePdfText(avgStr)}) Tj ET`);

      // Alcance
      const scpStr = (f.scope_display || f.scope || 'Interno').toUpperCase() === 'INTERNO' ? 'Interno' : 'Externo';
      pF.push(`0.40 0.45 0.50 rg BT /F1 7.5 Tf ${marginX + 375} ${y + 5} Td (${escapePdfText(scpStr)}) Tj ET`);

      // Pill de Clasificación FODA exacta
      let pillBg = [0.94, 0.99, 0.98];
      let pillBorder = [0.60, 0.96, 0.89];
      let pillText = [0.07, 0.37, 0.35];
      let pillLabel = '• Fortaleza';

      if (fRaw.includes('OPORTUNIDAD') || fRaw === 'O') {
        pillBg = [0.94, 0.98, 1.00];
        pillBorder = [0.73, 0.90, 0.99];
        pillText = [0.03, 0.35, 0.52];
        pillLabel = '• Oportunidad';
      } else if (fRaw.includes('DEBILIDAD') || fRaw === 'D') {
        pillBg = [1.00, 0.98, 0.92];
        pillBorder = [0.99, 0.90, 0.54];
        pillText = [0.57, 0.25, 0.05];
        pillLabel = '▲ Debilidad';
      } else if (fRaw.includes('AMENAZA') || fRaw === 'A') {
        pillBg = [1.00, 0.95, 0.95];
        pillBorder = [0.99, 0.80, 0.83];
        pillText = [0.62, 0.07, 0.22];
        pillLabel = '✕ Amenaza';
      }

      const pillW = 62;
      const pillH = 11;
      const pillX = marginX + 440;
      const pillY = y + 2.5;

      pF.push(`${pillBg[0]} ${pillBg[1]} ${pillBg[2]} rg ${pillX} ${pillY} ${pillW} ${pillH} re f`);
      pF.push(`${pillBorder[0]} ${pillBorder[1]} ${pillBorder[2]} RG 0.5 w ${pillX} ${pillY} ${pillW} ${pillH} re S`);
      pF.push(`${pillText[0]} ${pillText[1]} ${pillText[2]} rg BT /F2 6.5 Tf ${pillX + 7} ${pillY + 3} Td (${escapePdfText(pillLabel)}) Tj ET`);
      pF.push('Q');
    });

    y -= 14;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DICTAMEN TÉCNICO Y RECOMENDACIÓN OFICIAL
  // ──────────────────────────────────────────────────────────────────────────
  const recLines = wrapText(data.recommendation.texto || '', 98);
  const critList = data.recommendation.factores_desfavorables_criticos || [];
  const dictamenH = 42 + recLines.length * 10 + (critList.length > 0 ? 32 : 0);

  checkPageBreak(dictamenH + 10);
  const pDict = currentStream();
  y -= dictamenH;

  pDict.push('q');
  // Fondo suave según categoría
  let boxBg = [1.00, 0.96, 0.96]; // rose-50/50
  let boxBorder = [0.99, 0.70, 0.75]; // rose-300
  let badgeBg = [0.62, 0.07, 0.22]; // rose-700
  let catTitle = `DICTAMEN TÉCNICO OFICIAL — CATEGORÍA ${recCat}`;

  if (recCat === 'A') {
    boxBg = [0.94, 0.99, 0.96]; // emerald-50/50
    boxBorder = [0.65, 0.93, 0.78];
    badgeBg = [0.04, 0.47, 0.34];
  } else if (recCat === 'B') {
    boxBg = [1.00, 0.98, 0.94]; // amber-50/50
    boxBorder = [0.99, 0.85, 0.55];
    badgeBg = [0.70, 0.33, 0.04];
  }

  pDict.push(`${boxBg[0]} ${boxBg[1]} ${boxBg[2]} rg ${marginX} ${y} ${contentWidth} ${dictamenH} re f`);
  pDict.push(`${boxBorder[0]} ${boxBorder[1]} ${boxBorder[2]} RG 1 w ${marginX} ${y} ${contentWidth} ${dictamenH} re S`);

  // Barra de cabecera con Badge (ancho suficiente de 205 para no truncar CATEGORÍA C)
  const bW = 205;
  const bH = 13;
  pDict.push(`${badgeBg[0]} ${badgeBg[1]} ${badgeBg[2]} rg ${marginX + 10} ${y + dictamenH - 18} ${bW} ${bH} re f`);
  pDict.push(`1 1 1 rg BT /F2 7 Tf ${marginX + 16} ${y + dictamenH - 14} Td (${escapePdfText(catTitle)}) Tj ET`);
  pDict.push(`0.40 0.45 0.50 rg BT /F2 7 Tf ${pageWidth - marginX - 90} ${y + dictamenH - 14} Td (${escapePdfText('Metodología GUIOS')}) Tj ET`);

  // Línea divisoria suave bajo la barra
  pDict.push(`0.88 0.90 0.93 RG 0.5 w ${marginX + 10} ${y + dictamenH - 24} m ${pageWidth - marginX - 10} ${y + dictamenH - 24} l S`);

  // Título del dictamen
  pDict.push(`0.09 0.13 0.17 rg BT /F2 11.5 Tf ${marginX + 10} ${y + dictamenH - 38} Td (${escapePdfText(data.recommendation.titulo || 'Dictamen oficial')}) Tj ET`);

  // Párrafo de texto explicativo
  pDict.push(`0.20 0.25 0.29 rg`);
  let lineY = y + dictamenH - 50;
  recLines.forEach((ln) => {
    pDict.push(`BT /F1 7.5 Tf ${marginX + 10} ${lineY} Td (${escapePdfText(ln)}) Tj ET`);
    lineY -= 10;
  });

  // Factores críticos determinantes si existen (en línea separada para evitar superposición)
  if (critList.length > 0) {
    pDict.push(`0.88 0.90 0.93 RG 0.5 w ${marginX + 10} ${lineY + 4} m ${pageWidth - marginX - 10} ${lineY + 4} l S`);
    lineY -= 7;
    pDict.push(`0.40 0.45 0.50 rg BT /F2 6.5 Tf ${marginX + 10} ${lineY} Td (${escapePdfText('FACTORES CRÍTICOS DETERMINANTES DEL DICTAMEN:')}) Tj ET`);

    lineY -= 15;
    let tagX = marginX + 10;
    critList.forEach((fc) => {
      const tagStr = `${fc.nombre} (${fc.foda || 'Crítico'})`;
      const tagW = tagStr.length * 4.5 + 14;
      if (tagX + tagW > marginX + contentWidth - 10) {
        tagX = marginX + 10;
        lineY -= 15;
      }
      pDict.push(`1 1 1 rg ${tagX} ${lineY - 2} ${tagW} 13 re f`);
      pDict.push(`0.80 0.83 0.88 RG 0.5 w ${tagX} ${lineY - 2} ${tagW} 13 re S`);
      pDict.push(`0.14 0.21 0.26 rg BT /F2 6.5 Tf ${tagX + 6} ${lineY + 2} Td (${escapePdfText(tagStr)}) Tj ET`);
      tagX += tagW + 6;
    });
  }
  pDict.push('Q');

  y -= 25;

  // ──────────────────────────────────────────────────────────────────────────
  // BLOQUE FORMAL DE FIRMA DEL DECISOR ("incluio ahí la firma abajo")
  // ──────────────────────────────────────────────────────────────────────────
  checkPageBreak(70);
  const pSign = currentStream();
  y -= 38;

  pSign.push('q');
  const signLineWidth = 200;
  const signLineX = (pageWidth - signLineWidth) / 2;

  // Línea gris de firma
  pSign.push(`0.60 0.65 0.70 RG 1 w`);
  pSign.push(`${signLineX} ${y} m ${signLineX + signLineWidth} ${y} l S`);

  // Nombre del decisor (Centrado)
  pSign.push(`0.09 0.13 0.17 rg BT /F2 9.5 Tf ${signLineX + 40} ${y - 12} Td (${escapePdfText(data.decisorName || 'Adrian Avila')}) Tj ET`);
  // Cargo formal
  pSign.push(`0.40 0.45 0.50 rg BT /F1 8 Tf ${signLineX + 32} ${y - 23} Td (${escapePdfText('Decisor / Evaluador Responsable')}) Tj ET`);
  // Organización si existe
  if (data.organizationName) {
    pSign.push(`0.50 0.55 0.60 rg BT /F1 7.5 Tf ${signLineX + 38} ${y - 33} Td (${escapePdfText(data.organizationName)}) Tj ET`);
  }
  pSign.push('Q');

  // ──────────────────────────────────────────────────────────────────────────
  // PIE DE PÁGINA EN TODAS LAS PÁGINAS ("Página X de Y")
  // ──────────────────────────────────────────────────────────────────────────
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    p.push('q');
    p.push(`0.85 0.88 0.90 RG 0.5 w ${marginX} 36 m ${pageWidth - marginX} 36 l S`);
    p.push(`0.40 0.45 0.50 rg`);
    p.push(`BT /F1 7 Tf ${marginX} 26 Td (${escapePdfText('GuiosPro Software Quality Assessment • Reporte Oficial')}) Tj ET`);
    p.push(`BT /F1 7 Tf ${marginX + 195} 26 Td (${escapePdfText(`Generado el ${data.completionDate} • Documento Confidencial`)}) Tj ET`);
    p.push(`BT /F2 7 Tf ${pageWidth - marginX - 52} 26 Td (${escapePdfText(`Página ${idx + 1} de ${totalPages}`)}) Tj ET`);
    p.push('Q');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ENSAMBLAR ARCHIVO BINARIO PDF 1.4
  // ──────────────────────────────────────────────────────────────────────────
  const byteChunks: Uint8Array[] = [];
  const textEncoder = new TextEncoder();
  let currentByteOffset = 0;

  const appendBinary = (str: string) => {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    byteChunks.push(bytes);
    currentByteOffset += bytes.length;
  };

  const objOffsets: number[] = [];

  const startObject = (id: number) => {
    objOffsets[id] = currentByteOffset;
    appendBinary(`${id} 0 obj\n`);
  };

  const endObject = () => {
    appendBinary(`endobj\n`);
  };

  appendBinary('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const fontF1Id = 1;
  const fontF2Id = 2;
  const fontF3Id = 3;

  startObject(fontF1Id);
  appendBinary('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n');
  endObject();

  startObject(fontF2Id);
  appendBinary('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n');
  endObject();

  startObject(fontF3Id);
  appendBinary('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\n');
  endObject();

  const catalogId = 4;
  const pagesTreeId = 5;

  startObject(catalogId);
  appendBinary(`<< /Type /Catalog /Pages ${pagesTreeId} 0 R >>\n`);
  endObject();

  let nextObjId = 6;
  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];

  for (let i = 0; i < totalPages; i++) {
    pageObjIds.push(nextObjId++);
    contentObjIds.push(nextObjId++);
  }

  startObject(pagesTreeId);
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  appendBinary(`<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} /MediaBox [0 0 ${pageWidth} ${pageHeight}] >>\n`);
  endObject();

  for (let i = 0; i < totalPages; i++) {
    const pageId = pageObjIds[i];
    const contentId = contentObjIds[i];
    const streamContent = pages[i].join('\n');
    const streamBytes = textEncoder.encode(streamContent);

    startObject(pageId);
    appendBinary(`<< /Type /Page /Parent ${pagesTreeId} 0 R /Resources << /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R /F3 ${fontF3Id} 0 R >> >> /Contents ${contentId} 0 R >>\n`);
    endObject();

    startObject(contentId);
    appendBinary(`<< /Length ${streamBytes.length} >>\nstream\n`);
    appendBinary(streamContent);
    appendBinary('\nendstream\n');
    endObject();
  }

  const totalObjects = nextObjId;
  const startXrefOffset = currentByteOffset;
  appendBinary(`xref\n0 ${totalObjects}\n`);
  appendBinary('0000000000 65535 f \n');

  for (let i = 1; i < totalObjects; i++) {
    const off = String(objOffsets[i] || 0).padStart(10, '0');
    appendBinary(`${off} 00000 n \n`);
  }

  appendBinary(`trailer\n<< /Size ${totalObjects} /Root ${catalogId} 0 R >>\nstartxref\n${startXrefOffset}\n%%EOF\n`);

  return new Blob(byteChunks as any, { type: 'application/pdf' });
}

export function downloadEvaluationPdf(data: EvaluationPdfData, filename?: string): void {
  try {
    const blob = generateEvaluationPdfBlob(data);
    const safeName = (data.softwareName || 'Software').replace(/[^a-zA-Z0-9_-]/g, '_');
    const today = new Date().toISOString().split('T')[0];
    const actualFileName = filename || `Evaluacion_${safeName}_${today}.pdf`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = actualFileName;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 150);
  } catch (err) {
    console.error('Error al generar la descarga automática del PDF:', err);
    throw err;
  }
}
