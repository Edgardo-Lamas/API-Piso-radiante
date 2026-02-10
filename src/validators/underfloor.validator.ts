import { z } from 'zod';
import { TipoDeSuelo } from '../types/underfloor.types';

/**
 * Schema de validación para el input de cálculo de piso radiante
 */
export const underfloorCalculationSchema = z.object({
    area: z.number()
        .positive({ message: 'El área debe ser un número positivo' })
        .min(1, { message: 'El área debe ser al menos 1 m²' })
        .max(1000, { message: 'El área no puede exceder 1000 m²' }),

    cargaTermicaRequerida: z.number()
        .positive({ message: 'La carga térmica debe ser un número positivo' })
        .min(10, { message: 'La carga térmica debe ser al menos 10 W/m²' })
        .max(150, { message: 'La carga térmica no puede exceder 150 W/m²' }),

    tipoDeSuelo: z.nativeEnum(TipoDeSuelo, {
        errorMap: () => ({
            message: `El tipo de suelo debe ser uno de: ${Object.values(TipoDeSuelo).join(', ')}`
        })
    }),

    distanciaAlColector: z.number()
        .nonnegative({ message: 'La distancia al colector no puede ser negativa' })
        .max(50, { message: 'La distancia al colector no puede exceder 50 metros' }),

    distanciaAlimentacion: z.number().optional()
});

export type UnderfloorCalculationSchema = z.infer<typeof underfloorCalculationSchema>;
