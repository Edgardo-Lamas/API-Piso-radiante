# Mejoras y Visualización Canvas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir bugs de prioridad alta/media, reemplazar el espiral por serpentina real de piso radiante, agregar tuberías de retorno al colector y soporte para múltiples colectores con posicionamiento visual.

**Architecture:** Las correcciones son quirúrgicas (cambio de URL a relativa, cache de catálogo, validación frontend). La parte de visualización vive íntegramente en `public/js/canvasRenderer.js` con la función `drawRooms()` como punto central. Los colectores múltiples amplían el array `designState.objects` con un nuevo tipo `collector-N` y un botón en el HTML para agregarlos.

**Tech Stack:** Vanilla JS (frontend), Canvas 2D API, TypeScript/Express (backend), jsPDF (export)

---

## Task 1: Fix URL relativa en el frontend

**Files:**
- Modify: `public/js/app.js:10`
- Modify: `public/js/app.js:606`

**Problema:** `API_URL` y `checkAPIStatus` usan `http://localhost:3000` hardcodeado. En producción o cualquier otro host, esto rompe la app.

**Step 1: Cambiar API_URL a relativa**

En `public/js/app.js` línea 10, reemplazar:
```js
const API_URL = 'http://localhost:3000/api/v1/underfloor/calculate';
```
Por:
```js
const API_URL = '/api/v1/underfloor/calculate';
```

**Step 2: Cambiar health check URL a relativa**

En `public/js/app.js` línea 606, reemplazar:
```js
const response = await fetch('http://localhost:3000/health');
```
Por:
```js
const response = await fetch('/health');
```

**Step 3: Verificar en browser**

Abrir DevTools → Network → enviar un formulario → verificar que la request va a `/api/v1/underfloor/calculate` (relativa, sin hostname).

**Step 4: Commit**
```bash
git add public/js/app.js
git commit -m "fix: usar URLs relativas en lugar de localhost:3000 hardcodeado"
```

---

## Task 2: Cachear catálogo en PresupuestoService (eliminar readFileSync bloqueante)

**Files:**
- Modify: `src/services/PresupuestoService.ts:1-12`

**Problema:** `fs.readFileSync()` en el constructor bloquea el event loop de Node en cada instancia creada. Solución: leer el archivo una sola vez al importar el módulo.

**Step 1: Mover la lectura del catálogo a nivel de módulo**

Reemplazar el constructor actual:
```typescript
import { UnderfloorCalculationOutput } from '../types/underfloor.types';
import { ResumenPresupuesto, Catalogo, ItemPresupuesto } from '../types/presupuesto.types';
import * as fs from 'fs';
import * as path from 'path';

// Leer el catálogo una sola vez al cargar el módulo
const catalogoPath = path.join(__dirname, '../data/catalogo.json');
const CATALOGO: Catalogo = JSON.parse(fs.readFileSync(catalogoPath, 'utf-8'));

export class PresupuestoService {
    private catalogo: Catalogo;

    constructor() {
        this.catalogo = CATALOGO;
    }
    // ... resto igual
```

**Step 2: Verificar arranque del servidor**

```bash
npm run dev
```
Esperado: servidor arranca sin errores, `CATALOGO` se carga una vez en el log de arranque.

**Step 3: Commit**
```bash
git add src/services/PresupuestoService.ts
git commit -m "perf: cachear catálogo como singleton de módulo, eliminar readFileSync en constructor"
```

---

## Task 3: Validación frontend antes del submit

**Files:**
- Modify: `public/js/app.js:163-200` (función `handleFormSubmit`)

**Problema:** El cliente no valida rangos numéricos antes de enviar. El usuario recibe errores del servidor que podrían resolverse antes.

**Step 1: Agregar función de validación**

