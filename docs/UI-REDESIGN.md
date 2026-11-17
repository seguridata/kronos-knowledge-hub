# Kronos · Rediseño SeguriData

## Dirección

Interfaz editorial para conocimiento empresarial: carbón `#191919`, acento
SeguriData `#84BD00`, Poppins local, superficies opacas, bordes discretos y
jerarquía consistente. La navegación orienta; documentos y acciones tienen
prioridad. El tema oscuro usa tokens explícitos en la raíz para evitar el
selector descendiente que genera PostCSS al transformar `light-dark()`.

Referencias consultadas:

- [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh): jerarquía, densidad y menor competencia visual entre navegación y contenido.
- [Linear: UI refresh, marzo de 2026](https://linear.app/changelog/2026-03-12-ui-refresh): consistencia entre cabeceras, navegación y controles.

Las skills solicitadas se revisaron para escoger movimiento apropiado al
producto. Se aplican CSS, Motion existente y SVG; las escenas Three.js y los
recorridos cinematográficos no son necesarios para navegar o editar documentos.
No se añadieron bibliotecas de animación ni servicios de generación de imágenes.

## Superficies

| Área | Cambio |
| --- | --- |
| Acceso y recuperación | Composición dividida, ilustración de marca SVG, formularios adaptables |
| Navegación | Identidad del workspace, agrupación y selección más claras, cabecera compacta |
| Inicio | Bienvenida, accesos útiles, biblioteca, tarjetas de espacios y actividad |
| Espacios | Cabecera contextual, descripción, miembros y creación con permisos existentes |
| Favoritos y actividad | Registros legibles en móvil en lugar de columnas truncadas |
| Editor | Hoja opaca, breadcrumbs y herramientas sin recortes; offsets compartidos |
| Configuración | Superficies y filas adaptables, contraseña/MFA sin columnas estrechas |
| Asistente | Estética común, sugerencias traducidas que preparan un borrador antes de enviar |
| Auditoría y compartidos | Paleta, superficies y comportamiento adaptable coherentes |

## Comportamiento y accesibilidad

- Navegación móvil con Drawer de Mantine: captura/restauración de foco, Escape
  y cierre al cambiar de ruta o de breakpoint.
- Separador lateral ajustable con teclado y atributos ARIA.
- El atajo de búsqueda de Inicio respeta inputs y regiones `contenteditable`.
- Búsqueda por teclado inmediata; feedback breve en botones y overlays.
- Entradas escalonadas limitadas; movimiento reducido y hover según dispositivo.
- Zoom móvil habilitado y colores de impresión legibles desde el tema oscuro.
- Estados de carga, error con reintento y espacios vacíos con orientación.
- Modo de enfoque existente conservado, con tolerancia a almacenamiento bloqueado.

## Carga

Las rutas y el renderizador PDF se cargan de forma diferida. Una frontera
Suspense dentro del shell conserva la navegación mientras llega una pantalla.
En las compilaciones de esta revisión, el archivo principal pasó de unos
3.47 MB a 652 KB sin comprimir. Es el tamaño del archivo principal, no de toda
la aplicación ni una medición de velocidad en una red real. Los módulos grandes
del editor/diagramas siguen disponibles y Vite todavía informa algunos chunks
de más de 500 KB.

## Verificación

- Build de producción: TypeScript + Vite.
- Suite existente: 58 pruebas aprobadas en 2 archivos.
- ESLint aislado sobre los 26 archivos TS/TSX intervenidos: sin errores ni avisos,
  usando las reglas del proyecto salvo la carga del plugin TanStack defectuoso.
- El lint general no puede arrancar: `@tanstack/eslint-plugin-query@5.94.4`
  apunta a `build/modern/index.js`, ausente tanto en la instalación como en el
  paquete consultado. No se desactivaron reglas del proyecto para ocultarlo.
- QA de navegador: 42 comprobaciones aprobadas, reproducibles en `scripts/qa-workspace-redesign.cjs`.
  Ocho rutas interiores a 320, 390, 768 y 1440px; acceso real sin sesión,
  diálogos, foco móvil a 320×500, búsqueda, persistencia de preferencia,
  sugerencias del asistente sin envío, estados vacíos, reintento tras error,
  tema oscuro, movimiento reducido e impresión.
- Capturas y resultados: `output/redesign-qa/`. La compilación revisada se
  sirve con Vite Preview para comprobar los assets finales.

Las pantallas interiores se prueban con respuestas sintéticas interceptadas
en un contexto de navegador aislado. No se escriben fixtures en la aplicación
ni se modifican cuentas reales. Estas pruebas no demuestran autenticación real,
persistencia de documentos, colaboración en vivo, proveedores IA ni exportación
PDF de extremo a extremo. El editor y sus controles recibieron comprobación
de CSS/compilación; la colaboración autenticada queda fuera de esta evidencia.

## Repetir QA

Desde la raíz, con el cliente o Vite Preview en ejecución y Playwright disponible:

```powershell
$env:KRONOS_QA_URL = 'http://127.0.0.1:3012'
node scripts/qa-workspace-redesign.cjs
```

El segundo argumento opcional indica la ruta a un módulo Playwright instalado.
El navegador predeterminado es Chrome; `KRONOS_QA_BROWSER` permite elegir otro
canal compatible. La prueba no envía mensajes ni ejecuta cambios en cuentas.

El repositorio ya tenía cambios sin confirmar antes de esta revisión. Se
preservaron; este documento describe el rediseño, no atribuye esos cambios a
esta intervención. No se publicó ni desplegó el sitio.
