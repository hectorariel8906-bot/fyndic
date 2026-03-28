# Fyndic — Finanzas de un ingeniero

App web de finanzas personales para Uruguay, con IA integrada.

## Stack
- **Frontend**: HTML/CSS/JS (sin framework, máxima simplicidad)
- **Backend**: Vercel Serverless Functions
- **Base de datos**: Supabase (PostgreSQL)
- **IA**: Anthropic Claude (procesamiento de estados de cuenta)

## Deployment en Vercel

### 1. Configurar Supabase
1. Abrí el SQL Editor en Supabase
2. Copiá y ejecutá el contenido de `supabase_schema.sql`
3. Verificá que las tablas se crearon: `profiles`, `accounts`, `categories`, `transactions`

### 2. Subir a Vercel
1. Comprimí esta carpeta en un ZIP
2. En vercel.com → Add New → Project → Upload
3. Arrastrá el ZIP

### 3. Configurar variables de entorno en Vercel
En el panel de tu proyecto en Vercel → Settings → Environment Variables, agregá:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://giqkcfmovvpungjcbkyg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (tu anon key de Supabase) |
| `ANTHROPIC_API_KEY` | (tu API key de Anthropic — sk-ant-api03-...) |

### 4. Deploy
Vercel detecta automáticamente el proyecto y hace el deploy.
Tu app estará en: `https://fyndic.vercel.app` (o similar)

## Cuentas configuradas
- Itaú Pesos HH901
- Itaú USD 9101  
- Itaú Crédito HH8015
- Oca Crédito HH5400
- BROU HZ Pesos
- BROU HZ USD

## Estructura de archivos
```
fyndic/
├── pages/
│   └── index.html      ← App principal
├── api/
│   ├── process.js      ← Procesa estados de cuenta con IA
│   └── summary.js      ← Genera resumen semanal con IA
├── lib/
│   └── supabase.js     ← Cliente de Supabase
├── supabase_schema.sql ← Crear tablas en Supabase
├── .env.local.example  ← Variables de entorno de ejemplo
└── package.json
```

## Uso
1. Registrate con tu email
2. Andá a **Importar** → elegís el banco → subís el PDF o Excel
3. La IA extrae y categoriza las transacciones automáticamente
4. Revisás y confirmás
5. Todo queda en el dashboard

## Costos estimados
- Vercel: gratis
- Supabase: gratis (hasta 500MB)
- Anthropic: ~USD 0.02 por estado de cuenta importado