Antes de la llamada `fetch` en `handleFormSubmit`, insertar:
```js
function validateFormData(data) {
    const errors = [];
    if (!data.area || isNaN(data.area) || data.area < 1 || data.area > 1000) {
        errors.push('Área debe estar entre 1 y 1000 m²');
    }
    if (!data.cargaTermicaRequerida || isNaN(data.cargaTermicaRequerida) ||
        data.cargaTermicaRequerida < 10 || data.cargaTermicaRequerida > 150) {
        errors.push('Carga térmica debe estar entre 10 y 150 W/m²');
    }
    if (!data.tipoDeSuelo) {
        errors.push('Debe seleccionar un tipo de suelo');
    }
    if (isNaN(data.distanciaAlColector) || data.distanciaAlColector < 0 || data.distanciaAlColector > 200) {
        errors.push('Distancia al colector debe estar entre 0 y 200 m');
    }
    return errors;
}
```

**Step 2: Llamar la validación en handleFormSubmit**

Después de construir `data`, antes del `showLoading()`:
```js
const validationErrors = validateFormData(data);
if (validationErrors.length > 0) {
    showError(validationErrors.join(' | '));
    return;
}
```

**Step 3: Verificar en browser**

Intentar enviar el formulario vacío → debe mostrar el error de validación sin hacer request al servidor.

**Step 4: Commit**
```bash
git add public/js/app.js
git commit -m "feat: agregar validación en el frontend antes de llamar al API"
```

---

## Task 4: Reemplazar espiral por serpentina real de piso radiante

**Files:**
- Modify: `public/js/canvasRenderer.js:290-388` (funciones `drawCounterflowSpiralInside` y `drawSpiralPath`)

**Problema:** El trazado actual dibuja un espiral hacia adentro (como un caracol). El piso radiante real usa una serpentina: filas paralelas que van y vuelven en boustrophedon. El IDA va de izquierda a derecha en filas alternas, el RETORNO va en sentido inverso por las mismas filas pero desplazado medio paso.

**Concepto de serpentina:**
```
→→→→→→→→→→ IDA fila 1
←←←←←←←←←← RETORNO fila 1 (a paso/2 de distancia)
→→→→→→→→→→ IDA fila 2
←←←←←←←←←← RETORNO fila 2
...
```

**Step 1: Reemplazar `drawCounterflowSpiralInside` con serpentina real**

```js
function drawSerpentineInside(ctx, x, y, w, h, pasoCm, color) {
    const scale = designState.calibration.isCalibrated
        ? (1 / designState.calibration.metersPerPixel)
        : 50;
    const step = (pasoCm / 100) * scale;   // distancia entre filas (IDA)
    const halfStep = step / 2;              // offset del RETORNO

    const normX = w >= 0 ? x : x + w;
    const normY = h >= 0 ? y : y + h;
    const normW = Math.abs(w);
    const normH = Math.abs(h);

    if (normW < step * 2 || normH < step) return;

    const margin = 8;
    const x0 = normX + margin;
    const y0 = normY + margin;
    const x1 = normX + normW - margin;
    const y1 = normY + normH - margin;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;

    // --- TUBERÍA IDA (color del ambiente) ---
    ctx.strokeStyle = color;
    ctx.beginPath();
    let row = 0;
    for (let yLine = y0; yLine <= y1; yLine += step) {
        const goingRight = (row % 2 === 0);
        if (row === 0) {
            ctx.moveTo(goingRight ? x0 : x1, yLine);
        }
        ctx.lineTo(goingRight ? x1 : x0, yLine);
        // Curva de retorno (semicircle en el extremo)
        const nextY = yLine + step;
        if (nextY <= y1) {
            const midX = goingRight ? x1 : x0;
            ctx.arcTo(midX + (goingRight ? halfStep : -halfStep), yLine,
                      midX + (goingRight ? halfStep : -halfStep), nextY,
                      halfStep);
            ctx.arcTo(midX + (goingRight ? halfStep : -halfStep), nextY,
                      goingRight ? x0 : x1, nextY,
                      halfStep);
        }
        row++;
    }
    ctx.stroke();

    // --- TUBERÍA RETORNO (azul técnico) ---
    ctx.strokeStyle = '#3b82f6';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    row = 0;
    for (let yLine = y0 + halfStep; yLine <= y1; yLine += step) {
        const goingRight = (row % 2 === 1); // opuesto a IDA
        if (row === 0) {
            ctx.moveTo(goingRight ? x0 : x1, yLine);
        }
        ctx.lineTo(goingRight ? x1 : x0, yLine);
        const nextY = yLine + step;
        if (nextY <= y1) {
            const midX = goingRight ? x1 : x0;
            ctx.arcTo(midX + (goingRight ? halfStep : -halfStep), yLine,
                      midX + (goingRight ? halfStep : -halfStep), nextY,
                      halfStep);
            ctx.arcTo(midX + (goingRight ? halfStep : -halfStep), nextY,
                      goingRight ? x0 : x1, nextY,
                      halfStep);
        }
        row++;
    }
    ctx.stroke();
    ctx.setLineDash([]); // restaurar

    ctx.restore();
}
```

