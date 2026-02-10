/**
 * Tipos de suelo disponibles para piso radiante
 */
export enum TipoDeSuelo {
    PETREO = 'PETREO',
    MADERA_MACIZA = 'MADERA_MACIZA',
    MADERA_FLOTANTE = 'MADERA_FLOTANTE',
    MOQUETA = 'MOQUETA'
}

/**
 * Nivel de advertencia del mensaje de asesoramiento
 */
export enum AdvisoryLevel {
    INFO = 'INFO',
    WARNING = 'WARNING',
    CRITICAL = 'CRITICAL'
}

/**
 * Datos de entrada para el cálculo de piso radiante
 */
export interface UnderfloorCalculationInput {
    /** Área total a calefaccionar en m² */
    area: number;

    /** Carga térmica requerida en W/m² */
    cargaTermicaRequerida: number;

    /** Tipo de suelo de acabado */
    tipoDeSuelo: TipoDeSuelo;

    /** Distancia lineal desde el colector a la puerta de la habitación en metros */
    distanciaAlColector: number;

    /** Distancia entre Caldera y Colector para alimentación (opcional, diseño avanzado) */
    distanciaAlimentacion?: number;
}

/**
 * Configuración de suelo
 */
export interface FloorConfig {
    /** Potencia máxima de emisión en W/m² */
    maxPower: number;

    /** Indica si requiere forzar paso de 15cm */
    requiresStep15: boolean;
}

/**
 * Configuración de paso de tubería
 */
export interface PipeStepConfig {
    /** Paso en centímetros */
    stepCm: number;

    /** Densidad de tubería en m/m² */
    density: number;
}

/**
 * Mensaje de asesoramiento técnico
 */
export interface AdvisoryMessage {
    /** Nivel de la advertencia */
    level: AdvisoryLevel;

    /** Mensaje de asesoramiento */
    message: string;
}

/**
 * Resultado del cálculo de piso radiante
 */
export interface UnderfloorCalculationOutput {
    /** Paso seleccionado en cm */
    pasoSeleccionado: number;

    /** Densidad de tubería en m/m² */
    densidadTuberia: number;

    /** Longitud de serpentina en metros */
    longitudSerpentina: number;

    /** Longitud de acometida (ida y vuelta) en metros */
    longitudAcometida: number;

    /** Longitud total de tubería en metros */
    longitudTotal: number;

    /** Número de circuitos necesarios */
    numeroCircuitos: number;

    /** Potencia máxima de emisión del suelo en W/m² */
    potenciaMaximaSuelo: number;

    /** Mensaje de asesoramiento técnico (opcional) */
    advisoryMessage?: AdvisoryMessage;

    /** Nota de diseño profesional */
    notaDiseno: string;

    /** Distancia entre Caldera y Colector para alimentación (opcional, diseño avanzado) */
    distanciaAlimentacion?: number;
}
