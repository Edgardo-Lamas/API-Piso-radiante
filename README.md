# API Piso Radiante

API REST para cálculo y asesoramiento técnico de instalaciones de piso radiante (underfloor heating).

## 🎯 Características

- **Cálculo Hidráulico Automático**: Longitud de tubería, número de circuitos, y configuración óptima
- **Selección Inteligente de Paso**: Ajuste automático según carga térmica y tipo de suelo
- **Sistema de Asesoramiento Profesional**: Alertas críticas y recomendaciones técnicas
- **Validación de Entrada**: Validación robusta con mensajes de error descriptivos
- **API RESTful**: Endpoints bien documentados con respuestas JSON estandarizadas

## 📋 Requisitos

- Node.js >= 18.x
- npm >= 9.x

## 🚀 Instalación

```bash
# Clonar o navegar al directorio del proyecto
cd "/Users/edgardolamas/Desktop/Trabajos de edicion/WEBS/API Piso Radiante"

# Instalar dependencias
npm install

# Copiar archivo de configuración (opcional)
cp .env.example .env
```

## 🏃 Ejecución

### Modo Desarrollo (con hot-reload)
```bash
npm run dev
```

### Modo Producción
```bash
# Compilar TypeScript
npm run build

# Ejecutar
npm start
```

El servidor estará disponible en `http://localhost:3000`

## 📡 API Endpoints

### Health Check
```http
GET /health
```

**Respuesta:**
```json
{
  "status": "OK",
  "service": "API Piso Radiante",
  "version": "1.0.0",
  "timestamp": "2025-12-17T14:13:00.000Z"
}
```

---

### Calcular Piso Radiante
```http
POST /api/v1/underfloor/calculate
Content-Type: application/json
```

**Body:**
```json
{
  "area": 50,
  "cargaTermicaRequerida": 70,
  "tipoDeSuelo": "PETREO",
  "distanciaAlColector": 8
}
```

**Parámetros:**

| Campo | Tipo | Descripción | Rango |
|-------|------|-------------|-------|
| `area` | number | Área total a calefaccionar (m²) | 1 - 1000 |
| `cargaTermicaRequerida` | number | Potencia de calefacción requerida (W/m²) | 10 - 150 |
| `tipoDeSuelo` | string | Tipo de acabado del suelo | Ver tipos disponibles |
| `distanciaAlColector` | number | Distancia de IDA entre caldera y colector (m). Junto con la demanda de circuitos determina el diámetro de alimentación | 0 - 50 |

**Tipos de Suelo Disponibles:**
- `PETREO`: Cerámica, porcelanato, piedra (Potencia máx: 100 W/m²)
- `MADERA_MACIZA`: Madera maciza (Potencia máx: 70 W/m²)
- `MADERA_FLOTANTE`: Madera flotante (Potencia máx: 60 W/m²)
- `MOQUETA`: Moqueta, alfombra (Potencia máx: 60 W/m²)

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "pasoSeleccionado": 15,
    "densidadTuberia": 6.7,
    "longitudSerpentina": 335,
    "longitudAcometida": 16,
    "longitudTotal": 351,
    "numeroCircuitos": 3,
    "potenciaMaximaSuelo": 100,
    "advisoryMessage": {
      "level": "WARNING",
      "message": "⚠️ PÉRDIDA DE CARGA: La longitud total (351m) excede los 120m recomendados..."
    },
    "notaDiseno": "Cálculo estimado para pre-dimensionamiento. Se requiere plano 1:100 con cotas para balance térmico definitivo."
  }
}
```

**Respuesta de Error de Validación (400):**
```json
{
  "success": false,
  "error": "Validation Error",
  "details": [
    {
      "field": "area",
      "message": "El área debe ser un número positivo"
    }
  ]
}
```

## 🧮 Motor de Cálculo

### Selección de Paso de Tubería

El sistema selecciona automáticamente el paso óptimo:

- **Paso 15cm** (Densidad: 6.7 m/m²):
  - Si carga térmica > 70 W/m²
  - Si suelo es MADERA_FLOTANTE o MOQUETA (forzado)

- **Paso 20cm** (Densidad: 5.0 m/m²):
  - Si carga térmica ≤ 70 W/m²
  - Solo para suelos PETREO o MADERA_MACIZA

### Fórmulas de Cálculo

```
L_serpentina = área × Densidad
L_acometida = distanciaAlColector × 2
L_total = L_serpentina + L_acometida
N_circuitos = ceil(L_total / 120)
```

### Sistema de Alertas

#### 🟡 Alerta de Pérdida de Carga (WARNING)
Se activa cuando `L_total > 120m`. Sugiere división en múltiples circuitos.

#### 🔴 Alerta de Suelo Crítica (CRITICAL)
Se activa cuando:
- Suelo es MADERA_FLOTANTE o MOQUETA
- Y carga térmica requerida > 60 W/m²

Recomienda cambio a suelo pétreo o sistema de radiadores.

#### ℹ️ Información Técnica (INFO)
Se muestra para suelos con alta resistencia térmica cuando la carga está dentro del rango aceptable.

## 📁 Estructura del Proyecto

```
API Piso Radiante/
├── src/
│   ├── index.ts                    # Entry point de la aplicación
│   ├── types/
│   │   └── underfloor.types.ts     # Definiciones de tipos TypeScript
│   ├── services/
│   │   └── UnderfloorService.ts    # Lógica de cálculo principal
│   ├── controllers/
│   │   └── underfloorController.ts # Controlador HTTP
│   ├── routes/
│   │   └── underfloorRoutes.ts     # Definición de rutas
│   └── validators/
│       └── underfloor.validator.ts # Schemas de validación Zod
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🧪 Ejemplos de Uso

### Ejemplo 1: Caso Normal - Suelo Pétreo
```bash
curl -X POST http://localhost:3000/api/v1/underfloor/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "area": 50,
    "cargaTermicaRequerida": 70,
    "tipoDeSuelo": "PETREO",
    "distanciaAlColector": 8
  }'
```

### Ejemplo 2: Caso Crítico - Madera Flotante
```bash
curl -X POST http://localhost:3000/api/v1/underfloor/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "area": 40,
    "cargaTermicaRequerida": 75,
    "tipoDeSuelo": "MADERA_FLOTANTE",
    "distanciaAlColector": 6
  }'
```

### Ejemplo 3: Área Pequeña - Paso 20cm
```bash
curl -X POST http://localhost:3000/api/v1/underfloor/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "area": 20,
    "cargaTermicaRequerida": 60,
    "tipoDeSuelo": "PETREO",
    "distanciaAlColector": 5
  }'
```

## 🛠️ Tecnologías

- **Node.js** + **TypeScript**: Backend type-safe
- **Express.js**: Framework web
- **Zod**: Validación de schemas
- **CORS**: Manejo de cross-origin requests

## 📝 Notas Técnicas

- Los cálculos son estimaciones para pre-dimensionamiento
- Se requiere plano 1:100 con cotas para balance térmico definitivo
- La longitud máxima recomendada por circuito es 120m
- Los valores de potencia máxima por tipo de suelo son conservadores

## 👨‍💻 Autor

Edgardo Lamas

## 📄 Licencia

ISC