**Step 2: Actualizar `drawRooms` para llamar la nueva función**

En `drawRooms` (línea ~275), reemplazar:
```js
drawCounterflowSpiralInside(ctx, r.x, r.y, r.w, r.h, paso, room.color);
```
Por:
```js
const paso = designState.technicalData.paso || 15;
drawSerpentineInside(ctx, r.x, r.y, r.w, r.h, paso, room.color);
```

**Step 3: Agregar leyenda al canvas**

Al final de `drawAll()`, antes del `requestAnimationFrame`, agregar:
```js
drawLegend(ctx);
```

```js
function drawLegend(ctx) {
    const items = [
        { color: '#ef4444', label: 'IDA (tubería caliente)', dash: false },
        { color: '#3b82f6', label: 'RETORNO (tubería fría)', dash: true }
    ];
    ctx.save();
    ctx.font = '11px Inter, sans-serif';
    let lx = 10, ly = 20;
    items.forEach(item => {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        if (item.dash) ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 24, ly);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(item.label, lx + 30, ly + 4);
        ly += 18;
    });
    ctx.restore();
}
```

**Step 4: Verificar en browser**

Definir un ambiente en el canvas → verificar que aparecen las filas paralelas de serpentina (IDA sólida + RETORNO discontinua azul).

**Step 5: Commit**
```bash
git add public/js/canvasRenderer.js
git commit -m "feat: reemplazar espiral por serpentina real de piso radiante (boustrophedon)"
```

---

## Task 5: Tuberías de conexión de cada ambiente al colector

**Files:**
- Modify: `public/js/canvasRenderer.js` — función `drawRooms` y nueva función `drawCircuitConnections`

**Objetivo:** Dibujar una línea IDA (roja) y RETORNO (azul discontinua) desde el colector más cercano hasta el borde de cada ambiente, representando la acometida de cada circuito.

**Step 1: Agregar función `drawCircuitConnections`**

```js
function drawCircuitConnections(ctx) {
    designState.rooms.forEach(room => {
        // Encontrar el colector más cercano al centro del primer rect del ambiente
        const firstRect = room.rects[0];
        if (!firstRect) return;

        const roomCx = firstRect.x + firstRect.w / 2;
        const roomCy = firstRect.y + firstRect.h / 2;

        const collector = designState.objects
            .filter(o => o.type === 'collector')
            .reduce((closest, col) => {
                const d = Math.hypot(col.x - roomCx, col.y - roomCy);
                const dPrev = closest ? Math.hypot(closest.x - roomCx, closest.y - roomCy) : Infinity;
                return d < dPrev ? col : closest;
            }, null);

        if (!collector) return;

        // Punto de entrada al ambiente (borde del rectángulo más cercano al colector)
        const entryX = roomCx;
        const entryY = firstRect.y; // borde superior

        const offset = 5; // desplazamiento entre IDA y RETORNO

        ctx.save();
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // IDA
        ctx.strokeStyle = room.color;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(collector.x - offset, collector.y);
        ctx.lineTo(entryX - offset, entryY);
        ctx.stroke();

        // RETORNO
        ctx.strokeStyle = '#3b82f6';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(collector.x + offset, collector.y);
        ctx.lineTo(entryX + offset, entryY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();
    });
}
```

