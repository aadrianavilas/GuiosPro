# 📋 Historias de Usuario — GuiosPro

> **Escala SP:** 1 · 2 · 3 · 5 · 8 · 13  
> **Prioridades ClickUp:** Urgente · Alto · Normal · Baja

---

## 1. Autenticación y seguridad

---

### HU-01 · Registro de usuario — Urgente · 3 SP
**Como** usuario, **quiero** registrarme con mis datos personales y credenciales, **para** crear una cuenta en GuiosPro.

- **Dado** que estoy en el formulario de registro, **cuando** dejo vacío un campo obligatorio (nombres, apellidos, correo, contraseña, confirmación de contraseña), **entonces** se muestra el mensaje de error directamente en ese campo y el formulario no se envía.
- **Dado** que ingreso un correo ya asociado a otra cuenta, **cuando** envío el formulario, **entonces** el sistema lo rechaza con un mensaje genérico que no revela si esa dirección está registrada ni a quién pertenece.
- **Dado** que la contraseña no cumple alguno de los siguientes requisitos: mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial; o no coincide con la confirmación, **cuando** envío el formulario, **entonces** se indica de forma específica cuál requisito falla.
- **Dado** que todos los datos son válidos, **cuando** envío el formulario, **entonces** la cuenta se crea en estado "pendiente de verificación" y se dispara automáticamente el envío del código de activación (ver HU-02).

---

### HU-02 · Verificación del correo en el registro — Urgente · 3 SP
**Como** usuario, **quiero** ingresar el código enviado a mi correo, **para** activar mi cuenta.

- **Dado** que me registré, **cuando** el sistema envía el código, **entonces** este es un número de 6 dígitos generado de forma criptográficamente segura, almacenado como hash (no en texto plano), con vigencia de 5 minutos y válido para un solo uso.
- **Dado** que ingreso el código correcto y aún vigente, **cuando** lo confirmo, **entonces** la cuenta pasa a estado "activa" y puedo iniciar sesión.
- **Dado** que ingreso un código incorrecto, **cuando** lo confirmo, **entonces** se muestra un mensaje de error y se descuenta un intento del máximo de 3 permitidos.
- **Dado** que el código expiró (pasaron más de 5 minutos), se agotaron los 3 intentos o ya fue usado anteriormente, **cuando** lo ingreso, **entonces** se rechaza con el motivo específico y se me ofrece solicitar un nuevo código, que solo puede generarse si el anterior ya no está activo.

---

### HU-03 · Inicio de sesión — Urgente · 5 SP
**Como** usuario, **quiero** iniciar sesión con correo y contraseña, **para** acceder de forma segura.

- **Dado** que mi cuenta está activa y verificada, **cuando** ingreso credenciales correctas, **entonces** inicio sesión completamente (o paso al segundo factor si tengo MFA activado, ver HU-08).
- **Dado** que las credenciales son incorrectas, **cuando** intento ingresar, **entonces** se muestra un mensaje genérico que no indica si el error fue en el correo o en la contraseña.
- **Dado** que mi cuenta está en estado "pendiente de verificación", **cuando** intento ingresar, **entonces** se me deniega el acceso y se me ofrece reenviar el código de activación.
- **Dado** que mi cuenta está inactiva (deshabilitada por un administrador), **cuando** intento ingresar, **entonces** se me deniega el acceso sin más detalle.
- **Dado** que fallo 5 intentos de inicio de sesión consecutivos, **cuando** intento una vez más, **entonces** la cuenta queda bloqueada temporalmente y se informa que debe contactar al administrador o esperar el periodo de desbloqueo.

---

### HU-04 · Cerrar sesión — Urgente · 2 SP
**Como** usuario autenticado, **quiero** cerrar sesión, **para** proteger mi cuenta, sobre todo en equipos compartidos.

- **Dado** que tengo una sesión activa, **cuando** selecciono "Cerrar sesión", **entonces** los tokens de acceso y actualización se invalidan en el servidor y soy redirigido a la pantalla de inicio de sesión.
- **Dado** que cerré sesión, **cuando** uso el botón "atrás" del navegador o intento llamar directamente a una ruta protegida con los tokens anteriores, **entonces** el acceso es rechazado y soy redirigido al inicio de sesión.

---

### HU-05 · Recuperar contraseña — Urgente · 5 SP
**Como** usuario que olvidó su contraseña, **quiero** restablecerla mediante mi correo, **para** recuperar el acceso a mi cuenta.

