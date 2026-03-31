/**
 * API Piso Radiante - Frontend Application
 * Lógica principal de la aplicación web
 */

// ========================================
// Configuración
// ========================================

const API_URL = '/api/v1/underfloor/calculate';

// ========================================
// Referencias al DOM
// ========================================

const form = document.getElementById('calculation-form');
const submitBtn = document.getElementById('submit-btn');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const initialState = document.getElementById('initial-state');
const resultsContainer = document.getElementById('results-container');
const dataCardsContainer = document.getElementById('data-cards');
const advisoryContainer = document.getElementById('advisory-container');
const designNote = document.getElementById('design-note');

const genBudgetBtn = document.getElementById('gen-budget-btn');
const budgetContainer = document.getElementById('budget-container');
const budgetTotal = document.getElementById('budget-total');
const downloadPdfBtn = document.getElementById('download-pdf-btn');

// Nuevas referencias diseño avanzado
const planUpload = document.getElementById('plan-upload');
const removePlanBtn = document.getElementById('remove-plan-btn');
const startCalibBtn = document.getElementById('start-calib-btn');
const calibrationTools = document.getElementById('calibration-tools');
const realDistInput = document.getElementById('real-dist-input');
const applyCalibBtn = document.getElementById('apply-calib-btn');
const cancelCalibBtn = document.getElementById('cancel-calib-btn');

// Waypoints
const startRouteBtn = document.getElementById('start-route-btn');
const interactionHint = document.getElementById('interaction-hint');

// Referencias Modal Calibración
const calibModal = document.getElementById('calibration-modal');
const calibModalContent = document.getElementById('modal-content');
const modalDistInput = document.getElementById('modal-dist-input');
const modalApplyBtn = document.getElementById('modal-apply-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// ========================================
// Estado Global de la Sesión
// ========================================
let currentCalculation = null;

// ========================================
// Event Listeners
// ========================================

// Función para inicializar listeners de forma segura
function initializeEventListeners() {
    // Verificar que los elementos existan antes de agregar listeners
    if (form) form.addEventListener('submit', handleFormSubmit);
    if (genBudgetBtn) genBudgetBtn.addEventListener('click', handleGenerateBudget);
    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', handleDownloadPDF);

    const startRoomBtn = document.getElementById('start-room-btn');
    const clearRoomsBtn = document.getElementById('clear-rooms-btn');

    // Listeners Diseño Avanzado
    if (planUpload) {
        console.log('planUpload element found, adding change listener');
        planUpload.addEventListener('change', handlePlanUpload);
    } else {
        console.error('Error: planUpload element not found');
    }
    
    if (removePlanBtn) removePlanBtn.addEventListener('click', handleRemovePlan);
    if (startCalibBtn) startCalibBtn.addEventListener('click', handleStartCalibration);
    if (applyCalibBtn) applyCalibBtn.addEventListener('click', handleApplyCalibration);
    if (cancelCalibBtn) cancelCalibBtn.addEventListener('click', handleCancelCalibration);

    // Listeners Múltiples Ambientes
    if (startRoomBtn) {
        startRoomBtn.addEventListener('click', handleStartRoomDrawing);
    }
    
    if (clearRoomsBtn) {
        clearRoomsBtn.addEventListener('click', () => {
            designState.rooms = [];
            document.getElementById('area').value = '';
            document.getElementById('area').disabled = false;
            document.getElementById('area').style.opacity = '1';
            updateRoomsList();
            showError("✓ Ambientes eliminados. Campo de área habilitado nuevamente.");
        });
    }

    // Listeners Modal
    if (modalApplyBtn) {
        modalApplyBtn.addEventListener('click', () => {
            const meters = parseFloat(modalDistInput.value);
            if (!isNaN(meters) && meters > 0) {
                realDistInput.value = meters;
                handleApplyCalibration();
                closeCalibModal();
            } else {
                showError("Por favor ingrese una medida válida mayor a 0.");
            }
        });
    }

    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', () => {
            handleCancelCalibration();
            closeCalibModal();
        });
    }

    // Listeners Waypoints
    if (startRouteBtn) {
        startRouteBtn.addEventListener('click', handleStartRouting);
    }
    
    const canvas = document.getElementById('pipe-layout-canvas');
    if (canvas) {
        canvas.addEventListener('dblclick', handleFinishRouting);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && designState.isRouting) {
                handleFinishRouting();
            }
        });
    }

    // Canvas Controls
    const clearAllBtn = document.getElementById('clear-all-btn');
    const deleteWaypointsBtn = document.getElementById('delete-waypoints-btn');
    
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', handleClearAll);
    }
    
    if (deleteWaypointsBtn) {
        deleteWaypointsBtn.addEventListener('click', () => {
            designState.waypoints = [];
            document.getElementById('waypoint-count').textContent = '0';
        });
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEventListeners);
} else {
    initializeEventListeners();
}

