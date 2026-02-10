import { Request, Response } from 'express';
import { UnderfloorService } from '../services/UnderfloorService';
import { PresupuestoService } from '../services/PresupuestoService';
import { underfloorCalculationSchema } from '../validators/underfloor.validator';
import { ZodError } from 'zod';

export class UnderfloorController {
    private underfloorService: UnderfloorService;
    private presupuestoService: PresupuestoService;

    constructor() {
        this.underfloorService = new UnderfloorService();
        this.presupuestoService = new PresupuestoService();
    }

    /**
     * Procesa la solicitud de cálculo de piso radiante y presupuesto
     */
    public calculate = async (req: Request, res: Response): Promise<void> => {
        try {
            // 1. Validar entrada con Zod
            const input = underfloorCalculationSchema.parse(req.body);

            // 2. Realizar cálculo técnico
            // Nota: Se usa el nombre de método correcto del servicio
            const technicalData = this.underfloorService.calculateUnderfloorHeating(input);

            // 3. Realizar cálculo de presupuesto
            const budgetData = this.presupuestoService.calcularPresupuesto(technicalData, input.area);

            res.status(200).json({
                success: true,
                data: {
                    ...technicalData,
                    presupuesto: budgetData
                }
            });
        } catch (error: any) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Validation Error',
                    details: error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
                return;
            }

            console.error('Error en el cálculo:', error);
            res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: error.message || 'Error al procesar el cálculo'
            });
        }
    };
}
