# Informe final de preparación de Folio para el lanzamiento

- **Fecha de corte:** 12 de octubre de 2026
- **Rama auditada:** `audit/pre-launch-readiness`
- **Base:** `origin/main` en `f2b88a87d7042e04d6758ea82e929b777193e634`
- **Producción observada:** `https://foliotools.vercel.app`

## 1. Executive Summary

### Decisión: CONDITIONAL GO

La versión de esta rama tiene cobertura funcional amplia en 19 herramientas web,
procesa los documentos de prueba dentro del navegador y no muestra un endpoint
de subida de documentos. Pasaron lint, TypeScript, pruebas unitarias, builds de
ambos paquetes Swift y comprobaciones E2E en Chromium, Firefox y WebKit. La
revisión también encontró y corrigió una vulnerabilidad transitiva de DOMPurify,
una actualización compatible de Next.js y dos defectos visibles de
accesibilidad; se añadió cobertura para evitar que regresen.

No recomiendo publicar hasta completar estos controles concretos:

1. Revisar la actualización de seguridad de Next.js anunciada para el 14 de
   octubre de 2026 y aplicar el parche recomendado antes del despliegue. En la
   fecha de corte, Next.js 16.4.0 ya es la versión más reciente, mientras esta
   rama conserva 16.3.8, que fue la línea probada durante la auditoría.
2. Confirmar en el dashboard el plan y la elegibilidad comercial de Vercel,
   además de cuotas, alertas de uso/gasto y dominio de producción. El plan real
   no es visible desde Git.
3. Revisar y registrar el hallazgo moderado del árbol de dependencias de
   Mammoth. La inspección encontró que afecta a la CLI de Mammoth, no al import
   de navegador usado por la aplicación; el bundle estático no contiene
   `argparse` ni `sprintf-js`.
4. Revisar la memoria de DOCX grandes en equipos modestos. Un informe histórico
   del proyecto midió aproximadamente 633 MB de heap en un perfil de tres
   documentos; esta auditoría no repitió ese perfil en dispositivos físicos.
5. Esperar los checks remotos de GitHub para el commit de la PR y desplegar
   únicamente el commit revisado.

La rama no se ha desplegado y las pruebas de carga se limitan a un servidor
local controlado. La página pública observada antes de estos cambios no se debe
considerar equivalente al commit de esta rama.

## 2. Functional Readiness

La suite E2E genera sus propios PDF, DOCX, PPTX, XLSX y contenedores iWork;
comprueba descargas y vuelve a abrir los resultados con parsers. Las 19 rutas
públicas responden 200 en la matriz. La suite también comprueba selección,
errores, estado vacío, reintentos y arrastre en los flujos donde se especifica.

| Herramienta pública | Resultado funcional comprobado |
| --- | --- |
| Merge PDF | PDF de 2 páginas válido; orden y reintento tras arrastre comprobados. |
| Split PDF | PDF de salida válido; rangos vacíos rechazados. |
| JPG / PNG to PDF | Conversión de PNG y lote de imágenes a PDF válido. |
| Word to PDF | DOCX simple y realista, lote ordenado y PDF de varias páginas parseable. |
| Pages to Word | ZIP DOCX válido; se inspeccionó `word/document.xml` y su texto. |
| PowerPoint to PDF | Fixture PPTX exportado a PDF parseable de 2 páginas. |
| Keynote to PowerPoint | PPTX válido con presentación y dos diapositivas XML. |
| Excel to PDF | Fixture XLSX exportado a PDF parseable de 2 páginas. |
| PDF to JPG | Se validó la imagen JPG y un ZIP con dos páginas; corta antes de renderizar más de 100 páginas. |
| Sign PDF | Firma dibujada, escrita y PNG exportadas a PDF; flujo local, cambio de página y descarga comprobados. |
| Rotate PDF | PDF resultante parseable con el número de páginas esperado. |
| Compress PDF | PDF reescrito parseable; el producto informa tamaños honestamente y no promete reducción. |
| Markdown to PDF | PDF de varias páginas parseable; Markdown hostil renderizado sin ejecutar contenido activo. |
| PDF to Markdown | Texto, Unicode, listas y segunda página extraídos; PDF escaneado falla de forma controlada porque no hay OCR. |
| Combine documents to PDF | PDF mixto de PDF, imagen, DOCX y Markdown; orden, duplicados y lote de 10 fuentes comprobados. |
| Pages to PDF | PDF generado, abierto por parser y vuelto a generar tras reiniciar. |
| Keynote to PDF | PDF de 2 páginas parseable y flujo del worker local terminado. |
| Numbers to XLSX | Paquete ZIP con `xl/workbook.xml` comprobado. |
| Numbers to PDF | PDF válido y flujo de reinicio comprobados. |