- **Dado** que ingreso un correo en "Olvidé mi contraseña", **cuando** lo envío, **entonces** siempre veo el mismo mensaje de confirmación sin importar si el correo está o no registrado, para no revelar qué cuentas existen.
- **Dado** que el correo pertenece a una cuenta activa, **cuando** lo envío, **entonces** recibo un código numérico de 6 dígitos de un solo uso con vigencia de 5 minutos, generado de forma criptográficamente segura.
- **Dado** que ingreso el código vigente junto con una nueva contraseña que cumpla: mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial; **cuando** confirmo, **entonces** la contraseña se actualiza, el código queda invalidado y todas mis sesiones activas se cierran.
- **Dado** que el código expiró (más de 5 minutos) o ya fue usado, **cuando** lo ingreso, **entonces** se rechaza con el motivo y puedo solicitar un nuevo código.

---

### HU-06 · Cambiar contraseña — Alto · 3 SP
**Como** usuario autenticado, **quiero** cambiar mi contraseña, **para** mantener mi cuenta segura.

- **Dado** que estoy autenticado, **cuando** ingreso mi contraseña actual correcta y una nueva que cumpla: mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial, **entonces** la contraseña se actualiza de inmediato.
- **Dado** que la contraseña actual ingresada es incorrecta, **cuando** confirmo, **entonces** se rechaza con un mensaje claro sin bloquear la cuenta.
- **Dado** que la nueva contraseña es idéntica a la actual, **cuando** confirmo, **entonces** se rechaza indicando que debe ser diferente a la contraseña anterior.
- **Dado** que el cambio fue exitoso, **entonces** todas mis otras sesiones activas se cierran y recibo una notificación por correo informando del cambio.

---

### HU-07 · Activar y desactivar MFA — Urgente · 5 SP
**Como** usuario autenticado, **quiero** activar o desactivar la verificación en dos pasos, **para** decidir el nivel de seguridad de mi cuenta.

- **Dado** que MFA está desactivado, **cuando** selecciono "Activar verificación en dos pasos", **entonces** se envía un código numérico de 6 dígitos a mi correo (vigente por 5 minutos, un solo uso, máximo 3 intentos) y el MFA solo se activa si lo ingreso correctamente.
- **Dado** que MFA está activo, **cuando** selecciono "Desactivar verificación en dos pasos", **entonces** debo confirmar con mi contraseña actual y un código válido recibido al correo antes de que se desactive.
- **Dado** que cambié el estado del MFA (activé o desactivé), **entonces** el evento queda registrado con fecha y hora, y recibo una notificación por correo indicando el cambio.
- **Dado** que tengo una Passkey registrada, **cuando** desactivo el MFA por correo, **entonces** la Passkey permanece registrada en mi cuenta y no es eliminada.

---

### HU-08 · Inicio de sesión con MFA por correo — Urgente · 3 SP
**Como** usuario con MFA habilitado, **quiero** verificar mi identidad con un código enviado a mi correo, **para** completar el inicio de sesión.

- **Dado** que mis credenciales de correo y contraseña son correctas y tengo MFA activo, **cuando** el sistema lo solicita, **entonces** se envía un código numérico de 6 dígitos a mi correo (vigente por 5 minutos, máximo 3 intentos, un solo uso) y aún no se emiten tokens de sesión definitivos.
- **Dado** que ingreso el código correcto y vigente, **entonces** el inicio de sesión se completa y se generan mis tokens de acceso definitivos.
- **Dado** que agoto los 3 intentos permitidos, **cuando** intento con el código incorrecto una vez más, **entonces** el código se invalida y debo solicitar uno nuevo o reiniciar el proceso de inicio de sesión.
- **Dado** que el código expiró (más de 5 minutos), **entonces** se rechaza y puedo solicitar un código nuevo sin necesidad de ingresar nuevamente mi contraseña.

---

### HU-09 · Registrar Passkey — Alto · 8 SP
**Como** usuario autenticado, **quiero** registrar una Passkey, **para** usar biometría o una llave de seguridad como método de autenticación.

- **Dado** que estoy autenticado, **cuando** inicio el proceso de registro de Passkey, **entonces** el sistema genera las opciones de registro con un desafío único de un solo uso (almacenado temporalmente por 5 minutos) y el navegador solicita la verificación biométrica o de llave hardware.
- **Dado** que la verificación del navegador es válida, **entonces** la credencial queda asociada a mi cuenta y puedo asignarle un nombre identificable (ej. "Mi MacBook", "YubiKey").
- **Dado** que cancelo la solicitud del navegador o la verificación falla, **entonces** no se guarda ninguna credencial y se muestra el motivo del fallo.
- **Dado** que mi navegador no soporta WebAuthn, **entonces** la opción de registrar Passkey no aparece o se muestra un mensaje informando que el navegador no es compatible.

