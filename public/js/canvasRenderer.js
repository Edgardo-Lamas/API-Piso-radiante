// ========================================
// Estado Global del Diseño
// ========================================

const designState = {
    backgroundImage: null,
    calibration: {
        active: false,
        points: [],
        metersPerPixel: 1 / 50, // Default 1:50
        isCalibrated: false
    },
    objects: [
        { id: 'boiler', type: 'boiler', x: 50, y: 50, label: 'CALDERA', icon: '🔥', color: '#ef4444' },
        { id: 'collector', type: 'collector', x: 150, y: 250, label: 'GABINETE', icon: '🔀', color: '#3b82f6' }
    ],
    waypoints: [],
    isRouting: false,
    rooms: [], // Array de objetos { id, name, rects: [{x, y, w, h}], color }
    isDrawingRoom: false,
    currentRoomRect: null,
    activeRoomName: null,
    isDragging: false,
    draggedObject: null,
    dragOffset: { x: 0, y: 0 },
    technicalData: {
        area: 0,
        paso: 0,
        numCircuits: 0
    }
};

const CIRCUIT_COLORS = [
    { ida: '#ef4444', retorno: '#3b82f6' }, // Rojo/Azul par estandar
    { ida: '#f59e0b', retorno: '#06b6d4' }, // Naranja/Cyan
    { ida: '#8b5cf6', retorno: '#10b981' }  // Purpura/Verde
];

// ========================================
// Inicialización y Eventos
// ========================================

/**
 * Inicializa el motor de renderizado y los eventos del canvas
 */
