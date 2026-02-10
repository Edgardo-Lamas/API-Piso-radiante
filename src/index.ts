import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import underfloorRoutes from './routes/underfloorRoutes';

// Cargar variables de entorno
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'OK',
        service: 'API Piso Radiante',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/v1/underfloor', underfloorRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
        message: 'API Piso Radiante - Servicio de Cálculo y Asesoramiento',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            calculate: 'POST /api/v1/underfloor/calculate'
        },
        documentation: {
            calculate: {
                method: 'POST',
                url: '/api/v1/underfloor/calculate',
                body: {
                    area: 'number (m²)',
                    cargaTermicaRequerida: 'number (W/m²)',
                    tipoDeSuelo: 'PETREO | MADERA_MACIZA | MADERA_FLOTANTE | MOQUETA',
                    distanciaAlColector: 'number (m)'
                }
            }
        }
    });
});

// Ruta para la aplicación web
app.get('/app', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 Handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} no encontrado`
    });
});

// Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🔥 API PISO RADIANTE - Servicio de Cálculo');
    console.log('='.repeat(60));
    console.log(`📡 Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`🌐 Aplicación web: http://localhost:${PORT}/app`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Endpoint de cálculo: POST http://localhost:${PORT}/api/v1/underfloor/calculate`);
    console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(60));
});

export default app;
