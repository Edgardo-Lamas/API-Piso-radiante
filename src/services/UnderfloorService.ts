import {
    TipoDeSuelo,
    AdvisoryLevel,
    UnderfloorCalculationInput,
    UnderfloorCalculationOutput,
    FloorConfig,
    PipeStepConfig,
    AdvisoryMessage
} from '../types/underfloor.types';

/**
 * Tabla de configuración por tipo de suelo
 */
const FLOOR_CONFIG_TABLE: Record<TipoDeSuelo, FloorConfig> = {
    [TipoDeSuelo.PETREO]: {
        maxPower: 100,
        requiresStep15: false
    },
    [TipoDeSuelo.MADERA_MACIZA]: {
        maxPower: 70,
        requiresStep15: false
    },
    [TipoDeSuelo.MADERA_FLOTANTE]: {
        maxPower: 60,
        requiresStep15: true
    },
    [TipoDeSuelo.MOQUETA]: {
        maxPower: 60,
        requiresStep15: true
    }
};

/**
 * Configuraciones de paso de tubería
 */
const PIPE_STEP_15CM: PipeStepConfig = {
    stepCm: 15,
    density: 6.7
};

const PIPE_STEP_20CM: PipeStepConfig = {
    stepCm: 20,
    density: 5.0
};

/**
 * Longitud máxima por circuito en metros
 */
const MAX_CIRCUIT_LENGTH = 120;

/**
 * Nota de diseño profesional estándar
 */
const DESIGN_NOTE = 'Diseño profesional con Tubería PE-X 20mm sin barrera de oxígeno. Trazado calculado según recorrido real por pasillos.';

/**
 * Servicio de cálculo de piso radiante
 */
export class UnderfloorService {
    /**
     * Calcula todos los parámetros de piso radiante
     */
    public calculateUnderfloorHeating(input: UnderfloorCalculationInput): UnderfloorCalculationOutput {
        // 1. Seleccionar paso de tubería
        const pipeStep = this.selectPipeStep(input.cargaTermicaRequerida, input.tipoDeSuelo);

        // 2. Calcular longitudes
        const longitudSerpentina = this.calculateSerpentinaLength(input.area, pipeStep.density);
        const longitudAcometida = this.calculateAcometidaLength(input.distanciaAlColector);
        const longitudTotal = longitudSerpentina + longitudAcometida;

        // 3. Calcular número de circuitos
        const numeroCircuitos = this.calculateNumberOfCircuits(longitudTotal);

        // 4. Obtener potencia máxima del suelo
        const floorConfig = FLOOR_CONFIG_TABLE[input.tipoDeSuelo];
        const potenciaMaximaSuelo = floorConfig.maxPower;

        // 5. Generar mensaje de asesoramiento si es necesario
        const advisoryMessage = this.generateAdvisoryMessage(input, longitudTotal, potenciaMaximaSuelo);

        // 6. Construir respuesta
        const result: UnderfloorCalculationOutput = {
            pasoSeleccionado: pipeStep.stepCm,
            densidadTuberia: pipeStep.density,
            longitudSerpentina: Math.round(longitudSerpentina * 100) / 100,
            longitudAcometida: Math.round(longitudAcometida * 100) / 100,
            longitudTotal: Math.round(longitudTotal * 100) / 100,
            numeroCircuitos,
            potenciaMaximaSuelo,
            notaDiseno: DESIGN_NOTE,
            distanciaAlimentacion: input.distanciaAlimentacion
        };

        if (advisoryMessage) {
            result.advisoryMessage = advisoryMessage;
        }

        return result;
    }

    /**
     * Selecciona el paso de tubería según la carga térmica y tipo de suelo
     * 
     * Lógica:
     * - Si carga > 70 W/m² → Paso 15cm (Densidad: 6.7 m/m²)
     * - Si carga ≤ 70 W/m² → Paso 20cm (Densidad: 5 m/m²)
     * - Excepción: Madera o Moqueta → forzar Paso 15cm
     */
    private selectPipeStep(cargaTermica: number, tipoDeSuelo: TipoDeSuelo): PipeStepConfig {
        const floorConfig = FLOOR_CONFIG_TABLE[tipoDeSuelo];

        // Forzar paso 15cm para madera flotante o moqueta
        if (floorConfig.requiresStep15) {
            return PIPE_STEP_15CM;
        }

        // Seleccionar según carga térmica
        if (cargaTermica > 70) {
            return PIPE_STEP_15CM;
        }

        return PIPE_STEP_20CM;
    }

    /**
     * Calcula la longitud de serpentina
     * Fórmula: L_serpentina = area × Densidad
     */
    private calculateSerpentinaLength(area: number, density: number): number {
        return area * density;
    }