// ========================================
// Manejo del Formulario
// ========================================

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

async function handleFormSubmit(e) {
    e.preventDefault();

    // Ocultar mensajes previos
    hideError();
    hideResults();

    // Validar que haya área o ambientes definidos
    const hasRooms = designState.rooms.length > 0;
    const areaValue = parseFloat(document.getElementById('area').value);
    
    if (!hasRooms && (!areaValue || isNaN(areaValue) || areaValue <= 0)) {
        showError('Debes ingresar un área O definir ambientes en el plano');
        return;
    }

    // Obtener datos del formulario
    const formData = new FormData(form);
    const data = {
        area: hasRooms ? areaValue : parseFloat(formData.get('area')),
        cargaTermicaRequerida: parseFloat(formData.get('cargaTermicaRequerida')),
        tipoDeSuelo: formData.get('tipoDeSuelo'),
        // Usar distancia de waypoints si existe, sino la del formulario
        distanciaAlColector: designState.waypoints.length > 0
            ? calculateWaypointDistance()
            : parseFloat(formData.get('distanciaAlColector')),
        // Enviar distancia de alimentación si existe el motor de diseño
        distanciaAlimentacion: calculateFeedingDistance()
    };

    // Validación básica del lado del cliente
    if (!data.tipoDeSuelo) {
        showError('Por favor seleccione un tipo de suelo');
        return;
    }

    const validationErrors = validateFormData(data);
    if (validationErrors.length > 0) {
        showError(validationErrors.join(' | '));
        return;
    }

    // Mostrar loading
    showLoading();

    try {
        // Llamar al API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            // Error del API
            if (result.details) {
                // Errores de validación
                const errors = result.details.map(d => d.message).join(', ');
                showError(errors);
            } else {
                showError(result.message || 'Error al procesar el cálculo');
            }
            return;
        }

        // Éxito: Mostrar resultados
        renderResults(result.data);

    } catch (error) {
        console.error('Error:', error);
        showError('Error de conexión con el servidor. Verifique que el API esté corriendo.');
    } finally {
        hideLoading();
    }
}

// ========================================
// Renderizado de Resultados
// ========================================