---

### HU-10 · Autenticación con Passkey — Alto · 8 SP
**Como** usuario con Passkey registrada, **quiero** autenticarme con ella, **para** acceder sin necesitar el código de correo como segundo factor.

- **Dado** que tengo al menos una Passkey registrada, **cuando** elijo autenticarme con Passkey, **entonces** el sistema genera un desafío único de un solo uso (válido por 5 minutos) y el navegador solicita la Passkey correspondiente.
- **Dado** que la respuesta firmada por la Passkey es válida y el contador de usos es coherente, **entonces** el inicio de sesión se completa sin necesidad del código por correo.
- **Dado** que la respuesta de la Passkey es inválida o el desafío expiró, **entonces** el intento se rechaza y puedo volver al método de inicio de sesión con contraseña.

---

## 2. Administración de accesos

---

### HU-11 · Gestionar grupos — Urgente · 5 SP
**Como** administrador, **quiero** crear, consultar, editar y eliminar grupos de usuarios, **para** organizar los accesos por perfil.

- **Dado** que soy administrador, **cuando** creo un grupo, **entonces** debo indicar un nombre único y una descripción; si el nombre ya existe, se rechaza con un mensaje claro.
- **Dado** que un grupo tiene usuarios asignados, **cuando** intento eliminarlo, **entonces** el sistema lo impide e indica el número de usuarios que pertenecen a ese grupo.
- **Dado** que edito la configuración de un grupo, **entonces** los cambios aplican a sus usuarios en su siguiente solicitud o inicio de sesión, sin requerir acción manual.
- **Dado** que existe el grupo del superusuario, **entonces** no puede editarse su nombre ni eliminarse desde la interfaz.

---

### HU-12 · Configurar módulos y menús visibles por grupo — Urgente · 5 SP
**Como** administrador, **quiero** definir qué módulos y menús aparecen en la pantalla de cada grupo, **para** que cada perfil vea solo lo que le corresponde.

- **Dado** que edito un grupo, **cuando** selecciono o deselecciono módulos y opciones de menú, **entonces** el cambio se guarda inmediatamente.
- **Dado** que un usuario pertenece a un grupo, **cuando** inicia sesión, **entonces** la barra de navegación muestra únicamente los módulos y menús asignados a su grupo.
- **Dado** que un módulo no está asignado al grupo de un usuario, **cuando** ese usuario intenta acceder por URL directa, **entonces** el backend rechaza el acceso con un error de autorización (ocultarlo en el menú no es suficiente).
- **Dado** que intento guardar un grupo sin ningún módulo asignado, **entonces** el sistema muestra una advertencia antes de permitir guardar.

---

### HU-13 · Gestionar permisos por módulo y acción — Urgente · 8 SP
**Como** administrador, **quiero** asignar permisos de consulta, creación, actualización y eliminación por módulo, **para** controlar qué puede hacer cada grupo.

- **Dado** que configuro un grupo, **cuando** asigno permisos por módulo, **entonces** puedo marcar de forma independiente cada acción: consultar, crear, actualizar y eliminar; y guardar cualquier combinación.
- **Dado** que un usuario ejecuta una operación (ej. eliminar un registro), **cuando** su grupo no tiene ese permiso habilitado, **entonces** el backend rechaza la operación con un error de autorización, independientemente de lo que muestre la interfaz.
- **Dado** que un grupo no tiene permiso de eliminar en un módulo, **entonces** el botón de eliminación no aparece en la interfaz y la API también rechaza la petición.
- **Dado** que un usuario tiene el rol de superusuario, **entonces** tiene acceso total a todas las operaciones sin depender de la configuración de permisos por grupo.

---

### HU-14 · Asignar usuarios a grupos — Urgente · 3 SP
**Como** administrador, **quiero** asignar o cambiar el grupo de un usuario, **para** que obtenga los accesos correspondientes.

- **Dado** que consulto la lista de usuarios, **cuando** cambio el grupo asignado a uno de ellos, **entonces** el cambio se guarda y queda registrado con fecha, usuario que realizó el cambio y grupo anterior.
- **Dado** que se registra un usuario nuevo en el sistema, **entonces** se le asigna automáticamente el grupo "Evaluador" por defecto.
- **Dado** que un usuario es el único con rol de superusuario activo, **entonces** no puede quitársele ese rol para evitar dejar el sistema sin administrador.

---

## 3. Gestión de la metodología

---

### HU-15 · Gestionar dimensiones — Urgente · 3 SP
**Como** administrador, **quiero** gestionar las dimensiones de la metodología, **para** organizar los elementos de evaluación.