    /**
     * Calcula la longitud de acometida (ida y vuelta)
     * Desde la caldera al colector y retorno.
     * Fórmula: L_acometida = distanciaAlColector × 2 (ida + vuelta)
     * 
     * Esta distancia es crítica para:
     * - Junto con la demanda de los circuitos, determina el diámetro de la tubería de alimentación
     * - Calcular la pérdida de carga en el tramo de alimentación
     * - Seleccionar la bomba de circulación correcta
     */
    private calculateAcometidaLength(distanciaAlColector: number): number {
        return distanciaAlColector * 2;
    }

    /**
     * Calcula el número de circuitos necesarios
     * Fórmula: N_circuitos = ceil(L_total / 120)
     */
    private calculateNumberOfCircuits(longitudTotal: number): number {
        return Math.ceil(longitudTotal / MAX_CIRCUIT_LENGTH);
    }

    /**
     * Genera mensaje de asesoramiento profesional si es necesario
     * 
     * Alertas:
     * 1. Pérdida de Carga: Si L_total > 120m → sugerir división en circuitos
     * 2. Suelo Crítico: Si suelo es Madera Flotante o Moqueta y carga > 60 W/m²
     */
    private generateAdvisoryMessage(
        input: UnderfloorCalculationInput,
        longitudTotal: number,
        potenciaMaximaSuelo: number
    ): AdvisoryMessage | undefined {
        const messages: string[] = [];
        let level: AdvisoryLevel = AdvisoryLevel.INFO;

        // Alerta de Pérdida de Carga
        if (longitudTotal > MAX_CIRCUIT_LENGTH) {
            const numCircuitos = Math.ceil(longitudTotal / MAX_CIRCUIT_LENGTH);
            messages.push(
                `⚠️ PÉRDIDA DE CARGA: La longitud total (${Math.round(longitudTotal)}m) excede los ${MAX_CIRCUIT_LENGTH}m recomendados. ` +
                `Se sugiere dividir en ${numCircuitos} circuitos para mantener una pérdida de carga aceptable y garantizar el caudal adecuado.`
            );
            level = AdvisoryLevel.WARNING;
        }

        // Alerta de Suelo Crítica
        const isMaderaFlotante = input.tipoDeSuelo === TipoDeSuelo.MADERA_FLOTANTE;
        const isMoqueta = input.tipoDeSuelo === TipoDeSuelo.MOQUETA;
        const exceedsPower = input.cargaTermicaRequerida > potenciaMaximaSuelo;

        if ((isMaderaFlotante || isMoqueta) && exceedsPower) {
            messages.push(
                `🚨 ADVERTENCIA CRÍTICA - SUELO INADECUADO:\n\n` +
                `El tipo de suelo seleccionado (${input.tipoDeSuelo}) presenta alta resistencia térmica y limita la potencia de emisión a ${potenciaMaximaSuelo} W/m². ` +
                `La carga térmica requerida (${input.cargaTermicaRequerida} W/m²) SUPERA esta capacidad.\n\n` +
                `📉 IMPACTO TÉCNICO:\n` +
                `• Reducción significativa de potencia útil\n` +
                `• Mayor inercia térmica (respuesta lenta)\n` +
                `• Posible insuficiencia de calefacción\n` +
                `• Riesgo de disconfort térmico\n\n` +
                `✅ RECOMENDACIONES PROFESIONALES:\n` +
                `1. CAMBIAR A ACABADO PÉTREO (cerámica, porcelanato, piedra): Permite hasta 100 W/m² con mejor respuesta térmica\n` +
                `2. CONSIDERAR SISTEMA DE RADIADORES: Mayor capacidad de emisión y control independiente por ambiente\n` +
                `3. REDISEÑO TÉRMICO: Mejorar aislación para reducir la carga térmica requerida\n\n` +
                `⚠️ No se recomienda proceder con la instalación bajo estas condiciones sin modificar el diseño.`
            );
            level = AdvisoryLevel.CRITICAL;
        } else if ((isMaderaFlotante || isMoqueta) && !exceedsPower) {
            messages.push(
                `ℹ️ INFORMACIÓN TÉCNICA:\n\n` +
                `El suelo ${input.tipoDeSuelo} tiene una resistencia térmica elevada que limita la emisión a ${potenciaMaximaSuelo} W/m². ` +
                `Aunque la carga requerida (${input.cargaTermicaRequerida} W/m²) está dentro del rango, considere:\n\n` +
                `• Mayor tiempo de calentamiento (alta inercia)\n` +
                `• Respuesta más lenta a cambios de temperatura\n` +
                `• Para mejor rendimiento, considere acabados pétreos en zonas de mayor uso`
            );
            level = AdvisoryLevel.INFO;
        }

        if (messages.length === 0) {
            return undefined;
        }

        return {
            level,
            message: messages.join('\n\n')
        };
    }
}