function renderResults(data) {
    // Guardar en el estado global para posterior presupuesto o PDF
    currentCalculation = data;

    // Ocultar estado inicial
    // Ocultar estado inicial
    initialState.classList.add('hidden');

    // Limpiar contenedores
    dataCardsContainer.innerHTML = '';
    advisoryContainer.innerHTML = '';

    // Renderizar tarjetas de datos
    renderDataCards(data);

    // Renderizar mensaje de asesoramiento si existe
    if (data.advisoryMessage) {
        renderAdvisoryMessage(data.advisoryMessage);
    } else {
        advisoryContainer.classList.add('hidden');
    }

    // Actualizar nota de diseño
    designNote.textContent = data.notaDiseno;

    // Renderizar canvas con el esquema técnico
    renderPipeLayout(data);

    // Mostrar contenedor de resultados con animación
    resultsContainer.classList.remove('hidden');
    resultsContainer.classList.add('fade-in');

    // Scroll suave a resultados en tablets
    if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderDataCards(data) {
    const cards = [
        {
            title: 'Longitud Total',
            value: data.longitudTotal,
            unit: 'm',
            icon: '🔄',
            iconClass: 'text-blue-400',
            subtitle: `Serpentina: ${data.longitudSerpentina}m | Acometida: ${data.longitudAcometida}m`
        },
        {
            title: 'Número de Circuitos',
            value: data.numeroCircuitos,
            unit: data.numeroCircuitos === 1 ? 'circuito' : 'circuitos',
            icon: '🔀',
            iconClass: 'text-green-400',
            subtitle: `Máximo 120m por circuito`
        },
        {
            title: 'Paso de Tubería',
            value: data.pasoSeleccionado,
            unit: 'cm',
            icon: '📏',
            iconClass: 'text-purple-400',
            subtitle: `Densidad: ${data.densidadTuberia} m/m²`
        },
        {
            title: 'Potencia Máxima Suelo',
            value: data.potenciaMaximaSuelo,
            unit: 'W/m²',
            icon: '🔥',
            iconClass: 'text-orange-400',
            subtitle: 'Según tipo de acabado'
        }
    ];

    cards.forEach((card, index) => {
        const cardElement = createDataCard(card);
        cardElement.style.animationDelay = `${index * 0.1}s`;
        dataCardsContainer.appendChild(cardElement);
    });

    // Ocultar presupuesto anterior si existía
    if (budgetContainer) budgetContainer.classList.add('hidden');
}

function createDataCard({ title, value, unit, icon, iconClass, subtitle }) {
    const card = document.createElement('div');
    card.className = 'data-card slide-in-right';

    card.innerHTML = `
        <div class="data-card-icon ${iconClass}">${icon}</div>
        <div class="data-card-title">${title}</div>
        <div class="data-card-value">
            ${value}
            <span class="text-2xl font-normal text-gray-400 ml-1">${unit}</span>
        </div>
        ${subtitle ? `<div class="data-card-subtitle">${subtitle}</div>` : ''}
    `;

    return card;
}

function renderAdvisoryMessage(advisory) {
    advisoryContainer.classList.remove('hidden');

    const levelConfig = {
        'CRITICAL': {
            class: 'advisory-alert-critical',
            icon: '⚠️',
            title: 'Advertencia Crítica',
            iconColor: 'text-red-300'
        },
        'WARNING': {
            class: 'advisory-alert-warning',
            icon: '⚡',
            title: 'Advertencia',
            iconColor: 'text-yellow-300'
        },
        'INFO': {
            class: 'advisory-alert-info',
            icon: 'ℹ️',
            title: 'Información Técnica',
            iconColor: 'text-blue-300'
        }
    };

    const config = levelConfig[advisory.level] || levelConfig['INFO'];

    const alertElement = document.createElement('div');
    alertElement.className = `advisory-alert ${config.class}`;

    alertElement.innerHTML = `
        <div class="advisory-header">
            <span class="advisory-icon ${config.iconColor}">${config.icon}</span>
            <h3 class="advisory-title text-white">${config.title}</h3>
        </div>
        <div class="advisory-content">${formatAdvisoryMessage(advisory.message)}</div>
    `;

    advisoryContainer.appendChild(alertElement);
}

function formatAdvisoryMessage(message) {
    // Formatear el mensaje para mejor legibilidad
    return message
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/•/g, '<span class="ml-2">•</span>')
        .replace(/(\d+\.)/g, '<strong>$1</strong>');
}

// ========================================
// Manejo de Presupuesto
// ========================================

