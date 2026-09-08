# SalesSaaS Frontend

Vue 3 + TypeScript + Vite, Tailwind CSS 4, Pinia, Vue Router 4, Axios y Lucide.

## Desarrollo

Requiere Node.js 22.12+ (ver engines de Vite) y npm.

```sh
cd SalesSaaS.Frontend
npm ci
npm run dev
```

Abrir http://localhost:5173. Copiar `.env.example` a `.env.local` para cambiar la configuración. El proxy `/api` apunta a `http://localhost:5274`, el perfil HTTP real del backend. Iniciar el backend desde la raíz con `dotnet run --launch-profile http` y su configuración habitual de SQL Server y JWT. No se incluyen credenciales.

```sh
npm run build
npm test
npm run test:e2e
npm run preview
```

Las pruebas E2E requieren Google Chrome instalado y usan respuestas HTTP simuladas: no crean usuarios ni modifican datos reales. Los screenshots quedan en `test-results/`. `npm run preview` sirve el build, pero no configura el proxy de desarrollo: para integración usar `npm run dev` o un reverse proxy que dirija `/api` al backend.

En producción servir `dist/` con fallback a `index.html` para Vue Router y un reverse proxy `/api`. Si se usa `VITE_API_BASE_URL` con otro origen, habilitar CORS explícitamente en el backend; actualmente no lo configura. Las variables `VITE_*` son públicas.

## Alcance

- Login y registro integrados; validación acorde a FluentValidation.
- JWT, usuario y tenant persistidos en localStorage; guard de rutas, Bearer automático, logout revocado en backend y limpieza local aun si la revocación falla.
- Los 401 de recursos privados terminan la sesión. Los 401 de login muestran el error; los 403 mantienen la sesión y muestran falta de permisos. Expiración comprobada al navegar y cada 15 segundos. La renovación automática no forma parte de esta entrega: al vencer el access token se solicita nuevo login.
- Sidebar adaptable/replegable, búsqueda de módulos, perfil, notificaciones con marcado de lectura y consulta de suscripción.
- Dashboard real con ocho métricas, selección de fecha UTC y ranking de productos. No hay cifras ficticias ni tendencia temporal inventada. Los totales mensuales corresponden al mes completo que contiene la fecha; el ranking siempre consulta los últimos 30 días hasta hoy. Importes presentados en ARS; el DTO no informa moneda.
- Los demás módulos muestran explícitamente su condición de próxima entrega.

## Multi-tenant

AuthResponse contiene un único TenantId y el JWT está ligado a ese tenant. No existe endpoint GET para listar membresías/tenants ni un endpoint para intercambiar tenant sin autenticarse. El botón de negocio lleva al login con TenantId opcional; el backend valida la membresía y emite el nuevo JWT. Nunca se cambia simplemente el tenant de un token vigente. Se muestra el identificador porque AuthResponse no incluye el nombre del negocio.

El selector de sucursal usa GET /api/warehouses y guarda la selección en Pinia para próximos módulos. Los depósitos son la entidad más próxima a sucursal en este backend. Analytics no admite warehouseId, por lo que el dashboard explica que sus métricas abarcan todo el negocio. Los roles Seller no consultan depósitos; solo Owner/Admin consultan analytics. La seguridad efectiva siempre corresponde al servidor.

El proyecto .NET excluye este directorio de Compile/Content/None para no incorporar node_modules ni artefactos web a su publicación.

Ver [API-MAP.md](./API-MAP.md) para los contratos revisados.

En este equipo npm no estaba en PATH. Para iniciar con el runtime temporal preparado durante la entrega:

```powershell
./dev.ps1
```

El script usa npm instalado si está disponible; la alternativa temporal depende de que no se limpie la carpeta TEMP. Para un entorno permanente, instalá Node.js con npm.
