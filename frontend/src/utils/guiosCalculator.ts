/**
 * Módulo de funciones matemáticas puras del sistema GUIOS (TypeScript / Frontend)
 * Basado estrictamente en docs/prompt_calculos_guios.md
 *
 * Las etiquetas de escalas, dimensiones, factores, subfactores, alcances y textos de recomendación
 * se obtienen dinámicamente desde la base de datos a través de la API.
 */

/**
 * Matriz de combinación: floor((a + b) / 2) con a, b en {1, 2, 3, 4}
 */
export function matriz(a: number, b: number): number {
  if (a < 1 || a > 4 || b < 1 || b > 4) {
    throw new Error(`Valores fuera de rango [1..4]: a=${a}, b=${b}`);
  }
  return Math.floor((a + b) / 2);
}

/**
 * FASE A: r_i = TC_i / NS_i
 */
export function calcularR(tc: number, ns: number): number {
  if (ns <= 0) {
    throw new Error("El número de subfactores debe ser mayor a 0.");
  }
  if (tc < 0) {
    throw new Error("El total de citas no puede ser negativo.");
  }
  return tc / ns;
}

function calcularMediana(arr: number[]): number {
  const n = arr.length;
  if (n === 0) throw new Error("Lista vacía para calcular mediana.");
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return arr[mid];
  } else {
    return (arr[mid - 1] + arr[mid]) / 2.0;
  }
}

/**
 * Cuartiles según el método 'mediana de mitades'
 */
export function cuartiles(valores: number[]): [number, number, number, number] {
  if (!valores || valores.length === 0) {
    throw new Error("Lista de valores vacía para calcular cuartiles.");
  }
  const sorted = [...valores].sort((a, b) => a - b);
  const n = sorted.length;
  const rq2 = calcularMediana(sorted);

  const k = Math.floor(n / 2);
  const mitadInferior = sorted.slice(0, k);
  const mitadSuperior = sorted.slice(n - k);

  const rq1 = calcularMediana(mitadInferior);
  const rq3 = calcularMediana(mitadSuperior);
  const rq4 = sorted[sorted.length - 1];

  return [rq1, rq2, rq3, rq4];
}

/**
 * FASE A: Importancia de la literatura
 */
export function calcularIL(r: number, [rq1, rq2, rq3]: [number, number, number, number]): number {
  if (r <= rq1) return 1;
  if (r <= rq2) return 2;
  if (r <= rq3) return 3;
  return 4;
}

/**
 * FASE A: Importancia sugerida
 */
export function calcularIS(ie: number, il: number): number {
  return matriz(ie, il);
}

/**
 * FASE B: Importancia relativa
 */
export function calcularRelativa(isVal: number, decisorVal: number): number {
  return matriz(isVal, decisorVal);
}

/**
 * FASE B: Condición de relevancia
 */
export function esRelevante(relativaVal: number): boolean {
  return relativaVal > 1;
}

/**
 * FASE C: Ponderación media del factor
 */
export function calcularPonderacionMedia(valoraciones: number[]): number {
  if (!valoraciones || valoraciones.length === 0) {
    throw new Error("No hay valoraciones de subfactores para calcular la media.");
  }
  for (const v of valoraciones) {
    if (v < 1 || v > 4) {
      throw new Error(`Valoración fuera de rango 1..4: ${v}`);
    }
  }
  const sum = valoraciones.reduce((acc, curr) => acc + curr, 0);
  return sum / valoraciones.length;
}

/**
 * FASE D1: Clasificación FODA
 */
export type FODAType = "Fortaleza" | "Oportunidad" | "Debilidad" | "Amenaza";

export function clasificarFoda(media: number, alcance: string): FODAType {
  const alcanceNorm = alcance.trim().toLowerCase();
  const esInterno = alcanceNorm === "interno";

  if (media >= 3.0) {
    return esInterno ? "Fortaleza" : "Oportunidad";
  } else {
    return esInterno ? "Debilidad" : "Amenaza";
  }
}

/**
 * FASE D1: Explicación de FODA
 */
export function explicarFoda(
  valoraciones: number[],
  media: number,
  alcance: string,
  foda?: FODAType
): string {
  const calcFoda = foda || clasificarFoda(media, alcance);
  const n = valoraciones.length;
  const valsStr = valoraciones.join(" + ");
  const condStr = media >= 3.0 ? "≥ 3" : "< 3";
  const mediaDisplay = Number(media.toFixed(3)).toString();

  return `Cálculo: (${valsStr}) / ${n} = ${mediaDisplay} | Regla: ${alcance.toLowerCase()} y ponderación ${condStr} → ${calcFoda}`;
}

/**
 * FASE D2: Recomendación global
 */
export interface FactorEvaluado {
  nombre?: string;
  factor_id?: number | string;
  relativa: number;
  foda: FODAType | string;
}

export interface RecomendacionResult {
  categoria: "A" | "B" | "C";
  resumenFoda: Record<FODAType, number>;
  desfavorablesCriticos: FactorEvaluado[];
  desfavorablesOpcionales: FactorEvaluado[];
}

export function calcularRecomendacion(factores: FactorEvaluado[]): RecomendacionResult {
  if (!factores || factores.length === 0) {
    throw new Error("No hay factores evaluados para calcular la recomendación.");
  }

  const resumenFoda: Record<FODAType, number> = {
    Fortaleza: 0,
    Oportunidad: 0,
    Debilidad: 0,
    Amenaza: 0,
  };

  const desfavorablesCriticos: FactorEvaluado[] = [];
  const desfavorablesOpcionales: FactorEvaluado[] = [];

  for (const f of factores) {
    let fodaNorm = f.foda as FODAType;
    if (f.foda === "F") fodaNorm = "Fortaleza";
    if (f.foda === "O") fodaNorm = "Oportunidad";
    if (f.foda === "D") fodaNorm = "Debilidad";
    if (f.foda === "A") fodaNorm = "Amenaza";

    if (resumenFoda[fodaNorm] !== undefined) {
      resumenFoda[fodaNorm]++;
    }

    const esDesfavorable = fodaNorm === "Debilidad" || fodaNorm === "Amenaza";
    if (esDesfavorable) {
      if (f.relativa === 3 || f.relativa === 4) {
        desfavorablesCriticos.push({ ...f, foda: fodaNorm });
      } else if (f.relativa === 2) {
        desfavorablesOpcionales.push({ ...f, foda: fodaNorm });
      }
    }
  }

  let categoria: "A" | "B" | "C";
  if (desfavorablesCriticos.length > 0) {
    categoria = "C";
  } else if (desfavorablesOpcionales.length > 0) {
    categoria = "B";
  } else {
    categoria = "A";
  }

  return {
    categoria,
    resumenFoda,
    desfavorablesCriticos,
    desfavorablesOpcionales,
  };
}