function handleGenerateBudget() {
    if (!currentCalculation || !currentCalculation.presupuesto) {
        showError('No hay datos de cálculo disponibles');
        return;
    }

    renderBudgetTable(currentCalculation.presupuesto);

    // Mostrar el contenedor de presupuesto
    budgetContainer.classList.remove('hidden');
    budgetContainer.classList.add('fade-in');

    // Scroll al presupuesto
    budgetContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderBudgetTable(presupuesto) {
    budgetTableBody.innerHTML = '';

    presupuesto.items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-4 border-b border-slate-700">
                <span class="budget-item-name">${item.nombre}</span>
                <span class="budget-item-description">ID: ${item.productoId}</span>
            </td>
            <td class="p-4 border-b border-slate-700 text-center font-mono">${item.cantidad}</td>
            <td class="p-4 border-b border-slate-700 text-center text-gray-400">${item.unidad}</td>
            <td class="p-4 border-b border-slate-700 text-right font-mono">$ ${formatNumber(item.precioUnitario, 2)}</td>
            <td class="p-4 border-b border-slate-700 text-right font-bold text-white font-mono">$ ${formatNumber(item.subtotal, 2)}</td>
        `;
        budgetTableBody.appendChild(row);
    });

    budgetTotal.textContent = `$ ${formatNumber(presupuesto.totalFinal, 2)}`;
}

// ========================================
// Exportación a PDF (jsPDF)
// ========================================

async function handleDownloadPDF() {
    if (!currentCalculation) {
        showError('No hay datos para exportar');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    // 1. Encabezado
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PRESUPUESTO TÉCNICO', 20, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('API PISO RADIANTE - HERRAMIENTA DE INGENIERÍA', 20, 30);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth - 20, 30, { align: 'right' });

    currentY = 55;

    // 2. Información del Proyecto
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. RESUMEN TÉCNICO', 20, currentY);

    currentY += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Área Total: ${currentCalculation.area} m2`, 25, currentY);
    doc.text(`Tipo de Suelo: ${currentCalculation.tipoDeSuelo}`, 100, currentY);
    currentY += 7;
    doc.text(`Paso de Tubería: ${currentCalculation.pasoSeleccionado} cm`, 25, currentY);
    doc.text(`Cantidad de Circuitos: ${currentCalculation.numeroCircuitos}`, 100, currentY);
    currentY += 7;
    doc.text(`Longitud Total de Tubo: ${currentCalculation.longitudTotal} m`, 25, currentY);
    doc.text(`Potencia Máxima Suelo: ${currentCalculation.potenciaMaximaSuelo} W/m2`, 100, currentY);

    currentY += 15;

    // 3. Imagen del Canvas (Esquema)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. ESQUEMA DE TRAZADO', 20, currentY);
    currentY += 10;

    const canvas = document.getElementById('pipe-layout-canvas');
    if (canvas) {
        try {
            const imgData = canvas.toDataURL('image/png');
            // Mantener proporción del canvas (800:600 = 1.33)
            const imgWidth = pageWidth - 40;
            const imgHeight = imgWidth / 1.33;
            doc.addImage(imgData, 'PNG', 20, currentY, imgWidth, imgHeight);
            currentY += imgHeight + 20;
        } catch (e) {
            console.warn('No se pudo añadir el esquema al PDF', e);
            currentY += 10;
        }
    }

    // Nueva página si el presupuesto es largo
    if (currentY > 200) {
        doc.addPage();
        currentY = 20;
    }

    // 4. Detalle de Materiales (Tabla)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. DETALLE DE MATERIALES', 20, currentY);
    currentY += 10;

    // Encabezado de tabla
    doc.setFillColor(241, 245, 249);
    doc.rect(20, currentY, pageWidth - 40, 10, 'F');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('PRODUCTO', 25, currentY + 7);
    doc.text('CANT.', 100, currentY + 7, { align: 'center' });
    doc.text('UNID.', 120, currentY + 7, { align: 'center' });
    doc.text('UNIT.', 150, currentY + 7, { align: 'right' });
    doc.text('SUBTOTAL', pageWidth - 25, currentY + 7, { align: 'right' });

    currentY += 10;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');

    currentCalculation.presupuesto.items.forEach(item => {
        doc.text(item.nombre, 25, currentY + 7);
        doc.text(item.cantidad.toString(), 100, currentY + 7, { align: 'center' });
        doc.text(item.unidad, 120, currentY + 7, { align: 'center' });
        doc.text(`$ ${formatNumber(item.precioUnitario, 2)}`, 150, currentY + 7, { align: 'right' });
        doc.text(`$ ${formatNumber(item.subtotal, 2)}`, pageWidth - 25, currentY + 7, { align: 'right' });

        currentY += 8;
        doc.setDrawColor(226, 232, 240);
        doc.line(20, currentY, pageWidth - 20, currentY);
    });

    currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL GENERAL (USD)', 120, currentY + 7);
    doc.setTextColor(22, 163, 74); // Green-600
    doc.text(`$ ${formatNumber(currentCalculation.presupuesto.totalFinal, 2)}`, pageWidth - 25, currentY + 7, { align: 'right' });

    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Documento generado por API Piso Radiante - Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    // Descargar
    doc.save(`Presupuesto_Piso_Radiante_${new Date().getTime()}.pdf`);
}

// ========================================
// Utilidades de UI
// ========================================

function showLoading() {
    submitBtn.classList.add('hidden');
    loading.classList.remove('hidden');
}

function hideLoading() {
    submitBtn.classList.remove('hidden');
    loading.classList.add('hidden');
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    errorMessage.classList.add('fade-in');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function hideResults() {
    // No ocultar completamente, solo limpiar para nueva consulta
}

// ========================================
// Inicialización
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 API Piso Radiante - Frontend cargado');
    console.log('📡 API URL:', API_URL);

    // Verificar conectividad con el API
    checkAPIStatus();
});

