# Mapa de arquitectura de Folio

- **Corte de auditoría:** 12 de octubre de 2026
- **Base revisada:** `origin/main` (`f2b88a87d7042e04d6758ea82e929b777193e634`)
- **Rama de trabajo:** `audit/pre-launch-readiness`

## Resumen

Folio publica una aplicación Next.js en Vercel y procesa las herramientas web en
el navegador del visitante. El repositorio no contiene rutas API de documentos,
Server Actions, autenticación, base de datos, analítica ni un servicio de
conversión en la nube. Vercel sirve páginas y recursos estáticos; no recibe los
bytes de los documentos seleccionados.

La conversión local evita que cada documento consuma CPU, memoria o disco del
servidor. El tráfico sí consume solicitudes CDN y transferencia por las páginas
y los recursos que descargan los visitantes. Las operaciones grandes dependen
de la memoria, el procesador y los límites del navegador de cada dispositivo.

## Componentes y flujo

```text
Navegador
  ├─ Páginas App Router: app/
  ├─ Registro público y límites: lib/tools.ts, lib/formatMatrix.ts
  ├─ Selección, validación y estado: components/ToolRunner.tsx,
  │  components/UniversalDrop.tsx
  ├─ Transformaciones locales: lib/pdfOps.ts, lib/office.ts,
  │  lib/iwork.ts, lib/signature.ts
  ├─ Parsers aislados: lib/office.worker.ts, worker de iWork,
  │  worker de PDF.js servido desde el mismo origen
  └─ Descargas Blob y limpieza de URL/buffers
          │ HTTPS: HTML, JS, CSS y recursos estáticos
          ▼
Vercel CDN / despliegue Next.js
  ├─ Páginas públicas prerenderizadas
  ├─ Recursos estáticos con nombres versionados
  └─ Sin ruta de subida ni procesamiento de documentos

Componentes nativos opcionales (macOS, repositorio separado por responsabilidad)
  ├─ apps/folio-mac: aplicación de menú que supervisa el helper
  └─ apps/macos-helper: conversión local y puente seguro de loopback
```

### Aplicación web

- `app/` usa App Router. Las páginas legales y la ruta dinámica
  `app/tools/[slug]/page.tsx` se prerenderizan; `generateStaticParams()` obtiene
  las rutas del allowlist `TOOLS`.
- `lib/tools.ts` contiene 19 herramientas web públicas, todas con
  `processing: "local"`, tipos, límites y cantidad máxima de archivos.
  `lib/formatMatrix.ts` es la matriz pública de compatibilidad. La matriz
  histórica `lib/dormantFormatMatrix.ts` no se expone en navegación ni rutas
  públicas.
- `components/ToolRunner.tsx` y `components/UniversalDrop.tsx` coordinan el
  flujo cliente. `lib/files.ts` valida tamaño/extensión/MIME, lee con
  `FileReader` como camino compatible con WebKit y serializa las lecturas.
  Los parsers validan firmas y estructura antes de producir descargas.
- `lib/pdfOps.ts` implementa operaciones PDF e imágenes; las librerías pesadas
  se importan bajo demanda. Office e iWork usan workers cuando están disponibles
  y terminan el worker al completar o fallar. DOCX → PDF renderiza páginas en
  el hilo principal porque la paginación depende del DOM y de `html2canvas`.
- Los archivos de salida se descargan desde Blob/Object URL. Los componentes
  registran y revocan URL al reiniciar o desmontar; `lib/files.ts` revoca la URL
  de descarga tras el margen de descarga del navegador.
- Los límites de entrada son límites del navegador, no del hosting: hasta
  100 MB por PDF; 200 MB combinados para combinar PDF; 25 MB por imagen y
  100 MB por lote; 50 MB por DOCX/PPTX/XLSX; 10 MB por Markdown; 150 MB para
  combinar documentos y 100 MB para Apple iWork. Las operaciones intermedias
  pueden consumir bastante más memoria que el tamaño comprimido del archivo.

### Componentes macOS

- `apps/folio-mac` es una aplicación SwiftUI de menú que inicia y supervisa
  `FolioHelper`.
- `apps/macos-helper` es un servidor local que convierte documentos mediante
  aplicaciones nativas y protege el puente de loopback con TLS/certificado por
  instalación. Sus pruebas XCTest cubren límites, autenticación/origen,
  configuración y rutas de conversión.
- La ruta pública `/mac` actualmente redirige a `/`. Los componentes de conexión
  web y las rutas de conversión nativa históricas siguen en el repositorio, pero
  no forman parte de las 19 herramientas web públicas del allowlist actual.
  La matriz y las etiquetas Beta describen la conversión Apple que sí ocurre
  localmente en el navegador.

## Framework y dependencias observados

Versiones instaladas después de aplicar el parche de seguridad de esta auditoría:

| Paquete | Versión | Uso |
| --- | --- | --- |
| Next.js | 16.3.8 | App Router, renderizado y build; sube desde 16.3.4 |
| React / React DOM | 19.1.1 | Componentes e interacción cliente |
| TypeScript | 5.9.3 | Tipado estático |
| Tailwind CSS | 3.4.19 | CSS de la interfaz |
| `pdf-lib` | 1.17.1 | Leer y escribir PDF |
| `pdfjs-dist` | 4.10.38 | Renderizado y extracción de PDF |
| `mammoth` | 1.12.2 | Lectura local de DOCX |
| `html2canvas` | 1.4.1 | Rasterización de páginas DOCX |
| `jspdf` | 4.2.1 | Escritura PDF para renderizadores locales |
| `jszip` | 3.10.2 | Contenedores OOXML y ZIP de descargas |
| `@file-viewer/renderer-iwork` | 3.0.3 | Parser acotado de contenedores Apple en worker |
| DOMPurify | 3.4.17 | Sanitización transitiva; override de seguridad frente a la versión exacta 3.4.15 del renderer |

