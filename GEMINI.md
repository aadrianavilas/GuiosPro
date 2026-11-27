# Reglas y Directrices del Proyecto GuiosPro

## 1. Preservación Estricta del Diseño Visual
- **NO cambiar el diseño visual bajo ninguna circunstancia**:
  - Respetar rigurosamente la paleta de colores institucional (crema `#F6F5F3`, menta `#D5ECEC`, verde azulado/teal `#7FBFC1`, naranja `#F7A35F`, amarillo suave `#F9E8A0`, contenedor oscuro `#243642`, terracota `#B84318`, etc.).
  - Mantener las tipografías vigentes (serif Newsreader para títulos principales y sans-serif para interfaces y controles).
  - Preservar la estructura de componentes, bordes redondeados (`rounded-[14px]`, `rounded-[20px]`, `rounded-[24px]`), sombras y espaciados de los mockups aprobados.
  - No añadir estilos externos incompatibles ni modificar la apariencia visual sin solicitud expresa del usuario.

## 2. No Modificar Código a la Ligera (Prevención de Regresiones)
- **Revisión obligatoria de impacto previo**: Antes de modificar cualquier archivo tanto en backend como en frontend, revisar exhaustivamente que los cambios no rompan ni alteren funcionalidades ya desarrolladas y probadas.
- **Respeto a las reglas de negocio existentes**:
  - **Filtro estricto de Factores Irrelevantes**: Si el decisor selecciona un factor como *Irrelevante* (valor 1) o mantiene el valor por defecto 1, dicho factor queda excluido de la evaluación de subfactores y no se computa como factor relevante.
  - **Validación y persistencia de borradores**: Respetar el flujo de guardado de evaluaciones, la carga del borrador más reciente y las transiciones entre pasos.
  - **Cálculos metodológicos GUIOS**: Toda lógica matemática o de recomendación debe mantenerse en estricta coherencia con las especificaciones del sistema.
- **Verificación continua**: Ejecutar siempre la suite de pruebas del backend (`python manage.py test apps.evaluation`) y la compilación del frontend (`tsc -b && vite build`) tras cada cambio antes de darlo por finalizado.
