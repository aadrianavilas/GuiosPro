import React from 'react';
import { createPortal } from 'react-dom';
import type { CalculatedFactorResult } from '@/pages/evaluations/CreateEvaluationView';
import { GuiosProLogo } from '@/components/brand/GuiosProLogo';

export interface EvaluationPdfReportProps {
  evaluationName: string;
  softwareName: string;
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
    factors: CalculatedFactorResult[];
    counts: { total: number; F: number; O: number; D: number; A: number };
  }>;
  recommendation: {
    categoria: 'A' | 'B' | 'C';
    titulo: string;
    texto: string;
    factores_desfavorables_criticos?: Array<{ nombre: string; foda: string; relativa: number }>;
  };
}

export const EvaluationPdfReport: React.FC<EvaluationPdfReportProps> = ({
  evaluationName,
  softwareName,
  decisorName,
  completionDate,
  organizationName,
  fodaCounts,
  dimensionGroups,
  recommendation,
}) => {
  const getFodaKey = (factor: CalculatedFactorResult): 'Fortalezas' | 'Oportunidades' | 'Debilidades' | 'Amenazas' | 'Otro' => {
    const raw = (
      factor.foda_classification_display ||
      factor.foda_classification ||
      factor.swot_classification ||
      factor.swot_code ||
      ''
    ).trim().toUpperCase();

    if (raw === 'F' || raw.includes('FORTALEZA')) return 'Fortalezas';
    if (raw === 'O' || raw.includes('OPORTUNIDAD')) return 'Oportunidades';
    if (raw === 'D' || raw.includes('DEBILIDAD')) return 'Debilidades';
    if (raw === 'A' || raw.includes('AMENAZA')) return 'Amenazas';
    return 'Otro';
  };

  const formatAvg = (factor: CalculatedFactorResult): string => {
    if (factor.average_weighting_display) return factor.average_weighting_display;
    if (typeof factor.average_weighting === 'number') {
      return factor.average_weighting.toFixed(2).replace('.', ',');
    }
    return '0,00';
  };

  const formatScope = (factor: CalculatedFactorResult): string => {
    if (factor.scope_display) return factor.scope_display;
    const s = (factor.scope || '').toUpperCase();
    if (s === 'INTERNO') return 'Interno';
    if (s === 'EXTERNO') return 'Externo';
    return factor.scope || 'Interno';
  };

  const criticalFactors = recommendation.factores_desfavorables_criticos || [];
  const totalFactors = fodaCounts.total || (fodaCounts.Fortalezas + fodaCounts.Oportunidades + fodaCounts.Debilidades + fodaCounts.Amenazas) || 1;

  const pct = (val: number) => Math.round((val / totalFactors) * 100);

  const reportContent = (
    <div id="guiospro-evaluation-pdf-report" className="font-sans text-slate-800 bg-white w-full space-y-5 print:p-0">
      {/* ── 1. Encabezado Ejecutivo Institucional ── */}
      <div className="pdf-avoid-break pb-3 border-b-2 border-[#243642] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GuiosProLogo textSize="text-2xl" />
          <div className="pl-3 border-l border-slate-300">
            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest leading-none">
              Metodología GUIOS
            </span>
            <span className="block text-[9px] text-slate-500 font-medium tracking-wide mt-0.5">
              Software Quality Assessment System
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-bold uppercase tracking-wider rounded border border-slate-300 mb-0.5">
            INFORME TÉCNICO OFICIAL
          </span>
          <span className="block text-[10px] text-slate-500 font-mono">
            REF: GUIOS-{new Date().getFullYear()}-{softwareName ? softwareName.slice(0, 4).toUpperCase() : 'SW'}
          </span>
        </div>
      </div>

      {/* ── 2. Título del Reporte y Ficha Técnica de Auditoría ── */}
      <div className="pdf-avoid-break space-y-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
            DICTAMEN Y RESULTADOS METODOLÓGICOS
          </span>
          <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
            Informe de Evaluación: {softwareName || evaluationName || 'Software'}
          </h1>
        </div>

        {/* Ficha Técnica de Evaluación (Diseño Ejecutivo Cuadriculado) */}
        <div className="bg-slate-50/70 border border-slate-300 rounded-[10px] p-3.5 grid grid-cols-4 gap-4 text-xs">
          <div className="border-r border-slate-200 pr-2">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              SOFTWARE EVALUADO
            </span>
            <span className="text-xs font-bold text-slate-900 block truncate" title={softwareName}>
              {softwareName || '—'}
            </span>
          </div>

          <div className="border-r border-slate-200 pr-2">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              DECISOR / EVALUADOR
            </span>
            <span className="text-xs font-bold text-slate-900 block truncate" title={decisorName}>
              {decisorName || 'Adrián'}
            </span>
          </div>

          <div className="border-r border-slate-200 pr-2">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              FECHA DE EVALUACIÓN
            </span>
            <span className="text-xs font-bold text-slate-900 block">
              {completionDate}
            </span>
          </div>

          <div>
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              DICTAMEN FINAL
            </span>
            <span
              className={`text-xs font-bold block ${
                recommendation.categoria === 'A'
                  ? 'text-emerald-700'
                  : recommendation.categoria === 'B'
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}
            >
              Categoría {recommendation.categoria} ({recommendation.titulo || 'Emitido'})
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Resumen Ejecutivo de Matriz FODA (Estilo Auditoría Profesional) ── */}
      <div className="pdf-avoid-break space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Distribución de Factores por Cuadrante FODA
          </h2>
          <span className="text-[10px] font-medium text-slate-500">
            Total evaluado: <strong>{totalFactors}</strong> factores técnicos
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {/* Fortalezas (Verde Azulado / Teal Ejecutivo) */}
          <div className="bg-white border-t-4 border-t-teal-700 border border-slate-200 rounded-[10px] p-3 text-left shadow-none">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-serif font-bold text-slate-900 leading-none">
                {fodaCounts.Fortalezas}
              </span>
              <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                {pct(fodaCounts.Fortalezas)}%
              </span>
            </div>
            <span className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mt-1.5">
              FORTALEZAS
            </span>
            <span className="block text-[9px] text-slate-500">
              Factores internos favorables
            </span>
          </div>

          {/* Oportunidades (Azul / Sky Ejecutivo) */}
          <div className="bg-white border-t-4 border-t-sky-700 border border-slate-200 rounded-[10px] p-3 text-left shadow-none">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-serif font-bold text-slate-900 leading-none">
                {fodaCounts.Oportunidades}
              </span>
              <span className="text-[10px] font-semibold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                {pct(fodaCounts.Oportunidades)}%
              </span>
            </div>
            <span className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mt-1.5">
              OPORTUNIDADES
            </span>
            <span className="block text-[9px] text-slate-500">
              Factores externos favorables
            </span>
          </div>

          {/* Debilidades (Ámbar / Ocre Ejecutivo) */}
          <div className="bg-white border-t-4 border-t-amber-600 border border-slate-200 rounded-[10px] p-3 text-left shadow-none">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-serif font-bold text-slate-900 leading-none">
                {fodaCounts.Debilidades}
              </span>
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                {pct(fodaCounts.Debilidades)}%
              </span>
            </div>
            <span className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mt-1.5">
              DEBILIDADES
            </span>
            <span className="block text-[9px] text-slate-500">
              Riesgos internos a subsanar
            </span>
          </div>

          {/* Amenazas (Carmesí / Terracota Ejecutivo) */}
          <div className="bg-white border-t-4 border-t-rose-700 border border-slate-200 rounded-[10px] p-3 text-left shadow-none">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-serif font-bold text-slate-900 leading-none">
                {fodaCounts.Amenazas}
              </span>
              <span className="text-[10px] font-semibold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                {pct(fodaCounts.Amenazas)}%
              </span>
            </div>
            <span className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mt-1.5">
              AMENAZAS
            </span>
            <span className="block text-[9px] text-slate-500">
              Riesgos externos críticos
            </span>
          </div>
        </div>

        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-0.5">
          <span className="font-semibold text-slate-700">Nota técnica:</span>
          <span>Los factores clasificados como Debilidades y Amenazas corresponden a condiciones desfavorables computadas por el modelo matemático GUIOS.</span>
        </div>
      </div>

      {/* ── 4. Tablas Detalladas por Dimensión (Estructura de Informe Formal) ── */}
      <div className="space-y-5 pt-1">
        {dimensionGroups.map((dim, idx) => (
          <div key={dim.dimensionId} className="pdf-avoid-break space-y-1.5">
            {/* Cabecera de Dimensión */}
            <div className="flex items-center justify-between border-b border-slate-300 pb-1">
              <div className="flex items-baseline gap-2">
                <span className="bg-slate-200 text-slate-800 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                  DIM {idx + 1}
                </span>
                <h3 className="text-sm font-serif font-bold text-slate-900">
                  {dim.dimensionName}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {dim.factors.length} factores ({dim.counts.F} F · {dim.counts.O} O · {dim.counts.D} D · {dim.counts.A} A)
              </span>
            </div>

            {/* Tabla con estilo formal sobrio */}
            <div className="border border-slate-200 rounded-[8px] overflow-hidden">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[9px] font-bold tracking-wider uppercase border-b border-slate-300">
                    <th className="py-1.5 px-3 font-semibold">FACTOR TÉCNICO</th>
                    <th className="py-1.5 px-3 font-semibold text-center w-28">PONDERACIÓN MEDIA</th>
                    <th className="py-1.5 px-3 font-semibold text-center w-24">ALCANCE</th>
                    <th className="py-1.5 px-3 font-semibold text-center w-28">CLASIFICACIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dim.factors.map((factor) => {
                    const fKey = getFodaKey(factor);
                    const isAttention = fKey === 'Debilidades' || fKey === 'Amenazas';

                    return (
                      <tr
                        key={factor.factor_id}
                        className={isAttention ? 'bg-amber-50/20' : 'bg-white'}
                      >
                        <td className="py-1.5 px-3 font-medium text-slate-900">
                          {factor.factor_name}
                        </td>
                        <td className="py-1.5 px-3 text-center font-mono text-slate-700">
                          {formatAvg(factor)}
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-600">
                          {formatScope(factor)}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          {fKey === 'Fortalezas' && (
                            <span className="inline-block bg-teal-50 text-teal-800 border border-teal-300 font-semibold text-[9px] px-2 py-0.5 rounded">
                              ● Fortaleza
                            </span>
                          )}
                          {fKey === 'Oportunidades' && (
                            <span className="inline-block bg-sky-50 text-sky-800 border border-sky-300 font-semibold text-[9px] px-2 py-0.5 rounded">
                              ● Oportunidad
                            </span>
                          )}
                          {fKey === 'Debilidades' && (
                            <span className="inline-block bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-[9px] px-2 py-0.5 rounded">
                              ▲ Debilidad
                            </span>
                          )}
                          {fKey === 'Amenazas' && (
                            <span className="inline-block bg-rose-50 text-rose-800 border border-rose-300 font-semibold text-[9px] px-2 py-0.5 rounded">
                              ✕ Amenaza
                            </span>
                          )}
                          {fKey === 'Otro' && (
                            <span className="inline-block bg-slate-100 text-slate-600 font-semibold text-[9px] px-2 py-0.5 rounded">
                              {factor.foda_classification || 'Evaluado'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ── 5. Dictamen Técnico y Recomendación Oficial ── */}
      <div className="pdf-avoid-break pt-2">
        <div
          className={`rounded-[10px] border p-4 space-y-2.5 ${
            recommendation.categoria === 'A'
              ? 'bg-emerald-50/50 border-emerald-300'
              : recommendation.categoria === 'B'
              ? 'bg-amber-50/50 border-amber-300'
              : 'bg-rose-50/50 border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between border-b pb-2 border-slate-200">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white ${
                  recommendation.categoria === 'A'
                    ? 'bg-emerald-700'
                    : recommendation.categoria === 'B'
                    ? 'bg-amber-700'
                    : 'bg-rose-700'
                }`}
              >
                DICTAMEN TÉCNICO OFICIAL — CATEGORÍA {recommendation.categoria}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500">
              Metodología GUIOS
            </span>
          </div>

          <div>
            <h3 className="text-base font-serif font-bold text-slate-900 leading-tight">
              {recommendation.titulo || (recommendation.categoria === 'A' ? 'Adoptar el software' : recommendation.categoria === 'B' ? 'Adopción condicionada' : 'No adoptar el software')}
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed mt-1">
              {recommendation.texto}
            </p>
          </div>

          {criticalFactors.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Factores críticos determinantes del dictamen:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {criticalFactors.map((fc, i) => (
                  <span
                    key={i}
                    className="bg-white border border-slate-300 text-slate-800 text-[10px] font-medium px-2.5 py-0.5 rounded"
                  >
                    <strong>{fc.nombre}</strong> ({fc.foda || 'Crítico'})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 6. Bloque Formal de Firma del Decisor ── */}
      <div className="pdf-avoid-break pt-4 space-y-4">
        <div className="flex justify-center pt-8">
          <div className="text-center">
            <div className="border-t border-slate-400 w-56 mx-auto pt-1" />
            <span className="block text-xs font-bold text-slate-900">
              {decisorName || 'Adrián'}
            </span>
            <span className="block text-[10px] text-slate-500">
              Decisor / Evaluador Responsable
            </span>
            {organizationName && (
              <span className="block text-[9px] text-slate-400">
                {organizationName}
              </span>
            )}
          </div>
        </div>

        {/* ── 7. Pie de Página del Informe ── */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400 font-mono">
          <span>GuiosPro Software Quality Assessment • Reporte Oficial</span>
          <span>Generado el {completionDate} • Documento Confidencial</span>
        </div>
      </div>
    </div>
  );

  // Renderizar a través de createPortal directamente en document.body para window.print()
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(reportContent, document.body);
  }

  return reportContent;
};