function initCanvasEngine() {
    const canvas = document.getElementById('pipe-layout-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Animación fluida
    requestAnimationFrame(drawAll);
}

// ========================================
// Renderizado Principal (drawAll)
// ========================================

function drawAll() {
    const canvas = document.getElementById('pipe-layout-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Limpiar
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Fondo (Imagen si existe)
    if (designState.backgroundImage) {
        ctx.drawImage(designState.backgroundImage, 0, 0, canvas.width, canvas.height);
    }

    // 2. Grid (Sólo si no hay imagen o para referencia)
    if (!designState.backgroundImage) {
        drawGrid(ctx, canvas.width, canvas.height);
    }

    // 3. Tubería de Alimentación (1") entre Caldera y Colector
    drawFeedingPipe(ctx);

    // 4. Ambientes y Serpentinas
    drawRooms(ctx);

    drawCircuitConnections(ctx);

    // 5. Waypoints (Ruta de Pasillo)
    drawWaypoints(ctx);

    // 6. Objetos Arrastrables (Caldera y Colector)
    designState.objects.forEach(obj => drawObject(ctx, obj));

    // 7. Guía de Calibración
    if (designState.calibration.active || designState.calibration.points.length > 0) {
        drawCalibrationGuide(ctx);
    }

    drawLegend(ctx);

    requestAnimationFrame(drawAll);
}

// ========================================
// Lógica de Interacción (Drag & Drop)
// ========================================

function handleMouseDown(e) {
    const rect = e.target.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (e.target.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (e.target.height / rect.height);

    // Si estamos en modo calibración
    if (designState.calibration.active) {
        designState.calibration.points.push({ x: mouseX, y: mouseY });

        if (designState.calibration.points.length === 2) {
            if (typeof onCalibrationPointsSelected === 'function') {
                onCalibrationPointsSelected();
            }
        } else if (designState.calibration.points.length > 2) {
            designState.calibration.points.shift();
        }
        return;
    }

    // Si estamos en modo dibujo de Habitación
    if (designState.isDrawingRoom) {
        designState.isDrawingRoom = true;
        designState.currentRoomRect = { startX: mouseX, startY: mouseY, w: 0, h: 0 };
        return;
    }

    // Si estamos en modo ruteo (Waypoints)
    if (designState.isRouting) {
        designState.waypoints.push({ x: mouseX, y: mouseY });
        const countEl = document.getElementById('waypoint-count');
        if (countEl) countEl.textContent = designState.waypoints.length;
        return;
    }

    // Detectar colisión con objetos
    for (let i = designState.objects.length - 1; i >= 0; i--) {
        const obj = designState.objects[i];
        const dist = Math.sqrt((mouseX - obj.x) ** 2 + (mouseY - obj.y) ** 2);

        if (dist < 30) { // Radio de colisión
            designState.isDragging = true;
            designState.draggedObject = obj;
            designState.dragOffset.x = mouseX - obj.x;
            designState.dragOffset.y = mouseY - obj.y;
            return;
        }
    }
}

function handleMouseMove(e) {
    if (designState.isDrawingRoom) {
        const rect = designState.currentRoomRect;
        rect.w = mouseX - rect.startX;
        rect.h = mouseY - rect.startY;
        return;
    }

    if (!designState.isDragging || !designState.draggedObject) return;

    const canvas = document.getElementById('pipe-layout-canvas');
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

    designState.draggedObject.x = mouseX - designState.dragOffset.x;
    designState.draggedObject.y = mouseY - designState.dragOffset.y;
}

// Variable para tracking del mouse en ruteo/calibración
let currentMousePos = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
    const canvas = document.getElementById('pipe-layout-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    currentMousePos.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});

function handleMouseUp() {
    if (designState.isDrawingRoom) {
        designState.isDrawingRoom = false;
        if (Math.abs(designState.currentRoomRect.w) > 10 && Math.abs(designState.currentRoomRect.h) > 10) {
            if (typeof onRoomRectFinished === 'function') {
                onRoomRectFinished(designState.currentRoomRect);
            }
        }
        designState.currentRoomRect = null;
    }
    designState.isDragging = false;
    designState.draggedObject = null;
}

// ========================================
// Dibujo de Elementos
// ========================================

function drawObject(ctx, obj) {
    ctx.save();

    // Sombra
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';

    // Círculo base
    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, 20, 0, Math.PI * 2);
    ctx.fill();

    // Icono
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obj.icon, obj.x, obj.y);

    // Etiqueta
    ctx.font = 'bold 10px "Roboto Mono", monospace';
    ctx.fillText(obj.label, obj.x, obj.y + 35);

    ctx.restore();
}

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
        ctx.shadowBlur = 0;
        ctx.font = 'italic 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Alimentación 1"', (boiler.x + collector.x) / 2, collector.y - 10);
    });

    ctx.restore();
}

function drawRooms(ctx) {
    // Dibujar rectángulos de ambientes existentes
    designState.rooms.forEach(room => {
        room.rects.forEach(r => {
            ctx.save();
            ctx.strokeStyle = room.color;
            ctx.fillStyle = room.color + '22'; // 22 es opacidad ~13%
            ctx.lineWidth = 1;
            ctx.strokeRect(r.x, r.y, r.w, r.h);
            ctx.fillRect(r.x, r.y, r.w, r.h);

            // Etiqueta del ambiente
            ctx.fillStyle = room.color;
            ctx.font = 'bold 10px Inter';
            ctx.fillText(room.name, r.x + 5, r.y + 15);
            ctx.restore();

            // Dibujar serpentina dentro de este rectángulo
            const paso = designState.technicalData.paso || 15;
            drawSerpentineInside(ctx, r.x, r.y, r.w, r.h, paso, room.color);

            // --- Etiqueta técnica del ambiente ---
            const density = paso === 15 ? 6.7 : 5.0;
            const mpp = designState.calibration.isCalibrated ? designState.calibration.metersPerPixel : (1 / 50);
            const realW = Math.abs(r.w) * mpp;
            const realH = Math.abs(r.h) * mpp;
            const areaReal = realW * realH;
            const serpLength = areaReal * density;
            const circuitos = Math.ceil(serpLength / 90) || 1;

            const normX = r.w >= 0 ? r.x : r.x + r.w;
            const normY = r.h >= 0 ? r.y : r.y + r.h;
            const normW = Math.abs(r.w);
            const normH = Math.abs(r.h);

            const labelH = 28;
            const labelY = normY + normH - labelH;

            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
            ctx.fillRect(normX + 2, labelY, normW - 4, labelH);

            ctx.fillStyle = room.color;
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(room.name, normX + 6, labelY + 4);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '8px Inter, sans-serif';
            const infoText = areaReal > 0
                ? `${areaReal.toFixed(1)} m²  ·  ${circuitos} circ.  ·  paso ${paso} cm`
                : `paso ${paso} cm`;
            ctx.fillText(infoText, normX + 6, labelY + 16);
            ctx.restore();
        });
    });

    // Dibujar rectángulo actual siendo arrastrado
    if (designState.isDrawingRoom && designState.currentRoomRect) {
        const r = designState.currentRoomRect;
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(r.startX, r.startY, r.w, r.h);
        ctx.restore();
    }
}