El corpus incluye documentos de 1, 2 y 101 páginas, PDF textual, DOCX con
contenido más realista, entradas corruptas/vacías, extensiones falsas, MIME
incorrecto, Markdown hostil, imagen dañada, firma excesivamente grande y
fixtures Apple/Office. Los resultados se validaron estructuralmente y, en
conversiones de texto, mediante contenido extraído. Esto no prueba fidelidad
visual universal ni todas las combinaciones de funciones de los formatos.

No se probó una conversión exitosa en el límite exacto de 100 páginas ni PDF
real protegido con contraseña; tampoco archivos cercanos a los máximos de
50–200 MB, imágenes con todos los perfiles EXIF/transparencia, cada función
avanzada de Office/iWork ni todos los documentos posibles. Las
pruebas nativas históricas de Pages/Keynote/Numbers de `docs/` tienen fecha
12 de septiembre de 2026 y no se repitieron en esta auditoría. La matriz de
conversión pública y sus límites siguen siendo la especificación de soporte.

Los límites configurados principales son: PDF de hasta 100 MB, lote PDF de
200 MB, imagen de hasta 25 MB (100 MB por lote), Office de hasta 50 MB,
Markdown de hasta 10 MB y fuentes iWork de hasta 100 MB. El tamaño comprimido
no predice el pico de memoria que necesita el navegador.

En producción, el HTML anuncia el icono de Folio como SVG inline en un data URI;
`/favicon.ico` responde 404 porque no existe esa ruta convencional. Robots y
sitemap respondieron 200 y una ruta inexistente 404. La producción observada
reutilizaba metadatos sociales de inicio en páginas de herramienta; esta rama
asigna título y URL Open Graph/Twitter por ruta y la matriz E2E lo comprueba.
No se validó la vista previa dentro de las aplicaciones sociales.

## 3. Security Assessment

### Dependencias

`npm audit` con el lockfile de esta rama encontró **11 hallazgos**: 0 críticos,
6 altos y 5 moderados. `npm audit --omit=dev` encontró **3 moderados y 0 altos
o críticos**. Los resultados distinguen paquetes transitivos, no 11 fallos
independientes de la aplicación.

- DOMPurify quedó forzado a 3.4.17 mediante `overrides`, porque el renderer de
  iWork fijaba exactamente 3.4.15.
- Las altas son del árbol de desarrollo de Tailwind 3: `tailwindcss`,
  `chokidar`, `brace-expansion`, `braces`, `fast-glob`, `micromatch`. npm
  propone Tailwind 4, un cambio mayor que no se aplicó antes del lanzamiento.
- `npm audit --omit=dev` mantiene tres entradas moderadas en la dependencia
  declarada `mammoth → argparse → sprintf-js`; forman una sola cadena, no tres
  rutas independientes. El advisory de `sprintf-js` cubre especificadores de
  precisión sin límite ([GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)). La inspección de `mammoth/bin/mammoth` y su grafo de
  imports mostró que `argparse` solo se usa en el ejecutable CLI, no en la
  API/lib del navegador que Folio importa. La búsqueda del build final no
  encontró `argparse` ni `sprintf-js` en `.next/static`. No se confirmó una
  ruta explotable en la aplicación web; conservar como deuda de dependencias y
  revaluar antes de invocar la CLI o procesar documentos en servidor.
- Las otras dos moderadas están en el toolchain PostCSS de desarrollo.

