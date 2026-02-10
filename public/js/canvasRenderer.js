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
    dragOffset: { x: 0, y: 0 }
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

    // 5. Waypoints (Ruta de Pasillo)
    drawWaypoints(ctx);

    // 6. Objetos Arrastrables (Caldera y Colector)
    designState.objects.forEach(obj => drawObject(ctx, obj));

    // 7. Guía de Calibración
    if (designState.calibration.active || designState.calibration.points.length > 0) {
        drawCalibrationGuide(ctx);
    }

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
        designState.isDraggingRoom = true;
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
    if (designState.isDraggingRoom) {
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
    if (designState.isDraggingRoom) {
        designState.isDraggingRoom = false;
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
    const collector = designState.objects.find(o => o.id === 'collector');

    if (!boiler || !collector) return;

    ctx.save();
    ctx.strokeStyle = '#94a3b8'; // Slate-400
    ctx.lineWidth = 8; // Gruesa (1")
    ctx.lineCap = 'round';
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'black';

    ctx.beginPath();
    ctx.moveTo(boiler.x, boiler.y);
    // Dibujamos en ángulo recto para estética profesional
    ctx.lineTo(boiler.x, collector.y);
    ctx.lineTo(collector.x, collector.y);
    ctx.stroke();

    // Texto de referencia
    ctx.fillStyle = 'white';
    ctx.font = 'italic 10px Arial';
    ctx.fillText('Alimentación 1"', (boiler.x + collector.x) / 2, collector.y - 10);

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
            // Calculamos el paso basado en el estado (o default)
            const paso = 15; // Debería venir de room settings
            drawCounterflowSpiralInside(ctx, r.x, r.y, r.w, r.h, paso, room.color);
        });
    });

    // Dibujar rectángulo actual siendo arrastrado
    if (designState.isDraggingRoom && designState.currentRoomRect) {
        const r = designState.currentRoomRect;
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(r.startX, r.startY, r.w, r.h);
        ctx.restore();
    }
}

function drawCounterflowSpiralInside(ctx, x, y, w, h, pasoCm, color) {
    const scale = designState.calibration.isCalibrated ? (1 / designState.calibration.metersPerPixel) : 50;
    const step = (pasoCm / 100) * scale;
    const cornerRadius = step * 0.4;

    // Normalizar rect (permitir dibujo en cualquier dirección)
    const normX = w > 0 ? x : x + w;
    const normY = h > 0 ? y : y + h;
    const normW = Math.abs(w);
    const normH = Math.abs(h);

    if (normW < step || normH < step) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;

    // IDA (Color del ambiente)
    drawSpiralPath(ctx, normX + 5, normY + 5, normW - 10, normH - 10, step, cornerRadius, color, true);

    // RETORNO (Azul técnico o desaturado del mismo color)
    drawSpiralPath(ctx, normX + 5 + step / 2, normY + 5 + step / 2, normW - 10 - step, normH - 10 - step, step, cornerRadius, '#3b82f6', false);

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

// ========================================
// API Pública para app.js
// ========================================

/**
 * Función que reemplaza a la anterior para integrarse con app.js
 */
function renderPipeLayout(data) {
    designState.room.area = data.area;
    designState.room.paso = data.pasoSeleccionado;
    designState.room.numCircuits = data.numeroCircuitos;

    // La animación drawAll se encarga del resto
    const container = document.getElementById('canvas-container');
    if (container) container.classList.remove('hidden');
}

// Inicializar al cargar
initCanvasEngine();