function drawSerpentineInside(ctx, x, y, w, h, pasoCm, color) {
    const scale = designState.calibration.isCalibrated
        ? (1 / designState.calibration.metersPerPixel)
        : 50;
    const step = (pasoCm / 100) * scale;
    const halfStep = step / 2;

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
    ctx.setLineDash([]);
    ctx.beginPath();
    let goingRight = true;
    let firstPoint = true;
    for (let yLine = y0; yLine <= y1; yLine += step) {
        const startX = goingRight ? x0 : x1;
        const endX = goingRight ? x1 : x0;
        if (firstPoint) {
            ctx.moveTo(startX, yLine);
            firstPoint = false;
        } else {
            ctx.lineTo(startX, yLine);
        }
        ctx.lineTo(endX, yLine);
        goingRight = !goingRight;
    }
    ctx.stroke();

    // --- TUBERÍA RETORNO (azul, desplazada medio paso) ---
    ctx.strokeStyle = '#60a5fa';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    goingRight = false; // opuesto a IDA
    firstPoint = true;
    for (let yLine = y0 + halfStep; yLine <= y1; yLine += step) {
        const startX = goingRight ? x0 : x1;
        const endX = goingRight ? x1 : x0;
        if (firstPoint) {
            ctx.moveTo(startX, yLine);
            firstPoint = false;
        } else {
            ctx.lineTo(startX, yLine);
        }
        ctx.lineTo(endX, yLine);
        goingRight = !goingRight;
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

function drawWaypoints(ctx) {
    const collector = designState.objects.find(o => o.id === 'collector');
    if (!collector || designState.waypoints.length === 0) return;

    ctx.save();
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    // Puntos para iterar (incluyendo el colector como inicio)
    const points = [{ x: collector.x, y: collector.y }, ...designState.waypoints];

    // Desfase para ida y vuelta paralela
    const offset = 4;

    // Dibujar IDA (Rojo)
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Dibujar RETORNO (Azul)
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(points[0].x + offset, points[0].y + offset);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x + offset, points[i].y + offset);
    }
    ctx.stroke();

    // Dibujar circulitos en los waypoints
    designState.waypoints.forEach((p, idx) => {
        ctx.fillStyle = designState.isRouting && idx === designState.waypoints.length - 1 ? '#fbbf24' : '#64748b';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();
}

function drawSpiralPath(ctx, x, y, w, h, step, radius, color, isIda) {
    ctx.strokeStyle = color;
    ctx.beginPath();

    let curX = x;
    let curY = y;
    let curW = w;
    let curH = h;

    ctx.moveTo(curX, curY + curH / 2);

    while (curW > step && curH > step) {
        // Top
        ctx.arcTo(curX, curY, curX + curW, curY, radius);
        // Right
        ctx.arcTo(curX + curW, curY, curX + curW, curY + curH, radius);
        // Bottom
        ctx.arcTo(curX + curW, curY + curH, curX, curY + curH, radius);
        // Left
        ctx.arcTo(curX, curY + curH, curX, curY + step, radius);

        curX += step;
        curY += step;
        curW -= step * 2;
        curH -= step * 2;

        ctx.lineTo(curX, curY + curH / 2);
    }
    ctx.stroke();
}

function drawGrid(ctx, width, height) {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    const step = 20; // Píxeles por grid
    for (let x = 0; x <= width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y <= height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
}

function drawCalibrationGuide(ctx) {
    if (designState.calibration.points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    ctx.lineWidth = 2;

    // Dibujar puntos marcados
    designState.calibration.points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Línea de previsualización o línea final
    ctx.beginPath();
    const p1 = designState.calibration.points[0];
    ctx.moveTo(p1.x, p1.y);

    if (designState.calibration.points.length === 1 && designState.calibration.active) {
        // Línea elástica al mouse
        ctx.setLineDash([5, 5]);
        ctx.lineTo(currentMousePos.x, currentMousePos.y);
    } else if (designState.calibration.points.length === 2) {
        // Línea sólida final
        const p2 = designState.calibration.points[1];
        ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();
    ctx.restore();
}

function drawCircuitConnections(ctx) {
    const collectors = designState.objects.filter(o => o.type === 'collector');
    if (collectors.length === 0) return;

    designState.rooms.forEach(room => {
        const firstRect = room.rects[0];
        if (!firstRect) return;

        const roomCx = firstRect.x + firstRect.w / 2;
        const roomCy = firstRect.y + firstRect.h / 2;

        // Encontrar el colector más cercano al centro del ambiente
        const collector = collectors.reduce((closest, col) => {
            const d = Math.hypot(col.x - roomCx, col.y - roomCy);
            const dPrev = closest ? Math.hypot(closest.x - roomCx, closest.y - roomCy) : Infinity;
            return d < dPrev ? col : closest;
        }, null);

        if (!collector) return;

        // Punto de entrada: borde del rect más cercano al colector
        const entryX = firstRect.x + firstRect.w / 2;
        const entryY = collector.y < roomCy ? firstRect.y : firstRect.y + firstRect.h;

        const offset = 4;

        ctx.save();
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // IDA - color del ambiente
        ctx.strokeStyle = room.color;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(collector.x - offset, collector.y);
        ctx.lineTo(entryX - offset, entryY);
        ctx.stroke();

        // RETORNO - azul punteado
        ctx.strokeStyle = '#60a5fa';
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(collector.x + offset, collector.y);
        ctx.lineTo(entryX + offset, entryY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();
    });
}

function drawLegend(ctx) {
    const canvas = document.getElementById('pipe-layout-canvas');
    if (!canvas) return;
    const items = [
        { color: '#ef4444', label: 'IDA (tubería caliente)', dash: false },
        { color: '#60a5fa', label: 'RETORNO (tubería fría)', dash: true },
        { color: '#94a3b8', label: 'Alimentación caldera', dash: false }
    ];
    ctx.save();
    ctx.font = 'bold 10px Inter, sans-serif';
    let lx = 10, ly = 18;
    items.forEach(item => {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        if (item.dash) ctx.setLineDash([5, 4]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 22, ly);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(item.label, lx + 28, ly + 4);
        ly += 16;
    });
    ctx.restore();
}

// ========================================
// API Pública para app.js
// ========================================

/**
 * Función que reemplaza a la anterior para integrarse con app.js
 */
function renderPipeLayout(data) {
    designState.technicalData.area = data.area;
    designState.technicalData.paso = data.pasoSeleccionado;
    designState.technicalData.numCircuits = data.numeroCircuitos;

    // Mostrar el canvas container
    const container = document.getElementById('canvas-container');
    if (container) {
        container.classList.remove('hidden');
    }
    
    // Iniciar el motor de renderizado si no está iniciado
    initCanvasEngine();
}

// Inicializar al cargar
initCanvasEngine();
