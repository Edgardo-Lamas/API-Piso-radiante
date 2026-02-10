import { Router } from 'express';
import { UnderfloorController } from '../controllers/underfloorController';

const router = Router();
const underfloorController = new UnderfloorController();

/**
 * POST /api/v1/underfloor/calculate
 * Calcula los parámetros de instalación de piso radiante
 */
router.post('/calculate', (req, res) => underfloorController.calculate(req, res));

export default router;