Next.js 16.4.0 se publicó el 6 de octubre de 2026. Esta rama mantiene 16.3.8,
la línea menor sometida a la matriz completa de esta auditoría. Next.js anunció
un parche de seguridad fuera de banda para el 14 de octubre; revisar el aviso
publicado y confirmar el parche vigente antes de desplegar.

Vitest 5 y Playwright 1.63 cubren las pruebas web. Vitest 5 requiere Node.js >=22.12; el campo `engines` y ambos workflows CI declaran Node 22. XCTest cubre el helper.
Los paquetes Swift no declaran dependencias externas en sus manifiestos.
Los parches compatibles de esta rama actualizan `sharp` y `source-map-js` en el
lockfile y fuerzan DOMPurify 3.4.17 frente a la versión exacta vulnerable que
pinaba el renderer de iWork; no añaden dependencias directas.

## Red, datos y privacidad

- No hay `app/api/**`, Server Actions, cliente de base de datos, SDK de
  analítica, pixel publicitario, fuente remota ni CDN de librerías en la web.
- No se envían documentos al servidor Folio. El código del helper conserva una
  ruta de loopback a `127.0.0.1` para la integración nativa histórica; la
  navegación pública actual no la invoca.
- El sitio usa variables `NEXT_PUBLIC_*` para configuración pública (URL,
  etiqueta/contacto del propietario, fecha de políticas y repositorio). No hay
  credenciales requeridas en `.env.example`. El patrón de secretos no encontró
  claves conocidas en los archivos rastreados.
- La afirmación de procesamiento local coincide con el flujo web revisado. El
  proveedor sí recibe solicitudes ordinarias de página/recurso y puede registrar
  metadatos técnicos como IP, ruta y hora; la política de privacidad lo reconoce.

## Despliegue y caché

- `package.json` define `npm run build` como copia del worker local de PDF.js y
  `next build`. El worker generado está ignorado por Git y no debe confirmarse.
- No hay `vercel.json`, middleware/proxy ni configuración de dominio/plan de
  Vercel en el árbol rastreado. `.env.example` apunta a
  `https://foliotools.vercel.app`.
- Una inspección de solo lectura a la fecha de corte confirmó que ese dominio
  sirve desde Vercel. `/`, páginas legales y herramientas devolvieron 200;
  el sitio marcó las páginas como prerenderizadas y varias respuestas como
  `x-vercel-cache: HIT`. `robots.txt` y `sitemap.xml` respondieron 200; una URL
  desconocida devolvió 404. Esto no confirma el plan, gasto, dominio conectado
  adicional, alertas ni configuración privada del proyecto.
- Next/Vercel sirven JS y CSS versionados desde CDN. La respuesta HTML es
  revalidable; no se cachean documentos del usuario porque no hay endpoint ni
  respuestas con documentos.
- La página principal observada fue de 81,379 bytes descomprimidos en la
  respuesta capturada; una ruta de herramienta fue de unos 23 KB. Son tamaños
  de HTML, no transferencia completa de una visita ni métricas Core Web Vitals.

## Cabeceras de seguridad observadas

`next.config.mjs` aplica cabeceras a todas las rutas. Una respuesta de
producción comprobó `Content-Security-Policy`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy`, `X-Frame-Options: SAMEORIGIN` y HSTS de dos años con
`includeSubDomains; preload`. La CSP permite `unsafe-inline` para scripts y
estilos, por lo que ofrece defensa en profundidad pero no es una política de
nonce estricta. No hay una necesidad observada de permitir framing de terceros.

## Workflows de GitHub Actions

- `.github/workflows/ci.yml`: Node 22, typecheck, ESLint, Vitest y build web;
  además compila/prueba helper y compila FolioMac en `macos-latest`.
- `.github/workflows/browser-matrix.yml`: Chromium, Firefox y WebKit en PR a
  `main` o ejecución manual.
- `.github/workflows/opencode.yml`: automatización por comentario con
  `OPENCODE_API_KEY` y permisos de escritura. Esta rama restringe el evento a
  propietario, miembro o colaborador y fija la acción a un SHA publicado por
  el propio repositorio OpenCode; no queda en `@latest` flotante.
- El archivo `Scheduled Folio v0.2 Merge` no tiene extensión `.yml`/`.yaml`, por
  lo que GitHub Actions no lo reconoce como workflow.
- Los checks existentes de CI y Browser Matrix para el commit base del release
  `f2619f77bee9dfe2d1f229720250fd129175b486` constaban como `success`. Los
  checks de esta rama dependen de abrir la PR.

## Fuentes de infraestructura

- [Límites actuales de Vercel](https://vercel.com/docs/limits)
- [Precios y uso de la CDN](https://vercel.com/docs/manage-cdn-usage)
- [Caché de recursos estáticos](https://vercel.com/docs/caching/cdn-cache)
- [Mitigación DDoS de Vercel](https://vercel.com/docs/vercel-firewall/ddos-mitigation)
- [Instant Rollback de Vercel](https://vercel.com/docs/instant-rollback)
- [Versión Next.js 16.4](https://nextjs.org/blog/next-16-4)
- [Aviso de seguridad Next.js del 14 de octubre](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026)
- [Avisos de seguridad de Next.js](https://github.com/vercel/next.js/security/advisories)

El plan y los ajustes del dashboard de Vercel no son visibles desde este
repositorio. El informe final distingue los límites publicados de la cuenta
real, que no se pudo inspeccionar.