async function checkAPIStatus() {
    try {
        const response = await fetch('/health');
        if (response.ok) {
            console.log('✅ API Status: Online');
        }
    } catch (error) {
        console.warn('⚠️ No se pudo conectar con el API. Asegúrese de que esté corriendo en http://localhost:3000');
    }
}

// ========================================
// Helpers
// ========================================

function formatNumber(num, decimals = 2) {
    return num.toFixed(decimals);
}

// ========================================
// Responsive Utilities
// ========================================

// Detectar cambios de tamaño de pantalla
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const width = window.innerWidth;
        console.log('Viewport width:', width);

        // Recargar página si se pasa de móvil a tablet/desktop o viceversa
        // (opcional, para asegurar que el layout se actualice correctamente)
    }, 250);
});
// ========================================
// Lógica Diseño Avanzado
// ========================================

function handlePlanUpload(e) {
    console.log('handlePlanUpload called', e);
    const file = e.target.files?.[0];
    
    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('File selected:', file.name, file.type);

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
        showError('Por favor seleccione un archivo de imagen válido (PNG, JPG, etc.)');
        planUpload.value = '';
        return;
    }

    // Mostrar nombre del archivo en el label
    const label = document.querySelector('label[for="plan-upload"]');
    if (label) {
        label.innerHTML = `<i class="fas fa-check-circle text-green-400 mr-2"></i>${file.name}`;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        console.log('FileReader onload');
        const img = new Image();
        img.onload = () => {
            console.log('Image loaded successfully');
            designState.backgroundImage = img;
            removePlanBtn.classList.remove('hidden');
            startCalibBtn.classList.remove('hidden');
            showError('✓ Plano cargado: ' + file.name + '. Se recomienda calibrar la escala para mayor precisión.');
        };
        img.onerror = () => {
            console.error('Image load error');
            showError('Error: No se pudo cargar la imagen. Asegúrese de seleccionar un archivo de imagen válido.');
            planUpload.value = '';
        };
        img.src = event.target.result;
    };
    reader.onerror = () => {
        console.error('FileReader error');
        showError('Error: No se pudo leer el archivo.');
        planUpload.value = '';
    };
    reader.readAsDataURL(file);
}

function handleRemovePlan() {
    designState.backgroundImage = null;
    designState.calibration.isCalibrated = false;
    removePlanBtn.classList.add('hidden');
    startCalibBtn.classList.add('hidden');
    calibrationTools.classList.add('hidden');
    planUpload.value = '';
    
    // Restaurar label original
    const label = document.querySelector('label[for="plan-upload"]');
    label.innerHTML = '<i class="fas fa-upload mr-2"></i>Seleccionar Archivo';
    
    showError('✓ Plano removido');
}

function handleStartCalibration() {
    designState.calibration.active = true;
    designState.calibration.points = [];
    calibrationTools.classList.remove('hidden');
    startCalibBtn.classList.add('hidden');
    
    // Mostrar otros botones al calibrar
    document.getElementById('start-room-btn').classList.remove('hidden');
    document.getElementById('start-route-btn').classList.remove('hidden');
    document.getElementById('clear-rooms-btn').classList.remove('hidden');
}

function handleApplyCalibration() {
    if (designState.calibration.points.length !== 2) {
        showError('Debe marcar dos puntos en el plano para calibrar');
        return;
    }

    const realMeters = parseFloat(realDistInput.value);
    if (isNaN(realMeters) || realMeters <= 0) {
        showError('Ingrese una distancia real válida');
        return;
    }

    const p1 = designState.calibration.points[0];
    const p2 = designState.calibration.points[1];
    const pixelDist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

    designState.calibration.metersPerPixel = realMeters / pixelDist;
    designState.calibration.isCalibrated = true;
    designState.calibration.active = false;

    calibrationTools.classList.add('hidden');
    startCalibBtn.classList.remove('hidden');

    showError(`Escala calibrada: ${formatNumber(1 / designState.calibration.metersPerPixel, 0)} px/metro`);
}

function handleCancelCalibration() {
    designState.calibration.active = false;
    designState.calibration.points = [];
    calibrationTools.classList.add('hidden');
    startCalibBtn.classList.remove('hidden');
}