- **Dado** que creo o edito una dimensión, **entonces** debo indicar nombre (único en el sistema), descripción y número de orden; si el nombre ya existe, se rechaza con un mensaje claro.
- **Dado** que una dimensión tiene factores asociados, **cuando** intento eliminarla, **entonces** el sistema lo impide e indica que primero deben eliminarse o reasignarse los factores.
- **Dado** que existen dimensiones, **entonces** se listan ordenadas por el campo "orden" de menor a mayor y puedo consultar el detalle de cada una.

---

### HU-16 · Gestionar factores — Urgente · 5 SP
**Como** administrador, **quiero** gestionar los factores de cada dimensión, **para** definir los aspectos que se evalúan.

- **Dado** que creo un factor, **entonces** debo vincularlo a una dimensión existente e indicar nombre, total de citas en literatura e importancia del experto; todos obligatorios.
- **Dado** que el factor tiene subfactores asociados o está referenciado en evaluaciones existentes, **cuando** intento eliminarlo, **entonces** el sistema lo impide e indica el motivo.
- **Dado** que edito los datos de un factor (nombre, importancia, citas), **entonces** las evaluaciones en estado Completada conservan los valores con los que fueron calculadas originalmente y no se recalculan.

---

### HU-17 · Gestionar subfactores — Urgente · 3 SP
**Como** administrador, **quiero** gestionar los subfactores de cada factor, **para** establecer criterios específicos de evaluación.

- **Dado** que creo un subfactor, **entonces** debo asociarlo a un factor existente e indicar nombre y descripción; el nombre debe ser único.
- **Dado** que el subfactor tiene valoraciones registradas en alguna evaluación, **cuando** intento eliminarlo, **entonces** el sistema lo impide para preservar la integridad de las evaluaciones existentes.
- **Dado** que existen subfactores, **entonces** puedo listarlos filtrados por factor para facilitar la navegación.

---

## 4. Gestión de evaluaciones

---

### HU-18 · Configurar datos de la organización — Urgente · 2 SP
**Como** usuario registrado, **quiero** ingresar y mantener los datos de mi organización, **para** que queden asociados a todas mis evaluaciones.

- **Dado** que completo mi registro o inicio sesión por primera vez y aún no tengo organización configurada, **entonces** el sistema me redirige a un formulario para ingresar la razón social de mi organización (obligatoria) y opcionalmente descripción, correo de contacto y dirección, antes de poder acceder al resto del sistema.
- **Dado** que ya configuré mi organización, **cuando** accedo a la sección "Mi organización" desde la configuración de mi cuenta, **entonces** veo los datos actuales y puedo editarlos.
- **Dado** que edito la razón social y ya existe otra organización con ese nombre (sin distinguir mayúsculas ni espacios sobrantes), **cuando** guardo, **entonces** se rechaza con un mensaje claro.
- **Dado** que guardo los cambios correctamente, **entonces** los datos actualizados se reflejan en las nuevas evaluaciones; las evaluaciones en estado Completada conservan los datos con los que fueron generadas.

---

### HU-19 · Registrar datos del software en la evaluación — Urgente · 2 SP
**Como** evaluador, **quiero** ingresar los datos del software directamente al crear una evaluación, **para** identificar exactamente qué producto se está evaluando sin requerir un catálogo previo.

- **Dado** que creo una evaluación, **entonces** el formulario incluye campos para ingresar el nombre del software, su versión y una descripción breve; nombre y versión son obligatorios.
- **Dado** que ingreso los datos del software y guardo la evaluación, **entonces** esos datos quedan vinculados exclusivamente a esa evaluación; no se administran en un catálogo externo independiente.
- **Dado** que la evaluación pasa a estado "Completada", **entonces** los datos del software registrados en esa evaluación no pueden modificarse para preservar la integridad del resultado.

---

### HU-20 · Crear evaluación — Urgente · 3 SP
**Como** evaluador, **quiero** crear una evaluación indicando su nombre y los datos del software a evaluar, **para** iniciar el proceso de evaluación.

- **Dado** que creo una evaluación, **entonces** el formulario solicita: nombre de la evaluación, nombre del software, versión del software y descripción del software; todos son obligatorios excepto la descripción.
- **Dado** que ya tengo una evaluación con ese mismo nombre, **cuando** guardo, **entonces** se rechaza indicando que el nombre de la evaluación debe ser único por evaluador.
- **Dado** que la creación es exitosa, **entonces** la evaluación queda automáticamente vinculada a mi organización (configurada previamente en HU-18), asociada a mí como evaluador responsable, en estado "Pendiente" y con la fecha de creación registrada automáticamente.
- **Dado** que existe una evaluación (en cualquier estado), **entonces** no existe ninguna opción de interfaz ni endpoint de API para eliminarla.

