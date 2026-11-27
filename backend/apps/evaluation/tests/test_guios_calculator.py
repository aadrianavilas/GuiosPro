import unittest
from apps.evaluation.services.guios_calculator import (
    matriz,
    calcular_r,
    cuartiles,
    calcular_il,
    calcular_is,
    recalcular_importancia_sugerida,
    calcular_relativa,
    es_relevante,
    calcular_ponderacion_media,
    clasificar_foda,
    explicar_foda,
    calcular_recomendacion,
    TEXTO_RECOMENDACION_A,
    TEXTO_RECOMENDACION_B,
    TEXTO_RECOMENDACION_C,
)


class TestGuiosCalculator(unittest.TestCase):
    """
    Pruebas unitarias obligatorias basadas en la Sección 10 de docs/prompt_calculos_guios.md
    """

    def test_10_2_matriz_16_combinaciones(self):
        """
        10.2 Matriz: Probar las 16 combinaciones de Matriz(a, b) contra las tablas
        de las secciones 4.4 y 5: floor((a + b) / 2).
        """
        tabla_esperada = {
            # (IE, IL): IS
            (4, 1): 2, (4, 2): 3, (4, 3): 3, (4, 4): 4,
            (3, 1): 2, (3, 2): 2, (3, 3): 3, (3, 4): 3,
            (2, 1): 1, (2, 2): 2, (2, 3): 2, (2, 4): 3,
            (1, 1): 1, (1, 2): 1, (1, 3): 2, (1, 4): 2,
        }

        for (a, b), esperado in tabla_esperada.items():
            resultado = matriz(a, b)
            self.assertEqual(
                resultado,
                esperado,
                f"Fallo en matriz({a}, {b}): esperado {esperado}, obtenido {resultado}",
            )

        # Validación de rangos inválidos
        with self.assertRaises(ValueError):
            matriz(0, 3)
        with self.assertRaises(ValueError):
            matriz(5, 2)
        with self.assertRaises(TypeError):
            matriz("3", 2)  # type: ignore

    def test_10_1_cuartiles_e_is_literatura_2020_2025(self):
        """
        10.1 Cuartiles e IS con la literatura 2020-2025 (IE = 3 en todos los 18 factores).
        """
        datos_entrada = [
            {"name": "Compatibilidad", "ns": 8, "tc": 10, "ie": 3, "r_esperado": 1.250, "il_esperado": 1, "is_esperado": 2},
            {"name": "Fiabilidad", "ns": 5, "tc": 9, "ie": 3, "r_esperado": 1.800, "il_esperado": 2, "is_esperado": 2},
            {"name": "Mantenibilidad", "ns": 1, "tc": 15, "ie": 3, "r_esperado": 15.000, "il_esperado": 4, "is_esperado": 3},
            {"name": "Personalización", "ns": 6, "tc": 9, "ie": 3, "r_esperado": 1.500, "il_esperado": 1, "is_esperado": 2},
            {"name": "Prueba", "ns": 1, "tc": 7, "ie": 3, "r_esperado": 7.000, "il_esperado": 4, "is_esperado": 3},
            {"name": "Documentación", "ns": 11, "tc": 6, "ie": 3, "r_esperado": 6/11, "il_esperado": 1, "is_esperado": 2},
            {"name": "Portabilidad", "ns": 2, "tc": 3, "ie": 3, "r_esperado": 1.500, "il_esperado": 1, "is_esperado": 2},
            {"name": "Reutilización", "ns": 2, "tc": 2, "ie": 3, "r_esperado": 1.000, "il_esperado": 1, "is_esperado": 2},
            {"name": "Usabilidad", "ns": 4, "tc": 9, "ie": 3, "r_esperado": 2.250, "il_esperado": 2, "is_esperado": 2},
            {"name": "Apoyo de la alta dirección", "ns": 1, "tc": 7, "ie": 3, "r_esperado": 7.000, "il_esperado": 4, "is_esperado": 3},
            {"name": "Formación", "ns": 4, "tc": 8, "ie": 3, "r_esperado": 2.000, "il_esperado": 2, "is_esperado": 2},
            {"name": "Soporte", "ns": 6, "tc": 14, "ie": 3, "r_esperado": 14/6, "il_esperado": 3, "is_esperado": 3},
            {"name": "Actitud hacia el cambio", "ns": 2, "tc": 7, "ie": 3, "r_esperado": 3.500, "il_esperado": 3, "is_esperado": 3},
            {"name": "Bloqueo de proveedores", "ns": 1, "tc": 7, "ie": 3, "r_esperado": 7.000, "il_esperado": 4, "is_esperado": 3},
            {"name": "Casos de estudio de adopción FLOSS", "ns": 1, "tc": 6, "ie": 3, "r_esperado": 6.000, "il_esperado": 3, "is_esperado": 3},
            {"name": "Centralidad de la TI", "ns": 2, "tc": 3, "ie": 3, "r_esperado": 1.500, "il_esperado": 1, "is_esperado": 2},
            {"name": "Tiempo de adopción", "ns": 2, "tc": 7, "ie": 3, "r_esperado": 3.500, "il_esperado": 3, "is_esperado": 3},
            {"name": "TCO", "ns": 2, "tc": 11, "ie": 3, "r_esperado": 5.500, "il_esperado": 3, "is_esperado": 3},
        ]

        # 1. Probar cálculo de r para cada uno
        r_calculados = []
        for d in datos_entrada:
            r = calcular_r(d["tc"], d["ns"])
            self.assertAlmostEqual(r, d["r_esperado"], places=4)
            r_calculados.append(r)

        # 2. Probar cuartiles con mediana de mitades
        rq1, rq2, rq3, rq4 = cuartiles(r_calculados)
        self.assertAlmostEqual(rq1, 1.5, places=3, msg="rq1 debe ser 1.5")
        self.assertAlmostEqual(rq2, 2.29166666667, places=4, msg="rq2 debe ser aprox 2.292")
        self.assertAlmostEqual(rq3, 6.0, places=3, msg="rq3 debe ser 6.0")
        self.assertAlmostEqual(rq4, 15.0, places=3, msg="rq4 debe ser 15.0")

        # 3. Probar IL e IS por factor usando la función orquestadora
        resultado_fase_a = recalcular_importancia_sugerida(datos_entrada)
        factores_calculados = resultado_fase_a["factores"]

        for fc, d in zip(factores_calculados, datos_entrada):
            self.assertEqual(
                fc["il"],
                d["il_esperado"],
                f"Factor {d['name']} IL esperado {d['il_esperado']}, obtenido {fc['il']}",
            )
            self.assertEqual(
                fc["is"],
                d["is_esperado"],
                f"Factor {d['name']} IS esperado {d['is_esperado']}, obtenido {fc['is']}",
            )

    def test_10_3_relativa_y_relevancia(self):
        """
        10.3 Relativa y relevancia:
        | IS | Decisor | Relativa | ¿Relevante? |
        | 3  | 2       | 2        | Sí          |
        | 3  | 1       | 2        | Sí          |
        | 2  | 1       | 1        | No          |
        | 2  | 4       | 3        | Sí          |
        | 4  | 4       | 4        | Sí          |
        """
        casos = [
            {"is_val": 3, "decisor": 2, "relativa": 2, "relevante": True},
            {"is_val": 3, "decisor": 1, "relativa": 2, "relevante": True},
            {"is_val": 2, "decisor": 1, "relativa": 1, "relevante": False},
            {"is_val": 2, "decisor": 4, "relativa": 3, "relevante": True},
            {"is_val": 4, "decisor": 4, "relativa": 4, "relevante": True},
        ]

        for c in casos:
            rel = calcular_relativa(c["is_val"], c["decisor"])
            self.assertEqual(rel, c["relativa"])
            self.assertEqual(es_relevante(rel), c["relevante"])

    def test_10_4_ponderacion_y_foda(self):
        """
        10.4 Ponderación y FODA:
        | Subfactores               | Alcance | Media | FODA        |
        | 4,3                       | Externo | 3.5   | Oportunidad |
        | 4,4,4,3,2,2,4,4           | Interno | 3.375 | Fortaleza   |
        | 2,3,3                     | Externo | 2.667 | Amenaza     |
        | 3,3,3                     | Interno | 3.0   | Fortaleza   |
        | 2,3,4,2,3,3,3,3,3,3,3     | Interno | 2.909 | Debilidad   | (sum=32, n=11 -> 2.909)
        """
        casos = [
            {"vals": [4, 3], "alcance": "Externo", "media_esperada": 3.5, "foda_esperado": "Oportunidad"},
            {"vals": [4, 4, 4, 3, 2, 2, 4, 4], "alcance": "Interno", "media_esperada": 3.375, "foda_esperado": "Fortaleza"},
            {"vals": [2, 3, 3], "alcance": "Externo", "media_esperada": 8 / 3, "foda_esperado": "Amenaza"},
            {"vals": [3, 3, 3], "alcance": "Interno", "media_esperada": 3.0, "foda_esperado": "Fortaleza"},
            # Nota: 32 / 11 = 2.90909... < 3.0 -> Debilidad
            {"vals": [2, 3, 4, 2, 3, 3, 3, 3, 3, 3, 3], "alcance": "Interno", "media_esperada": 32 / 11, "foda_esperado": "Debilidad"},
        ]

        for c in casos:
            media = calcular_ponderacion_media(c["vals"])
            self.assertAlmostEqual(media, c["media_esperada"], places=3)
            foda = clasificar_foda(media, c["alcance"])
            self.assertEqual(foda, c["foda_esperado"])

            # Probar también el texto explicativo de RF-17
            explicacion = explicar_foda(c["vals"], media, c["alcance"], foda)
            self.assertIn("Cálculo:", explicacion)
            self.assertIn(foda, explicacion)

    def test_10_5_recomendacion(self):
        """
        10.5 Recomendación:
        | Pares (relativa, FODA)          | Resultado |
        | (3, Oportunidad), (2, Fortaleza)| A         |
        | (3, Fortaleza), (2, Amenaza)    | B         |
        | (3, Debilidad), (2, Amenaza)    | C         |
        | (4, Amenaza)                    | C         |
        | (2, Debilidad), (2, Debilidad)  | B         |
        | lista vacía                     | error     |
        """
        # Caso 1: A
        res1 = calcular_recomendacion([(3, "Oportunidad"), (2, "Fortaleza")])
        self.assertEqual(res1["categoria"], "A")
        self.assertEqual(res1["texto"], TEXTO_RECOMENDACION_A)
        self.assertEqual(len(res1["factores_desfavorables_criticos"]), 0)
        self.assertEqual(len(res1["factores_desfavorables_opcionales"]), 0)

        # Caso 2: B (amenaza con relativa=2)
        res2 = calcular_recomendacion([(3, "Fortaleza"), (2, "Amenaza")])
        self.assertEqual(res2["categoria"], "B")
        self.assertEqual(res2["texto"], TEXTO_RECOMENDACION_B)
        self.assertEqual(len(res2["factores_desfavorables_criticos"]), 0)
        self.assertEqual(len(res2["factores_desfavorables_opcionales"]), 1)

        # Caso 3: C (debilidad con relativa=3 tiene prioridad sobre amenaza relativa=2)
        res3 = calcular_recomendacion([(3, "Debilidad"), (2, "Amenaza")])
        self.assertEqual(res3["categoria"], "C")
        self.assertEqual(res3["texto"], TEXTO_RECOMENDACION_C)
        self.assertEqual(len(res3["factores_desfavorables_criticos"]), 1)

        # Caso 4: C (amenaza con relativa=4)
        res4 = calcular_recomendacion([(4, "Amenaza")])
        self.assertEqual(res4["categoria"], "C")
        self.assertEqual(res4["texto"], TEXTO_RECOMENDACION_C)

        # Caso 5: B (dos debilidades con relativa=2)
        res5 = calcular_recomendacion([(2, "Debilidad"), (2, "Debilidad")])
        self.assertEqual(res5["categoria"], "B")
        self.assertEqual(res5["texto"], TEXTO_RECOMENDACION_B)

        # Caso 6: Lista vacía -> error
        with self.assertRaises(ValueError):
            calcular_recomendacion([])

    def test_cuartiles_con_n_impar(self):
        """
        Validar que cuando n es impar, el valor central se excluye de ambas mitades
        (Decisión 2 de la sección 11).
        """
        valores_impares = [10.0, 20.0, 30.0, 40.0, 50.0]
        # n = 5. rq2 = 30.0.
        # Mitad inferior: [10.0, 20.0] -> rq1 = 15.0
        # Mitad superior: [40.0, 50.0] -> rq3 = 45.0
        # rq4 = 50.0
        rq1, rq2, rq3, rq4 = cuartiles(valores_impares)
        self.assertEqual(rq1, 15.0)
        self.assertEqual(rq2, 30.0)
        self.assertEqual(rq3, 45.0)
        self.assertEqual(rq4, 50.0)

    def test_umbral_exacto_foda(self):
        """
        Validar que 3.0 exacto es favorable, mientras que 2.9999 es desfavorable
        (Regla de sección 7 y 11: comparaciones exactas).
        """
        # Exacto 3.0 -> Fortaleza / Oportunidad
        self.assertEqual(clasificar_foda(3.0, "Interno"), "Fortaleza")
        self.assertEqual(clasificar_foda(3.0, "Externo"), "Oportunidad")

        # 2.9999 -> Debilidad / Amenaza
        self.assertEqual(clasificar_foda(2.9999, "Interno"), "Debilidad")
        self.assertEqual(clasificar_foda(2.9999, "Externo"), "Amenaza")

        # 3.0001 -> Fortaleza / Oportunidad
        self.assertEqual(clasificar_foda(3.0001, "Interno"), "Fortaleza")
        self.assertEqual(clasificar_foda(3.0001, "Externo"), "Oportunidad")

    def test_validaciones_y_errores(self):
        """
        Validar manejo de errores: NS=0, valores fuera de rango, tipos incorrectos.
        """
        # NS <= 0
        with self.assertRaises(ValueError):
            calcular_r(10, 0)

        # Valoraciones de subfactor vacías
        with self.assertRaises(ValueError):
            calcular_ponderacion_media([])

        # Valoración fuera de rango
        with self.assertRaises(ValueError):
            calcular_ponderacion_media([1, 5])

        # Alcance inválido
        with self.assertRaises(ValueError):
            clasificar_foda(3.5, "Invalido")

        # Media fuera de rango [1.0, 4.0]
        with self.assertRaises(ValueError):
            clasificar_foda(0.9, "Interno")
        with self.assertRaises(ValueError):
            clasificar_foda(4.1, "Externo")


if __name__ == "__main__":
    unittest.main()