/**
 * Manejador automático cuando se marcan los 2 puntos en el canvas
 */
function onCalibrationPointsSelected() {
    // Abrir el modal en lugar del prompt
    calibModal.classList.remove('hidden');
    // Pequeño delay para la animación de Tailwind
    setTimeout(() => {
        calibModalContent.classList.remove('scale-95', 'opacity-0');
        calibModalContent.classList.add('scale-100', 'opacity-100');
        modalDistInput.value = "";
        modalDistInput.focus();
    }, 10);
}

function closeCalibModal() {
    calibModalContent.classList.remove('scale-100', 'opacity-100');
    calibModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        calibModal.classList.add('hidden');
    }, 300);
}

// ========================================
// Lógica de Múltiples Ambientes
// ========================================

function handleStartRoomDrawing() {
    if (!designState.calibration.isCalibrated) {
        showError("Primero debés calibrar la escala del plano");
        return;
    }

    const roomName = prompt("Nombre del Ambiente (Ej: Habitación 1, Living):", "Ambiente " + (designState.rooms.length + 1));
    if (!roomName) return;

    designState.activeRoomName = roomName;
    designState.isDrawingRoom = true;
    startRoomBtn.classList.add('bg-blue-600', 'text-white');
    interactionHint.textContent = 'Hacé clic y arrastrá en el canvas para dibujar el ambiente.';
    document.getElementById('pipe-layout-canvas').style.cursor = 'crosshair';
}

/**
 * Llamado desde canvasRenderer cuando se termina el rect
 */
function onRoomRectFinished(rect) {
    const scale = designState.calibration.metersPerPixel;
    const realW = Math.abs(rect.w) * scale;
    const realH = Math.abs(rect.h) * scale;
    const area = realW * realH;

    // Buscar si ya existe un ambiente con ese nombre para agruparlo
    let existingRoom = designState.rooms.find(r => r.name === designState.activeRoomName);

    if (existingRoom) {
        existingRoom.rects.push({
            x: rect.w > 0 ? rect.startX : rect.startX + rect.w,
            y: rect.h > 0 ? rect.startY : rect.startY + rect.h,
            w: Math.abs(rect.w),
            h: Math.abs(rect.h)
        });
        existingRoom.area += area;
    } else {
        const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        const color = colors[designState.rooms.length % colors.length];

        designState.rooms.push({
            id: Date.now(),
            name: designState.activeRoomName,
            color: color,
            rects: [{
                x: rect.w > 0 ? rect.startX : rect.startX + rect.w,
                y: rect.h > 0 ? rect.startY : rect.startY + rect.h,
                w: Math.abs(rect.w),
                h: Math.abs(rect.h)
            }],
            area: area
        });
    }

    designState.isDrawingRoom = false;
    startRoomBtn.classList.remove('bg-blue-600', 'text-white');
    document.getElementById('pipe-layout-canvas').style.cursor = 'default';
    interactionHint.textContent = `✓ Ambiente "${designState.activeRoomName}" guardado (Área: ${formatNumber(room.area, 1)} m²). Podés agregar más.`;

    // Mostrar confirmación visual
    showError(`✓ Ambiente agregado: "${room.name}" (${formatNumber(room.area, 1)} m²)`);

    // Recalcular y mostrar advertencias de circuitos
    updateMultiRoomResults();
}

function updateMultiRoomResults() {
    let totalArea = 0;
    let totalLength = 0;
    let warnings = [];

    designState.rooms.forEach(room => {
        totalArea += room.area;

        // Calcular serpentina (aprox 6.7m por m2 para paso 15)
        const serpentina = room.area * 6.7;

        // Calcular conexión vía waypoints
        const distAcometida = calculateWaypointDistanceToRoom(room);
        const totalRoomLength = serpentina + (distAcometida * 2);

        totalLength += totalRoomLength;

        if (totalRoomLength > 120) {
            warnings.push(`El ambiente "${room.name}" requiere MULTIPLES circuitos (${formatNumber(totalRoomLength / 120, 1)} circuitos).`);
        }
    });

    // Actualizar lista visual de ambientes
    updateRoomsList();

    if (warnings.length > 0) {
        showError(warnings.join("<br>"));
    }

    // Actualizar campos del formulario para el cálculo final
    document.getElementById('area').value = formatNumber(totalArea, 1);
    document.getElementById('distancia').value = formatNumber(calculateWaypointDistance(), 1);
}