---

### HU-21 · Iniciar o continuar una evaluación — Urgente · 3 SP
**Como** evaluador, **quiero** iniciar o continuar mi evaluación, **para** registrar las valoraciones.

- **Dado** que mi evaluación está en estado "Pendiente", **cuando** selecciono "Iniciar evaluación", **entonces** el estado cambia a "En proceso" y se registra la fecha y hora de inicio.
- **Dado** que mi evaluación está en estado "En proceso", **cuando** selecciono "Continuar", **entonces** accedo al formulario de valoración con todas las respuestas ya guardadas precargadas.
- **Dado** que mi evaluación está en estado "Completada", **entonces** la opción de continuar no aparece y solo puedo consultarla en modo de solo lectura.
- **Dado** que la evaluación pertenece a otro evaluador, **entonces** no puedo acceder a ella ni verla en mi listado.

---

### HU-22 · Calificar factores — Urgente · 8 SP
**Como** evaluador, **quiero** calificar cada factor con la importancia del decisor, la importancia relativa y su alcance, **para** determinar su relevancia en el análisis FODA.

- **Dado** que la evaluación está en estado "En proceso", **cuando** califico un factor, **entonces** debo seleccionar: la importancia del decisor (de los niveles disponibles en la escala), la importancia relativa (de la escala correspondiente) y el alcance (Interno o Externo); los tres campos son obligatorios.
- **Dado** que falta algún dato de la valoración al guardar, **entonces** se rechaza indicando cuál campo está vacío.
- **Dado** que ya califiqué un factor en esta evaluación, **cuando** vuelvo a ese factor, **entonces** el sistema muestra la valoración existente en modo edición; no se crean registros duplicados.
- **Dado** que la evaluación está en estado "Completada", **entonces** no se puede crear ni modificar ninguna valoración de factor; el sistema rechaza cualquier intento con un error de conflicto.

---

### HU-23 · Calificar subfactores — Urgente · 5 SP
**Como** evaluador, **quiero** calificar el nivel de cumplimiento de los subfactores, **para** determinar qué tan bien cumple el software cada criterio.

- **Dado** que la evaluación está en estado "En proceso", **entonces** veo los subfactores agrupados por su factor padre, con el estado de cada valoración (pendiente o ya registrada).
- **Dado** que selecciono un nivel de cumplimiento para un subfactor y guardo, **entonces** la valoración queda registrada y el subfactor se marca como calificado.
- **Dado** que ya valoré un subfactor en esta evaluación, **cuando** regreso a él, **entonces** veo la valoración existente en modo edición; no se permite crear un registro duplicado.
- **Dado** que la evaluación está en estado "Completada", **entonces** no se permite modificar ni registrar valoraciones de subfactores.

---

### HU-24 · Finalizar evaluación — Urgente · 5 SP
**Como** evaluador, **quiero** finalizar mi evaluación, **para** obtener los resultados y cerrar el proceso.

- **Dado** que faltan factores o subfactores por valorar, **cuando** selecciono "Finalizar", **entonces** el sistema lo impide y muestra la lista de los elementos pendientes.
- **Dado** que todos los factores y subfactores están valorados, **cuando** selecciono "Finalizar", **entonces** se muestra un mensaje de confirmación advirtiendo que la evaluación no podrá editarse una vez finalizada.
- **Dado** que confirmo la finalización, **entonces** la evaluación pasa a estado "Completada", se registra la fecha y hora de cierre, y se calculan automáticamente los resultados FODA y las recomendaciones iniciales.
- **Dado** que ocurre un error durante el cálculo de resultados, **entonces** la evaluación permanece en estado "En proceso", no se registra fecha de cierre y se informa el error al evaluador para que pueda reintentar.

---

### HU-25 · Proteger evaluaciones completadas — Urgente · 3 SP
**Como** evaluador, **quiero** que una evaluación finalizada no pueda alterarse, **para** garantizar la integridad de los resultados.

- **Dado** que una evaluación está en estado "Completada", **cuando** se intenta modificar sus datos generales, valoraciones de factores, valoraciones de subfactores u organización/software asociados (ya sea por interfaz o directamente por API), **entonces** el backend responde con un error de conflicto y no realiza ningún cambio.
- **Dado** que una evaluación está en estado "Completada", **entonces** la interfaz muestra todos sus datos en modo de solo lectura; no hay botones de edición.
- **Dado** que se intenta eliminar una evaluación (en cualquier estado y por cualquier rol), **entonces** el sistema responde con error; la operación de eliminación no existe.