**Step 2: Llamar `drawCircuitConnections` en `drawAll`**

En la función `drawAll`, después de `drawRooms(ctx)` y antes de los waypoints:
```js
drawCircuitConnections(ctx);
```

**Step 3: Verificar**

Definir un ambiente y posicionar el colector → debe aparecer una línea roja y una azul discontinua conectando el colector con el ambiente.

**Step 4: Commit**
```bash
git add public/js/canvasRenderer.js
git commit -m "feat: dibujar acometida IDA/RETORNO desde cada colector a cada ambiente"
```

---

## Task 6: Soporte para múltiples colectores

**Files:**
- Modify: `public/index.html` — agregar botón "Agregar Colector" en sección de herramientas de diseño
- Modify: `public/js/canvasRenderer.js` — soportar tipo `collector` múltiple en `designState.objects`
- Modify: `public/js/app.js` — handler para agregar colector

**Objetivo:** El usuario puede colocar N colectores en el canvas (arrastrarlos), y cada ambiente se conecta automáticamente al colector más cercano.

**Step 1: Agregar botón en HTML**

En `public/index.html`, dentro de la sección "HERRAMIENTAS DE DISEÑO", después del botón de `start-room-btn`:
```html
<button id="add-collector-btn"
    class="w-full bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium py-2 px-3 rounded transition-colors hidden"
    title="Agregar otro colector para superficies grandes">
    <i class="fas fa-plus mr-2"></i>Agregar Colector
</button>
```

**Step 2: Handler en app.js**

```js
const addCollectorBtn = document.getElementById('add-collector-btn');
if (addCollectorBtn) {
    addCollectorBtn.addEventListener('click', handleAddCollector);
}

function handleAddCollector() {
    const existingCollectors = designState.objects.filter(o => o.type === 'collector');
    const newIndex = existingCollectors.length + 1;
    const canvas = document.getElementById('pipe-layout-canvas');
    const cx = canvas ? canvas.width / 2 : 200;
    const cy = canvas ? canvas.height / 2 : 200;

    designState.objects.push({
        id: `collector-${newIndex}`,
        type: 'collector',
        x: cx + (newIndex * 30),
        y: cy,
        label: `COLECTOR ${newIndex}`,
        icon: '🔀',
        color: '#3b82f6'
    });
    showError(`✓ Colector ${newIndex} agregado. Podés arrastrarlo al plano.`);
}
```

**Step 3: Mostrar botón cuando el usuario calibra el plano**

En `handleStartCalibration()` en `app.js`, agregar:
```js
const addCollectorBtn = document.getElementById('add-collector-btn');
if (addCollectorBtn) addCollectorBtn.classList.remove('hidden');
```

**Step 4: Actualizar `drawObject` en canvasRenderer para mostrar número de colector**

En `drawObject` (línea ~200), ya dibuja `obj.label` — el label ya incluirá "COLECTOR 2", etc. No requiere cambio.

**Step 5: Actualizar `drawFeedingPipe` para dibujar tubería caldera→TODOS los colectores**

Modificar `drawFeedingPipe`:
```js
function drawFeedingPipe(ctx) {
    const boiler = designState.objects.find(o => o.id === 'boiler');
    const collectors = designState.objects.filter(o => o.type === 'collector');

    if (!boiler || collectors.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'black';

    collectors.forEach(collector => {
        ctx.beginPath();
        ctx.moveTo(boiler.x, boiler.y);
        ctx.lineTo(boiler.x, collector.y);
        ctx.lineTo(collector.x, collector.y);
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = 'italic 10px Arial';
        ctx.fillText('Alimentación 1"', (boiler.x + collector.x) / 2, collector.y - 10);
    });

    ctx.restore();
}
```