Se actualizó Next.js de 16.3.4 a 16.3.8 y se regeneró el lockfile. Next.js 16.4.0
se publicó el 6 de octubre; el proyecto conserva la línea menor que se probó
en esta auditoría. El equipo anunció un parche de seguridad fuera de banda para
el 14 de octubre; hay que revisar el aviso publicado y aplicar la versión
recomendada antes del lanzamiento. [Next.js 16.4](https://nextjs.org/blog/next-16-4),
[aviso del 14 de octubre](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026)

### Archivos, privacidad y superficie de red

El análisis del código encontró 19 herramientas con `processing: "local"`,
workers locales para Office/iWork y ninguna ruta `app/api/**`, Server Action,
autenticación o almacenamiento de documentos. Las pruebas de red del flujo de
firma, Markdown, combinación y conversión Apple no vieron llamadas externas,
subidas, métodos distintos de GET ni peticiones API con documentos. Esto
coincide con el texto de privacidad para el sitio auditado. El proveedor sí
recibe peticiones normales de páginas y recursos y puede registrar metadatos
técnicos de tráfico.

La inspección de entradas cubrió extensión/MIME falsos, archivos vacíos o
corruptos, archivos hostiles de prueba, límite de páginas y rechazo de SVG como
firma. El código valida tamaño y firma/estructura antes de convertir; el
contenido Markdown se sanitiza y los parsers de Office/iWork usan workers. No
se ejecutaron fuzzers ni una campaña adversarial de archivos reales.

La búsqueda de patrones de secretos en archivos rastreados no encontró claves
conocidas; `.env.example` solo documenta configuración pública. No se buscaron
ni modificaron credenciales privadas del dashboard.

### Cabeceras y automatización

Una respuesta de producción observada incluía CSP, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy`, `X-Frame-Options: SAMEORIGIN` y HSTS de dos años con
`includeSubDomains; preload`. La CSP permite `unsafe-inline`, por lo que no es
una política estricta con nonce. Vercel anuncia mitigación DDoS activa por
defecto; no se verificó la configuración del proyecto ni se generó tráfico de
ataque. [Mitigación DDoS de Vercel](https://vercel.com/docs/vercel-firewall/ddos-mitigation)

El workflow OpenCode ahora admite comandos de comentario solo de OWNER, MEMBER
o COLLABORATOR y fija la acción de terceros a un SHA. Conserva permisos de
escritura y un secreto de API en CI, por lo que se recomienda mantener la lista
de colaboradores de confianza y revisar el comportamiento tras cada cambio.

## 4. Performance Assessment

### Mediciones locales

Las lecturas de laboratorio se hicieron con un build de producción local y
Playwright Chromium en este Mac. Son muestras únicas de rutas representativas,
no datos reales de usuarios ni percentiles p75.

| Ruta / viewport | TTFB | FCP / LCP | CLS | Solicitudes | Transferencia capturada |
| --- | ---: | ---: | ---: | ---: | ---: |
| Inicio, escritorio | 10 ms | 108 / 108 ms | 0 | 16 | 197.3 KB |
| Merge PDF | 3 ms | 36 / 36 ms | 0 | 27 | 215.8 KB |
| Sign PDF | 2 ms | 36 / 36 ms | 0 | 27 | 215.9 KB |
| Privacidad | 2 ms | 32 / 32 ms | 0 | 16 | 192.3 KB |
| Sign PDF, viewport 390 × 844 | 2 ms | 32 / 32 ms | 0 | 27 | 215.9 KB |

La columna FCP / LCP muestra dos valores en milisegundos; TTFB y transferencia
son entradas de Resource Timing del mismo navegador.

El directorio completo `.next/static` ocupa 16 MB en disco; incluye recursos
compartidos y de todas las rutas, no el payload de una visita. No se ejecutó
Bundle Analyzer ni se midió el tamaño de cada chunk por herramienta. No se
obtuvo una muestra fiable de INP con el observador local y no hay RUM ni datos
CrUX configurados. Los límites p75 de LCP/INP/CLS/TTFB no se pueden certificar
con estas mediciones. Tampoco se repitió un perfil de heap completo en esta
ejecución. El build separa las librerías pesadas mediante imports dinámicos y
los tests verifican liberación de Object URLs y terminación del worker iWork
en rutas cubiertas.

Un recorrido frío conservador, sumando muestras independientes de inicio y
Merge PDF, equivale a 43 solicitudes de recurso y unos 413.2 KB medidos. Es una
base de modelo: caché del navegador, región, transferencia de cabeceras y
páginas adicionales cambian el resultado.

### Accesibilidad y UX

axe-core se ejecutó contra WCAG 2.0/2.1/2.2 A y AA en inicio, Merge PDF, Sign
PDF y Privacidad; Sign PDF también se revisó a 390 px. Antes de los cambios
encontró texto `ink-400` con contraste 2.93–3.06:1 y una diferencia entre el
nombre accesible del dropzone y su texto visible. La rama ajusta el token a
`#5f7082` y alinea la etiqueta accesible con el texto y formatos visibles.
Se añadió una aserción E2E para el nombre del control. El escaneo posterior
arrojó **cero violaciones** en los cinco estados inspeccionados. No se hizo una
auditoría manual completa con lector de pantalla.

## 5. Scalability Assessment

Las conversiones ocurren en el dispositivo del visitante; no escalan como CPU
o memoria de una función del servidor. El CDN sí sirve HTML, JavaScript, CSS y
recursos de cada visita. Por eso el riesgo cambia de capacidad de conversión
server-side a solicitudes CDN, transferencia, límite del plan y capacidad de
memoria de los clientes. Folio no tiene endpoint de documentos ni analítica
propia que añada solicitudes por usuario.

Modelo conservador: una sesión fría descarga la página inicial y abre una
herramienta, con 43 solicitudes y 413.2 KB capturados. Se multiplica por el
número de visitantes; no se modela caché. Las solicitudes y transferencia son
estimaciones del navegador local, no la capacidad medida de Vercel.

| Escenario | Visitantes / día | Solicitudes / mes modeladas | Transferencia / mes modelada |
| --- | ---: | ---: | ---: |
| A — moderado | 1.000 | 1,29 millones | 12,39 GB |
| B — viral | 10.000 | 12,9 millones | 123,95 GB |
| C — excepcional | 100.000 | 129 millones | 1.239,48 GB |

Supuestos de concurrencia y duración de sesión de 3 minutos:

| Patrón de llegada | Inicio de sesiones | Concurrencia media aproximada | Concurrencia con ráfaga ×5 |
| --- | ---: | ---: | ---: |
| A: 1.000 repartidos en 12 h | 1,39/min | 4 | 21 |
| B: 10.000 concentrados en 1 h | 167/min | 500 | 2.500 |
| C: 25.000 (25% del día) en 15 min | 1.667/min | 5.000 | 25.000 |

El modelo de solicitudes da promedios de aproximadamente 1,0, 119 y 1.194
solicitudes CDN/s en las ventanas de llegada anteriores (picos ×5 modelados de
unos 5, 597 y 5.972 solicitudes/s). No se afirma que Vercel haya sido medido a
esas tasas. El proyecto se beneficia del CDN global y de páginas
prerenderizadas, pero el plan real, la caché por región y las cuotas de cuenta
no están confirmados. No se hizo prueba de carga sobre producción.

## 6. Infrastructure Risks

La inspección de solo lectura confirmó que el dominio de producción responde
desde Vercel, páginas representativas responden 200, varias respuestas indican
`x-vercel-cache: HIT`, y robots, sitemap, redirección de rutas retiradas y 404
respondieron como se esperaba. No se obtuvo acceso al dashboard ni se pudo
confirmar plan, dominios conectados, cuota/alertas, límite de gasto, logs o
versión desplegada. No hay `vercel.json` en el repo.

La documentación actual de Vercel publica para Hobby 100 GB de Fast Data
Transfer y 1 millón de solicitudes CDN incluidos; al superar una cuota, el
uso de la medida agotada puede quedar pausado hasta el siguiente periodo.
Hobby está destinado a uso personal/no comercial. Pro incluye la capacidad
CDN base publicada de 1 millón
de solicitudes y 1 TB de transferencia; el uso adicional puede cobrarse y los
importes varían por región.
[Límites actuales](https://vercel.com/docs/limits), [plan Hobby](https://vercel.com/docs/plans/hobby),
[precios de CDN](https://vercel.com/docs/manage-cdn-usage)

En el modelo frío, A supera la cuota de solicitudes de Hobby aunque no la de
transferencia; B y C superan ambas. En Pro, A y B superan el conteo incluido;
C supera el conteo y la transferencia. A las tarifas de lista actuales de $2
por millón de solicitudes y $0,15/GB, el exceso modelado sería $0,58, $23,80 y
$291,92 para A/B/C respectivamente. El plan Pro aplica un crédito mensual de
$20 a recursos; con ese crédito, la factura ilustrativa total sería
aproximadamente $20, $23,80 y $291,92, incluidos los $20 de plataforma y
excluidos impuestos, asientos adicionales, otros recursos y variación regional.
Son proyecciones, no factura ni previsión de uso real.
[Precios CDN](https://vercel.com/docs/manage-cdn-usage), [crédito y plan Pro](https://vercel.com/docs/plans/pro-plan)
Configurar alertas y control de gasto requiere el dashboard del propietario.

### Prueba de carga segura

El script `scripts/load-review.mjs` dispara ráfagas locales de 10, 25, 50 y 100
GETs en páginas de inicio, Merge PDF y Privacidad (185 solicitudes en total),
recoge p50/p95/máximo, estados y errores. Resultado en el build local de
producción (`127.0.0.1:3002`):

| Concurrencia | Respuestas | p50 | p95 | Máximo | Errores |
| ---: | --- | ---: | ---: | ---: | ---: |
| 10 | 10 × HTTP 200 | 23,9 ms | 44,4 ms | 44,4 ms | 0 |
| 25 | 25 × HTTP 200 | 21,7 ms | 22,6 ms | 23,1 ms | 0 |
| 50 | 50 × HTTP 200 | 42,2 ms | 45,6 ms | 45,9 ms | 0 |
| 100 | 100 × HTTP 200 | 59,4 ms | 67,9 ms | 69,6 ms | 0 |

Esta es una comprobación sintética corta del servidor Next local; no es k6, una
prueba sostenida, un benchmark de CDN ni una garantía de capacidad para los
escenarios de tráfico anteriores.

### Observabilidad y recuperación

No se añadió analítica ni captura de documentos. Para el lanzamiento, usar
paneles de Vercel para despliegue, respuestas 4xx/5xx, solicitudes, transferencia
y gasto agregado. No registrar nombres, contenido ni bytes de documentos; si
se añade RUM, limitarlo a eventos técnicos agregados y documentar consentimiento
y retención.

Vercel documenta Instant Rollback a despliegues previamente servidos en
producción. En Hobby solo permite volver al deployment inmediatamente
anterior; después del rollback se desactiva la asignación automática del
dominio de producción hasta promover otro deployment. La elegibilidad y los
dominios del proyecto Folio no se pudieron comprobar. [Instant Rollback](https://vercel.com/docs/instant-rollback)

Procedimiento de recuperación propuesto: identificar en Vercel el último
deployment de producción estable; comparar commit y errores del deployment
actual; promover el deployment estable anterior mediante la acción de rollback
del dashboard; comprobar `/`, una ruta de herramienta, cabeceras y el estado de
una conversión con un fixture público; comunicar estado e impacto. No se hizo
rollback y no se verificó el permiso del equipo para ejecutar esa acción.

## 7. Compatibility Matrix

| Entorno | Evidencia de esta auditoría | Límite de la evidencia |
| --- | --- | --- |
| Chromium de Playwright 153 | Matriz E2E completa, build local y axe. | Binario Playwright en macOS; no Chrome estable de usuario. |
| Firefox de Playwright 155 | Matriz E2E completa. | No es una instalación de Firefox en Windows/Linux. |
| WebKit de Playwright 26.6 | Matriz E2E completa; se ejercitaron flujos de lectura y descargas. | No es Safari físico ni una versión iOS. |
| Viewport móvil 375 × 667, 390 × 844, 430 × 932 | Flujo de firma; viewport sin overflow y PDF exportado. | Emulación de viewport, no iPhone/Android físico ni tacto real. |
| Tablet 768 × 1024 | Universal Drop y arrastre con verificación de viewport. | Emulación, no iPad físico. |
| Escritorio macOS | Builds y tests Swift locales; pruebas de navegador. | No se repitió integración manual con Pages, Keynote o Numbers. |
| Windows, Android, iOS físicos, Edge estable y Safari estable | No probados en esta ejecución. | No afirmar compatibilidad nativa certificada. |

El workflow de CI compila y prueba el helper Swift en `macos-latest` y compila
FolioMac. Las pruebas históricas de apps Apple nativas permanecen como evidencia
del repositorio fechada en septiembre, no como validación de esta rama.

## 8. Changes Implemented

- Next.js 16.3.4 → 16.3.8 y DOMPurify transitivo 3.4.15 → 3.4.17 con override.
- CI y Browser Matrix usan Node 22, requerido por Vitest 5; `engines` declara
  Node `>=22.12.0`.
- Workflow OpenCode restringido a colaboradores de confianza y acción fijada
  a SHA.
- Metadatos Open Graph y Twitter específicos para las rutas de herramientas;
  regresión cubierta para título y URL.
- Contraste de `ink-400` elevado y nombre accesible del dropzone alineado con
  su texto visible; aserción E2E añadida.
- Informe de arquitectura y este informe final documentan flujos, riesgos,
  pruebas y limitaciones.

## 9. Remaining Issues

### Antes de publicar

- **P1 — Seguridad/framework:** revisar el boletín del 14 de octubre de Next.js
  y validar/actualizar la línea 16.3.8 o 16.4.0. Ejecutar de nuevo las pruebas
  después de cualquier cambio.
- **P1 — Hosting:** confirmar plan y elegibilidad de uso, configurar alertas de
  cuota y gasto y acordar quién observa el lanzamiento. El modelo de tráfico
  indica que incluso 1.000 sesiones frías al día excederían el millón de
  solicitudes de Hobby.
- **P1 — Memoria cliente:** revisar DOCX grandes en un Mac de memoria limitada,
  Safari e iPhone/Android físicos, con documentos de hasta el límite anunciado.
- **P2 — Dependencia transitiva:** mantener registrada la cadena moderada de
  Mammoth en npm audit. La CLI vulnerable no se usa en la web ni aparece en el
  bundle de cliente; reevaluar si se introduce procesamiento server-side.
- **P2 — Evidencia de rendimiento:** añadir medición de INP/RUM respetuosa con
  privacidad o una campaña de medición de campo después del lanzamiento; el
  laboratorio local no determina p75.
- **P2 — Accesibilidad:** extender axe/teclado/lector de pantalla a todas las
  rutas y estados, y hacer una revisión manual con VoiceOver/NVDA.
- **P2 — Superficie web:** la respuesta social de rutas de herramientas ya usa
  título/URL propios; no se encontró imagen `og:image` en el análisis descrito,
  por lo que la tarjeta puede verse sin imagen al compartir en WhatsApp,
  LinkedIn o Discord. No se probaron depuradores de tarjetas para X, TikTok,
  WhatsApp, LinkedIn o Discord ni se añadió una imagen.
- **P2 — Evidencia de ramas:** esperar los checks remotos que GitHub ejecutará
  en la PR; los éxitos del commit base no sustituyen los checks de este commit.

### No observados como bloqueantes

No se detectaron hallazgos P0, subida de archivos de Folio a un servicio,
corrupción en las salidas de los fixtures comprobados ni fallo de build. Esto no
equivale a demostrar ausencia de vulnerabilidades o fidelidad de todos los
documentos.

## 10. Launch Decision

### CONDITIONAL GO

La funcionalidad principal observada es adecuada para pasar a revisión de PR y
preparación controlada del lanzamiento, con los límites de formatos y
dispositivos descritos. La decisión depende de desplegar el commit de esta
rama después de que sus checks remotos terminen y de cerrar los gates P1 de
seguridad de Next.js, plan de Vercel y memoria en archivos grandes. El resultado
no autoriza un despliegue automático ni afirma que un pico excepcional esté
soportado.

## Apéndice — Validación ejecutada

Resultados de validación local de esta rama:

- `npm ci` — completado con Node 26.7.0 / npm 11.19.0.
- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm test` — PASS, 17 archivos y 150 pruebas.
- `npm run e2e` — PASS, 138 pruebas: 46 Chromium, 46 Firefox y 46 WebKit.
- `npm run build` — PASS; Next generó 31 páginas estáticas/prerenderizadas,
  incluidas las 19 rutas de herramientas.
- `npm run release:check` — PASS.
- `cd apps/macos-helper && swift test` — PASS, 50 pruebas.
- `swift build --package-path apps/folio-mac` — PASS.
- `npm audit` — 11 entradas (0 críticas, 6 altas de desarrollo, 5 moderadas);
  `npm audit --omit=dev` — 3 moderadas de la cadena de Mammoth descrita arriba.
- axe-core — PASS, 0 violaciones en Inicio, Merge PDF, Sign PDF y Privacidad
  en escritorio y Sign PDF a 390 × 844.
- `scripts/load-review.mjs` sobre `npm start` local — 185 solicitudes, 0 errores,
  todos los estados 200 hasta concurrencia 100; ver la tabla de arriba.

El PATH por defecto del host usó Node 20.11.1 / npm 10.2.4. Esa versión estaba
fuera de `engines` y `npm test` falló al cargar Vitest (`node:util` no exportaba
`styleText`). La suite se volvió a ejecutar completa con Node 26.7.0 y pasó; CI
se fijó a Node 22, compatible con el requisito Node `>=22.12.0`. Vitest también
mostró una advertencia de formato ESM/CJS en `vitest.config.ts`; npm informó que
`eslint@9.39.5` está deprecated. No bloquearon las comprobaciones.

Los checks de GitHub para el commit de la PR todavía están pendientes; los
resultados del commit base no se presentan como resultados de esta rama. No se
ejecutaron cargas contra producción, perfiles de heap en dispositivos físicos,
pruebas en sistemas operativos físicos ni una revisión manual completa con
lectores de pantalla.