---

### HU-26 · Obtener resultados FODA — Urgente · 13 SP
**Como** evaluador, **quiero** obtener los resultados calculados de la evaluación, **para** identificar fortalezas, debilidades, oportunidades y amenazas del software.

- **Dado** que la evaluación está en estado "Completada", **entonces** el sistema calcula la ponderación promedio de cada factor a partir de la importancia del decisor, la importancia relativa y los niveles de cumplimiento de sus subfactores, según las reglas documentadas de la metodología.
- **Dado** que cada factor tiene un alcance y una ponderación calculada, **entonces** se clasifica en uno de los cuatro cuadrantes FODA aplicando umbrales explícitos documentados: Alcance Interno + ponderación alta = Fortaleza, Alcance Interno + ponderación baja = Debilidad, Alcance Externo + ponderación alta = Oportunidad, Alcance Externo + ponderación baja = Amenaza.
- **Dado** que consulto los resultados, **entonces** se muestran agrupados por cuadrante FODA y también por dimensión de la metodología.
- **Dado** que el cálculo se ejecuta con los mismos datos de entrada, **entonces** el resultado es siempre idéntico (determinista) y el resultado queda guardado en la base de datos; no se recalcula en cada consulta.

---

### HU-27 · Recomendaciones iniciales — Urgente · 5 SP
**Como** evaluador, **quiero** ver las recomendaciones iniciales de la metodología, **para** identificar acciones de mejora.

- **Dado** que la evaluación finalizó y los resultados FODA fueron calculados, **entonces** se generan exactamente tres recomendaciones iniciales según las reglas predefinidas de la metodología (basadas en las principales debilidades, amenazas y áreas de mejora detectadas).
- **Dado** que consulto los resultados de la evaluación, **entonces** las tres recomendaciones aparecen junto a los resultados FODA y permanecen iguales sin importar cuántas veces abra la evaluación.

---

### HU-28 · Consultar detalle y estado de mis evaluaciones — Urgente · 2 SP
**Como** evaluador, **quiero** consultar el detalle y estado de una evaluación, **para** darle seguimiento.

- **Dado** que abro una de mis evaluaciones, **entonces** veo: nombre, organización evaluada, software evaluado, estado actual, fecha de creación, fecha de inicio (si aplica) y fecha de cierre (si está Completada).
- **Dado** que la evaluación está en estado "Pendiente", **entonces** veo el botón "Iniciar evaluación".
- **Dado** que está en estado "En proceso", **entonces** veo el botón "Continuar".
- **Dado** que está en estado "Completada", **entonces** no aparecen botones de acción y veo directamente los resultados FODA y las recomendaciones.

---

### HU-29 · Dashboard de evaluaciones en curso — Urgente · 3 SP
**Como** evaluador, **quiero** ver en mi dashboard mis evaluaciones Pendientes y En proceso, **para** priorizar mis actividades.

- **Dado** que ingreso al dashboard, **entonces** veo únicamente mis evaluaciones en estado "Pendiente" o "En proceso", con nombre, organización, software y estado, ordenadas por fecha de última actividad de más reciente a más antigua.
- **Dado** que selecciono una evaluación del dashboard, **entonces** accedo a su detalle (HU-28).
- **Dado** que no tengo evaluaciones en curso, **entonces** se muestra un estado vacío con un acceso directo a "Crear nueva evaluación".
- **Dado** que tengo evaluaciones en estado "Completada", **entonces** estas no aparecen en el dashboard; se consultan desde el historial (HU-32).

---

### HU-30 · Línea de progreso — Alto · 3 SP
**Como** evaluador, **quiero** ver el progreso de mi evaluación, **para** saber cuánto falta.

- **Dado** que la evaluación está en estado "En proceso", **entonces** se muestra una barra de progreso con el porcentaje calculado como: (cantidad de factores y subfactores ya valorados) ÷ (total de factores y subfactores de la evaluación) × 100.
- **Dado** que registro o actualizo una valoración, **entonces** el porcentaje de progreso se actualiza de inmediato.
- **Dado** que veo el progreso, **entonces** puedo expandirlo para ver exactamente qué factores y subfactores aún no han sido valorados.

---

### HU-31 · Consultar criterios de la clasificación FODA — Alto · 3 SP
**Como** evaluador, **quiero** ver qué valores sustentan la clasificación de cada factor, **para** entender cómo se obtuvieron los resultados.