**Step 6: Actualizar presupuesto para calcular un colector por zona**

En `PresupuestoService.ts`, método `seleccionarColector`, el servicio ya selecciona por número de circuitos. Con múltiples colectores habrá que dividir los circuitos, pero para el MVP: calcular colector por colector con circuitos totales / número de colectores.

En el frontend, enviar `numeroColectores` en la llamada:
```js
// En handleFormSubmit, en el objeto data:
numeroColectores: designState.objects.filter(o => o.type === 'collector').length
```

**Step 7: Verificar**

1. Cargar plano
2. Calibrar
3. Hacer clic en "Agregar Colector" → aparece un segundo nodo azul en el canvas
4. Arrastrarlo a otra zona
5. Definir ambientes → cada ambiente se conecta al colector más cercano con líneas de acometida

**Step 8: Commit**
```bash
git add public/index.html public/js/app.js public/js/canvasRenderer.js
git commit -m "feat: soporte para múltiples colectores arrastrables con conexión automática al ambiente más cercano"
```

---

## Task 7: Mostrar etiquetas de circuito y paso en cada ambiente del canvas

**Files:**
- Modify: `public/js/canvasRenderer.js` — función `drawRooms`

**Objetivo:** Mostrar dentro de cada ambiente dibujado: nombre, área, número de circuitos estimado y paso de tubería. Permite al instalador leer el plano directamente.

**Step 1: Calcular y mostrar info de circuito por ambiente**

En la función `drawRooms`, después de dibujar la serpentina:
```js
// Info técnica dentro del ambiente
const paso = designState.technicalData.paso || 15;
const density = paso === 15 ? 6.7 : 5.0;
const scale = designState.calibration.metersPerPixel;
const realW = r.w * scale;
const realH = r.h * scale;
const areaReal = realW * realH;
const serpLength = areaReal * density;
const circuitos = Math.ceil(serpLength / 120);

ctx.save();
ctx.fillStyle = 'rgba(0,0,0,0.5)';
ctx.fillRect(r.x + 4, r.y + r.h - 36, r.w - 8, 32);
ctx.fillStyle = '#e2e8f0';
ctx.font = 'bold 9px Inter';
ctx.fillText(`${room.name}`, r.x + 8, r.y + r.h - 24);
ctx.font = '9px Inter';
ctx.fillText(`${formatNumber(areaReal, 1)}m² · ${circuitos} circ. · paso ${paso}cm`, r.x + 8, r.y + r.h - 10);
ctx.restore();
```

**Step 2: Verificar**

Definir un ambiente calibrado → debe mostrar en la esquina inferior del rectángulo: nombre, área en m², circuitos y paso.

**Step 3: Commit**
```bash
git add public/js/canvasRenderer.js
git commit -m "feat: mostrar etiqueta técnica (área, circuitos, paso) dentro de cada ambiente en el canvas"
```

---

## Resumen de archivos modificados

| Archivo | Tasks |
|---------|-------|
| `public/js/app.js` | 1, 3, 5, 6 |
| `public/js/canvasRenderer.js` | 4, 5, 6, 7 |
| `src/services/PresupuestoService.ts` | 2 |
| `public/index.html` | 6 |

## Verificación final

1. Abrir `http://localhost:3000/app`
2. Verificar que DevTools Network no muestra requests a `localhost:3000` (sino URLs relativas)
3. Cargar un plano de imagen
4. Calibrar la escala
5. Dibujar 2-3 ambientes → verificar serpentina boustrophedon visible
6. Agregar un segundo colector → arrastrarlo a otra zona
7. Verificar que cada ambiente se conecta al colector más cercano con acometida IDA/RETORNO
8. Calcular → verificar presupuesto incluye colectores correctos
9. Exportar PDF → esquema incluido con serpentinas