function updateRoomsList() {
    const roomsListContainer = document.getElementById('rooms-list');
    const roomsItemsContainer = document.getElementById('rooms-items');
    const areaInput = document.getElementById('area');
    const areaInfo = document.getElementById('area-info');
    
    if (designState.rooms.length === 0) {
        roomsListContainer.classList.add('hidden');
        // Permitir edición manual si no hay ambientes
        areaInput.disabled = false;
        areaInput.style.opacity = '1';
        areaInfo.classList.add('hidden');
        return;
    }

    roomsListContainer.classList.remove('hidden');
    
    // Desabilitar campo de área cuando hay ambientes definidos
    areaInput.disabled = true;
    areaInput.style.opacity = '0.6';
    areaInfo.classList.remove('hidden');
    
    roomsItemsContainer.innerHTML = designState.rooms.map((room, idx) => `
        <div class="flex items-center justify-between p-2 bg-slate-800 rounded text-xs">
            <div class="flex items-center space-x-2">
                <div class="w-3 h-3 rounded" style="background-color: ${room.color}"></div>
                <span class="text-gray-300">${room.name}</span>
            </div>
            <span class="text-gray-500">${formatNumber(room.area, 1)} m²</span>
        </div>
    `).join('');
}

function calculateWaypointDistanceToRoom(room) {
    if (designState.waypoints.length === 0) return 0;

    // Distancia del colector a través de todos los waypoints
    const baseDist = calculateWaypointDistance();

    // Más distancia del último waypoint al centro del primer rect del ambiente
    const lastWP = designState.waypoints[designState.waypoints.length - 1];
    const firstRect = room.rects[0];
    const roomCenterX = firstRect.x + firstRect.w / 2;
    const roomCenterY = firstRect.y + firstRect.h / 2;

    const extraPixels = Math.sqrt((lastWP.x - roomCenterX) ** 2 + (lastWP.y - roomCenterY) ** 2);
    return baseDist + (extraPixels * designState.calibration.metersPerPixel);
}

function calculateFeedingDistance() {
    const boiler = designState.objects.find(o => o.id === 'boiler');
    const collector = designState.objects.find(o => o.id === 'collector');

    if (!boiler || !collector) return 0;

    // Distancia Manhattan o Euclidiana? El usuario pide tramo principal.
    // Usamos Euclidiana ajustada por escala
    const pixelDist = Math.sqrt((boiler.x - collector.x) ** 2 + (boiler.y - collector.y) ** 2);
    return pixelDist * designState.calibration.metersPerPixel;
}

// ========================================
// Lógica de Waypoints
// ========================================

function handleStartRouting() {
    designState.isRouting = true;
    designState.waypoints = []; // Limpiar anterior
    startRouteBtn.classList.add('bg-blue-600', 'text-white');
    startRouteBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Marcando Pasillo...';
    interactionHint.textContent = 'Hacé clic en los pasillos. Doble clic o Enter para terminar.';
    document.getElementById('pipe-layout-canvas').style.cursor = 'crosshair';
}

function handleFinishRouting() {
    if (!designState.isRouting) return;

    designState.isRouting = false;
    startRouteBtn.classList.remove('bg-blue-600', 'text-white');
    startRouteBtn.innerHTML = '<i class="fas fa-route mr-2"></i> Trazar Ruta de Pasillo';
    interactionHint.textContent = 'Ruta guardada. Calculá ahora para actualizar presupuesto.';
    document.getElementById('pipe-layout-canvas').style.cursor = 'default';

    // Disparar recálculo si ya hay un cálculo previo
    if (currentCalculation) {
        handleFormSubmit({ preventDefault: () => { } });
    }
}

function calculateWaypointDistance() {
    const collector = designState.objects.find(o => o.id === 'collector');
    if (!collector || designState.waypoints.length === 0) return 0;

    let totalPixels = 0;
    const points = [{ x: collector.x, y: collector.y }, ...designState.waypoints];

    for (let i = 0; i < points.length - 1; i++) {
        const d = Math.sqrt((points[i + 1].x - points[i].x) ** 2 + (points[i + 1].y - points[i].y) ** 2);
        totalPixels += d;
    }

    return totalPixels * designState.calibration.metersPerPixel;
}