- **Dado** que selecciono un factor en la vista de resultados, **entonces** veo un panel de detalle con: su importancia del decisor, importancia relativa, alcance, ponderación obtenida y los niveles de cumplimiento de sus subfactores.
- **Dado** que veo el detalle, **entonces** se muestra de forma legible la regla aplicada que explica por qué el factor quedó clasificado como Fortaleza, Debilidad, Oportunidad o Amenaza (ej. "Alcance Interno con ponderación de 3.8 sobre umbral de 3.0 → Fortaleza").

---

### HU-32 · Historial de evaluaciones — Alto · 3 SP
**Como** evaluador, **quiero** consultar mis evaluaciones completadas, **para** revisar resultados anteriores.

- **Dado** que abro el historial, **entonces** veo mis evaluaciones en estado "Completada" con nombre, organización, software y fecha de cierre, ordenadas de más reciente a más antigua.
- **Dado** que selecciono una evaluación del historial, **entonces** accedo a su detalle y resultados en modo de solo lectura.
- **Dado** que tengo muchas evaluaciones completadas, **entonces** puedo filtrar la lista por nombre, organización o rango de fechas.

---

## 5. Feedback de especialista externo

---

### HU-33 · Generar enlace para compartir — Alto · 5 SP
**Como** evaluador, **quiero** generar un enlace para compartir una evaluación, **para** obtener una revisión independiente de un especialista.

- **Dado** que la evaluación está en estado "Completada", **cuando** genero un enlace, **entonces** se crea un token único e impredecible (UUID o hash criptográfico) con una fecha de expiración configurable (ej. 7 días desde su creación).
- **Dado** que la evaluación no está en estado "Completada", **entonces** la opción de generar enlace no aparece y la API rechaza la solicitud.
- **Dado** que se generó el enlace correctamente, **entonces** puedo copiarlo al portapapeles o enviarlo por correo electrónico directamente desde el sistema.
- **Dado** que consulto mis enlaces generados, **entonces** se muestran con su estado actual: vigente, expirado o revocado.

---

### HU-34 · Revocar enlace compartido — Alto · 2 SP
**Como** evaluador, **quiero** revocar un enlace compartido, **para** cortar el acceso del especialista cuando ya no corresponda.

- **Dado** que un enlace está en estado "vigente", **cuando** selecciono "Revocar", **entonces** se muestra un mensaje de confirmación antes de proceder.
- **Dado** que confirmo la revocación, **entonces** el enlace pasa a estado "revocado" de inmediato y cualquier intento posterior de usarlo falla.
- **Dado** que un especialista intenta abrir un enlace revocado, **entonces** ve un mensaje genérico indicando que el enlace no es válido, sin revelar datos de la evaluación.
- **Dado** que revoco un enlace, **entonces** el feedback que el especialista ya envió antes de la revocación se conserva y sigue visible para el evaluador.

---

### HU-35 · Acceder a la evaluación con el enlace — Alto · 5 SP
**Como** especialista externo, **quiero** abrir la evaluación desde el enlace recibido, **para** revisarla sin necesidad de crear una cuenta.

- **Dado** que abro un enlace con un token válido (existente, no expirado y no revocado), **entonces** paso al proceso de verificación de identidad (HU-36) antes de ver cualquier dato.
- **Dado** que el token no existe, fue revocado o su fecha de expiración ya pasó, **entonces** veo un mensaje genérico de enlace no válido sin que se revelen datos de ninguna evaluación.
- **Dado** que paso la verificación y accedo a la evaluación, **entonces** veo los resultados FODA y los datos en modo de solo lectura; no hay opciones de edición ni acceso a otras evaluaciones del sistema.

---

### HU-36 · Verificación del especialista — Alto · 3 SP
**Como** especialista externo, **quiero** ingresar un código de verificación, **para** confirmar mi acceso a la evaluación compartida.

- **Dado** que abro un enlace válido, **cuando** se me solicita verificación, **entonces** ingreso mi correo electrónico y recibo un código numérico de 6 dígitos (vigente por 5 minutos, un solo uso, máximo 3 intentos).
- **Dado** que ingreso el código correcto y vigente, **entonces** accedo a la vista de la evaluación por el tiempo de duración de la sesión limitada.
- **Dado** que ingreso el código incorrecto, **entonces** se descuenta un intento y se indica cuántos me quedan.
- **Dado** que se agotan los 3 intentos o el código expira, **entonces** no se muestra ningún dato de la evaluación y debo solicitar un nuevo código para reintentar.

---

### HU-37 · Enviar comentarios y nivel de acuerdo — Alto · 5 SP
**Como** especialista externo, **quiero** comentar y expresar mi nivel de acuerdo con la clasificación FODA, **para** aportar mi criterio a la evaluación.

