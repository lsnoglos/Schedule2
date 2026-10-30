# Schedule2 · Gestor de horarios académicos UCC

Aplicación web en **Google Apps Script + Google Sheets** para planificar períodos académicos con varias carreras y coordinaciones, generación incremental, clases compartidas y protección contra conflictos globales. Reemplaza la arquitectura de almacenamiento local del proyecto anterior [Schedule](https://github.com/lsnoglos/Schedule).

> **Estado:** implementación inicial para piloto institucional. Código y pruebas unitarias revisados; **aún es necesario instalar el proyecto, desplegarlo y realizar pruebas de integración en Google Workspace** antes de utilizarlo como sistema oficial.

## ¿Cómo funciona?

1. El archivo **Schedule2_CONFIG** es la fuente única de datos maestros (carreras, coordinadores, docentes, áreas, espacios, turnos, grupos, ofertas, combinaciones).
2. Cada período tiene un **libro de Google Sheets propio**, por ejemplo **2026_IIICuatrimestre**, con una tabla canónica **Asignaciones**.
3. Dentro del libro del período se generan **vistas por carrera**; no son tablas editables independientes. Una misma asignación compartida se refleja en todas las carreras participantes.
4. Los coordinadores entran a la **misma URL** de la aplicación; se identifican por correo Google Workspace y reciben permisos basados en las filas **Usuarios** y **UsuarioCarreras**.
5. Toda escritura se autoriza y valida nuevamente en el **servidor**, dentro de **LockService.getScriptLock()**; no se confía en las restricciones visuales.
6. La generación automática **solo agrega sesiones pendientes**. No borra otras clases, incluso si fueron creadas por el mismo coordinador.

## Estructura del proyecto

- apps-script/Code.gs: inicialización de libros, catálogos, API, permisos, proyección de vistas y auditoría.
- apps-script/Scheduler.gs: comprobaciones de cupos, aulas, docentes, disponibilidad, descansos, solapamientos y generación incremental.
- apps-script/Quality.gs: auditoría de integridad de claves, referencias, combinaciones y asignaciones existentes.
- apps-script/Tests.gs: pruebas reproducibles de reglas críticas.
- apps-script/Index.html: interfaz adaptable a computadora y teléfono.
- apps-script/appsscript.json: manifiesto de OAuth, zona horaria y despliegue.

## Instalación por primera vez

### A. Requisito de identidad (obligatorio)

Esta versión está diseñada para usuarios de un **mismo Google Workspace institucional** en el que **Session.getActiveUser().getEmail()** devuelva el correo real de cada persona con una web app ejecutada por el propietario. **No se admite una identidad ausente, un correo enviado desde el navegador ni un login por contraseña casera.**

- Recomendado: publicar para **usuarios del dominio** y **ejecutar como quien implementa el script (propietario/administrador)**.
- Esto mantiene las hojas bajo la cuenta del propietario, sin necesidad de conceder permisos de edición directa a cada coordinador.
- La disponibilidad del correo depende de las reglas del dominio. **Verifique expresamente con dos cuentas distintas** antes de operar. Si el correo no es verificable, la aplicación bloquea el acceso.
- Si los coordinadores utilizan Gmail personales o varios dominios, **no publique el sistema aún**: requiere una capa adicional de autenticación con tokens de identidad verificados en servidor (Google Identity Services u otro proveedor).
- No compartir los archivos de Sheets como editor con coordinadores: si alguien edita directamente Sheets, los permisos de esta aplicación NO podrían detenerlo.

Documentación oficial: https://developers.google.com/apps-script/reference/base/session y https://developers.google.com/apps-script/guides/web

### B. Crear proyecto en Apps Script

**Método visual:**

1. Abra https://script.google.com y cree un proyecto independiente llamado Schedule2.
2. Añada los archivos de apps-script/ con sus mismos nombres (Code, Scheduler, Quality, Tests y una página HTML Index).
3. En configuración del proyecto active la visualización del manifiesto appsscript.json y copie su contenido del repositorio.
4. Seleccione la función **inicializarSistema**, ejecútela como propietario y acepte los permisos necesarios.
5. En **Registros de ejecución** aparecerá el enlace del libro **Schedule2_CONFIG**. El ID queda guardado en **Script Properties** bajo **MASTER_ID**.
6. Abra el libro maestro y complete los catálogos siguiendo las cabeceras existentes.
7. Configure el primer período desde la sección administrativa de la aplicación web, o ejecute la función **crearPeriodo(id, nombre, inicio, fin)** desde otra función auxiliar.
8. Ejecute **ejecutarPruebas()** para verificar las reglas principales (debe devolver todas las pruebas con OK).
9. En **Implementar > Nueva implementación > Aplicación web**, seleccione **Ejecutar como yo** y **Usuarios del dominio**. Publique y comparta **solo la URL** con los coordinadores autorizados.
10. Ingrese con dos cuentas de prueba, pruebe los permisos cruzados y simule antes de generar.

**Método con clasp (opcional):**

1. Instale @google/clasp y habilite la API Apps Script.
2. Cree un proyecto en https://script.google.com y copie su **Script ID**.
3. En la carpeta raíz de este repositorio cree localmente el archivo **.clasp.json** con las claves **scriptId** (el ID real) y **rootDir** igual a **apps-script**.
4. Ejecute **clasp login** y luego **clasp push**. Nunca suba credenciales OAuth o tokens a GitHub.
5. Continúe con la inicialización y el despliegue anteriores.

Documentación: https://developers.google.com/apps-script/guides/clasp

## Tablas del libro maestro

Los encabezados se crean automáticamente mediante **inicializarSistema()**. No cambie nombres de tablas ni columnas.

| Hoja | Columnas | Función |
|---|---|---|
| Coordinaciones | coordinacion_id, nombre, activa | Áreas responsables |
| Carreras | carrera_id, nombre, coordinacion_id, activa | Cada carrera pertenece a una coordinación |
| Usuarios | correo, nombre, rol, activo | Roles ADMIN / COORDINADOR / LECTOR |
| UsuarioCarreras | correo, carrera_id, activo | Un usuario puede gestionar varias carreras |
| Areas | area_id, nombre, activa | Áreas de conocimiento |
| Docentes | docente_id, nombre, correo, activo | Catálogo docente |
| DocenteAreas | docente_id, area_id | Áreas que cada docente puede impartir |
| Asignaturas | asignatura_id, nombre, area_id, nivel, compartible, activa | Asignaturas del plan |
| Grupos | grupo_id, carrera_id, nombre, nivel, turno_id, matricula, activo | Grupos académicos y cupos |
| Aulas | aula_id, nombre, tipo, ubicacion, capacidad, activa | Espacios físicos |
| Turnos | turno_id, nombre, entrada, salida, receso_inicio, receso_fin, almuerzo_inicio, almuerzo_fin, max_bloques_dia, activo | Reglas por modalidad |
| Bloques | bloque_id, turno_id, dia, inicio, fin, orden, activo | Bloques reales por día |
| Periodos | periodo_id, nombre, archivo_id, estado, inicio, fin | Cada período y su archivo |
| Ofertas | oferta_id, periodo_id, carrera_id, grupo_id, asignatura_id, turno_id, sesiones_semana, bloques_sesion, docente_id, tipo_espacio, matricula, combinacion_id, activa | Carga académica del período |
| Combinaciones | combinacion_id, periodo_id, oferta_ids, activa | Ofertas permitidas para impartición conjunta |
| Disponibilidad | docente_id, dia, inicio, fin, disponible | Ventanas SI/NO de profesores |
| Auditoria | fecha, correo, accion, periodo_id, registro_id, detalle | Movimientos automáticos |

**Convenciones:**

- Claves estables como **CAR-SIS**, **DOC-01**, **AR-HIST**, **AS-HIST**, **GR-SIS-I**, **AUL-B201**, **OF-HIST-SIS**.
- Valores de activación: **SI** / **NO**. Dejar en blanco no significa activo.
- Tipos de espacios: **AULA**, **LAB**, **TALLER**, **AUDITORIO**, o cualquier código propio usado consistentemente en Aulas y Ofertas.
- Horas en formato **24 h, HH:MM** (por ejemplo 08:00, 12:30, 15:40).
- **sesiones_semana** = número de reuniones por semana; **bloques_sesion** = bloques consecutivos de cada reunión. No confundir créditos con minutos.
- **matricula** en Ofertas puede sobreescribir la de Grupos; si está vacía, se utiliza la de Grupos.
- Periodos.estado = **ABIERTO** para permitir cambios o **CERRADO** para lectura.
- Combinaciones.oferta_ids es una lista de IDs separada por el carácter vertical **|**.
- Si no define Disponibilidad con filas SI para un docente/día, se considera disponible salvo intervalos explícitos NO; si define una o varias filas SI, la clase deberá estar completamente dentro de una ventana SI y fuera de cualquier ventana NO.
- No borre ni cambie un **identificador** utilizado por registros existentes.

## Ejemplo de clase compartida

Considere Historia de Nicaragua impartida a Ingeniería de Sistemas (22 estudiantes) y Derecho (18 estudiantes).

1. Cree **una sola asignatura** AS-HIST en Asignaturas y marque compartible=SI.
2. Cree dos grupos: **GR-SIS-I** y **GR-DER-I**, cada uno vinculado a su carrera.
3. Cree una Oferta para cada grupo, ambas con asignatura=AS-HIST, turno=DIURNO, sesiones_semana=2 y bloques_sesion=2.
4. En ambas Ofertas establezca combinacion_id=COM-HIST-1.
5. En Combinaciones agregue una fila para ese período con oferta_ids=OF-HIST-SIS|OF-HIST-DER y activa=SI.
6. La asignación compartida tendrá **40 estudiantes**, una sola aula de al menos 40 plazas, un único docente y un único rango horario.
7. Solo un **ADMIN** o un coordinador autorizado para **ambas carreras** puede crear, cambiar o eliminar esta asignación. El resto verá sus datos sin capacidad de alterarlos.

**Advertencia:** un grupo de 55 estudiantes no cabe en una sala de 30, aunque la sesión sea más larga. El sistema nunca descuenta alumnos por aumentar duración. Utilice un espacio mayor o cree formalmente **dos subgrupos distintos y dos ofertas** con profesores/aulas adecuados.

## Reglas de validación

Una sesión nueva o editada se bloquea si ocurre alguna de estas condiciones:

- Carrera no autorizada o período cerrado.
- Asignatura, grupo, aula, docente o turno inexistente/inactivo.
- Docente sin el área de conocimiento requerida.
- Aula de tipo incorrecto o de capacidad menor a la matrícula total.
- Hora fuera de entrada/salida, receso o almuerzo del turno.
- Bloques no consecutivos, incompletos o con pausas entre bloques mayores de 30 minutos.
- Otro grupo, docente o aula ya ocupa ese intervalo, **incluso si pertenece a otra carrera o turno**.
- Profesor fuera de sus ventanas de disponibilidad.
- Se superan las sesiones semanales de una oferta o máximo de bloques por grupo/día.
- La combinación no está expresamente habilitada.
- Otro usuario guardó una versión más reciente de la asignación (control de versión).

Se utiliza **LockService** para serializar escrituras simultáneas. La generación ordena unidades por matrícula y carga, evalúa candidatos y prioriza distribución de carga por día y docente. **Es un algoritmo heurístico**, no un optimizador matemático que garantice solución global óptima; si no encuentra espacio, informa las razones y permite intervención manual.

## Operación cotidiana

**Administrador:** crea períodos, administra los catálogos y autoriza combinaciones entre carreras, coordina resolución de conflictos, y utiliza Diagnóstico. Puede trabajar con todas las carreras.

**Coordinador:** ingresa con su cuenta, escoge una de sus carreras, revisa la oferta del período, simula el horario, guarda únicamente sesiones pendientes y después ajusta una clase (aula, día, bloque o profesor). Toda edición se vuelve a validar. Puede consultar otras carreras, pero no cambiar sus sesiones.

**Lector:** visualiza horarios sin crear, regenerar ni modificar.

Las hojas por carrera se reconstruyen cuando se guarda o elimina una asignación. **Nunca edite directamente esas vistas**: las modificaciones se perderán al sincronizar.

## Pruebas y diagnóstico

- **ejecutarPruebas()** verifica permisos, capacidad, receso/almuerzo, conflictos globales, disponibilidad, combinaciones y comportamiento no destructivo de la generación.
- **Diagnóstico de integridad** (pestaña Recursos y reglas) revisa referencias, identificadores, combinaciones y conflictos de asignaciones almacenadas.
- Antes del piloto: verificar con dos cuentas de coordinadores, dos carreras, una combinación compartida y dos solicitudes simultáneas sobre la misma aula.
- El resultado de las pruebas unitarias de lógica no equivale a una prueba integral del despliegue; la identidad real, Apps Script, Google Sheets, permisos y límites de ejecución deben probarse en el entorno institucional.

## Límites y próximas mejoras

- El algoritmo produce una solución factible de tipo voraz: no hay retroceso global ni optimización matemática.
- La división automática de estudiantes en secciones no está habilitada; debe definirse en los catálogos con subgrupos reales, aula y carga docente.
- No hay gestión de fechas extraordinarias, feriados, semanas alternas, docencia híbrida o múltiples sedes con desplazamientos en esta versión.
- Para grandes volúmenes, los límites de tiempo/cuota de Apps Script y la reconstrucción de vistas pueden requerir procesamiento incremental y almacenamiento especializado.
- El sistema **no sustituye la protección de los archivos de Sheets**. Debe operar con permisos de acceso adecuados y un administrador custodio.
- Los libros se crean en la unidad del propietario. La asignación a carpetas compartidas y las copias de seguridad programadas son una mejora posterior.

## Fuente de verdad

**Catálogos:** Schedule2_CONFIG (una sola instancia, ID en Script Properties).

**Programación:** un libro por período, por ejemplo 2026_IIICuatrimestre, con hoja **Asignaciones** como tabla única. Las hojas por carrera son **proyecciones sincronizadas**, de modo que una misma clase compartida conserva hora, docente, aula e identidad en todas sus carreras.

**Repositorio de código:** https://github.com/lsnoglos/Schedule2