- **Dado** que tengo acceso a la evaluación compartida, **entonces** puedo escribir un comentario general sobre la evaluación y comentarios específicos para cada factor.
- **Dado** que reviso la clasificación de un factor, **entonces** puedo seleccionar mi nivel de acuerdo con esa clasificación de una escala definida (ej: "Totalmente de acuerdo", "Parcialmente de acuerdo", "En desacuerdo").
- **Dado** que envío el feedback (comentarios y niveles de acuerdo), **entonces** queda guardado de forma definitiva con la fecha de envío y no puede editarse posteriormente.
- **Dado** que el enlace expira o es revocado mientras redacto, **entonces** al intentar enviar el feedback se informa que el enlace ya no es válido y el feedback no se guarda.

---

### HU-38 · Consultar feedback recibido — Alto · 3 SP
**Como** evaluador, **quiero** ver el feedback enviado por los especialistas, **para** considerarlo en mis conclusiones.

- **Dado** que al menos un especialista envió feedback, **cuando** abro la sección de feedback de mi evaluación, **entonces** veo los comentarios generales y los comentarios y niveles de acuerdo por factor, con la fecha de envío y el correo del especialista.
- **Dado** que aún no se ha recibido ningún feedback, **entonces** se muestra un mensaje indicando que no hay retroalimentación de especialistas disponible.

---

### HU-39 · Notificar al evaluador del feedback — Normal · 2 SP
**Como** evaluador, **quiero** recibir una notificación cuando un especialista envíe feedback, **para** enterarme sin necesidad de revisar manualmente.

- **Dado** que un especialista completa y envía su feedback, **entonces** el sistema envía automáticamente un correo al evaluador responsable de la evaluación, indicando el nombre de la evaluación y un enlace directo para ver el feedback.

---

## 6. Recomendaciones con inteligencia artificial

---

### HU-40 · Generar recomendaciones detalladas con LLM — Alto · 13 SP
**Como** evaluador, **quiero** generar recomendaciones detalladas con un asistente de inteligencia artificial, **para** obtener un análisis contextualizado y acciones de mejora concretas.

- **Dado** que la evaluación está en estado "Completada", **cuando** solicito la recomendación ampliada, **entonces** el sistema envía al modelo de lenguaje: los resultados FODA, las tres recomendaciones iniciales, los factores y subfactores con bajo cumplimiento, las dimensiones de la metodología y el feedback de especialistas disponible.
- **Dado** que el proveedor de IA responde correctamente, **entonces** se muestra un análisis que incluye: interpretación del estado actual del software, plan de acción priorizado por impacto y urgencia, cómo aprovechar fortalezas y oportunidades, consideraciones derivadas del feedback del especialista (si existe) y métricas sugeridas para hacer seguimiento.
- **Dado** que el proveedor falla, hay un timeout o la respuesta no tiene el formato esperado, **entonces** se informa el error al evaluador, puede reintentar y no se pierde ninguna recomendación previamente generada y guardada.
- **Dado** que se envían datos al proveedor externo, **entonces** no se incluyen datos personales del evaluador ni de la organización más allá de lo necesario para el análisis técnico.
- **Dado** que el evaluador solicita generar una nueva recomendación, **entonces** el sistema aplica un límite máximo de generaciones por evaluación para controlar el consumo y los costos del servicio.

---

### HU-41 · Consultar y conservar recomendaciones — Alto · 2 SP
**Como** evaluador, **quiero** consultar y guardar las recomendaciones del asistente, **para** revisarlas en cualquier momento.

- **Dado** que existe al menos una recomendación generada por el asistente, **entonces** se muestra en un panel diferenciado junto a las tres recomendaciones iniciales de la metodología, con formato enriquecido (texto con estructura).
- **Dado** que la recomendación ampliada fue generada y guardada, **cuando** vuelvo a abrir la evaluación en otra sesión, **entonces** sigue disponible sin necesidad de regenerarla.

---

### HU-42 · Exportar reporte en PDF — Baja · 5 SP
**Como** evaluador, **quiero** exportar el reporte de la evaluación en PDF, **para** usarlo fuera del sistema o adjuntarlo a informes formales.

- **Dado** que la evaluación está en estado "Completada", **cuando** selecciono "Exportar PDF", **entonces** se descarga un archivo con: datos generales de la evaluación (nombre, organización, software, fechas), resultados FODA agrupados por cuadrante y por dimensión, las tres recomendaciones iniciales, y la recomendación ampliada del asistente si existe.
- **Dado** que no existe recomendación ampliada generada, **entonces** el PDF se genera correctamente sin esa sección, sin mostrar errores.
