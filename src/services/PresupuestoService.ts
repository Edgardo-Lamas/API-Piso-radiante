import { UnderfloorCalculationOutput } from '../types/underfloor.types';
import { ResumenPresupuesto, Catalogo, ItemPresupuesto } from '../types/presupuesto.types';
import * as fs from 'fs';
import * as path from 'path';

export class PresupuestoService {
    private catalogo: Catalogo;

    constructor() {
        const catalogoPath = path.join(__dirname, '../data/catalogo.json');
        this.catalogo = JSON.parse(fs.readFileSync(catalogoPath, 'utf-8'));
    }

    public calcularPresupuesto(
        techData: UnderfloorCalculationOutput,
        area: number
    ): ResumenPresupuesto {
        const items: ItemPresupuesto[] = [];
        const PERCENT_WASTE = 1.05; // 5% desperdicio

        // 1. Tubo PEX
        const tuboCatalogo = this.catalogo.productos.find(p => p.id === 'TUB-PEX-20');
        if (tuboCatalogo) {
            const cantidadConDesperdicio = techData.longitudTotal * PERCENT_WASTE;
            items.push(this.crearItem(tuboCatalogo.id, tuboCatalogo.nombre, Math.ceil(cantidadConDesperdicio), tuboCatalogo.unidad, tuboCatalogo.precioUnitario));
        }

        // 2. Placa Aislante
        const placaCatalogo = this.catalogo.productos.find(p => p.id === 'PLA-AIS-EPS');
        if (placaCatalogo) {
            items.push(this.crearItem(placaCatalogo.id, placaCatalogo.nombre, Math.ceil(area), placaCatalogo.unidad, placaCatalogo.precioUnitario));
        }

        // 3. Banda Perimetral (Estimación: perímetro de un cuadrado mas 20% margen)
        const bandaCatalogo = this.catalogo.productos.find(p => p.id === 'BAN-PER-PE');
        if (bandaCatalogo) {
            const perimetroEstimado = (Math.sqrt(area) * 4) * 1.2;
            items.push(this.crearItem(bandaCatalogo.id, bandaCatalogo.nombre, Math.ceil(perimetroEstimado), bandaCatalogo.unidad, bandaCatalogo.precioUnitario));
        }

        // 4. Malla Electrosoldada
        const mallaCatalogo = this.catalogo.productos.find(p => p.id === 'MAL-ELE-42');
        if (mallaCatalogo) {
            items.push(this.crearItem(mallaCatalogo.id, mallaCatalogo.nombre, Math.ceil(area), mallaCatalogo.unidad, mallaCatalogo.precioUnitario));
        }

        // 5. Precintos (1 bolsa cada 100m)
        const precintosCatalogo = this.catalogo.productos.find(p => p.id === 'PRE-SUJ-BOL');
        if (precintosCatalogo) {
            const bolsasTotales = Math.ceil(techData.longitudTotal / 100);
            items.push(this.crearItem(precintosCatalogo.id, precintosCatalogo.nombre, bolsasTotales, precintosCatalogo.unidad, precintosCatalogo.precioUnitario));
        }

        // 6. Tubería de Alimentación 1" (Diseño Avanzado)
        const distAlim = techData.distanciaAlimentacion || 0;
        if (distAlim > 0) {
            const tubo1 = this.catalogo.productos.find(p => p.id === 'TUB-ALIM-1P');
            const aisla1 = this.catalogo.productos.find(p => p.id === 'AIS-ALIM-1P');

            if (tubo1) items.push(this.crearItem(tubo1.id, tubo1.nombre, Math.ceil(distAlim), tubo1.unidad, tubo1.precioUnitario));
            if (aisla1) items.push(this.crearItem(aisla1.id, aisla1.nombre, Math.ceil(distAlim), aisla1.unidad, aisla1.precioUnitario));
        }

        // 7. Colector, Válvulas y Gabinete
        const colector = this.seleccionarColector(techData.numeroCircuitos);
        if (colector) {
            items.push(this.crearItem(colector.id, colector.nombre, 1, 'un', colector.precioUnitario));

            // Auto-añadir Válvulas y Gabinete
            const valVulasPar = this.catalogo.productos.find(p => p.id === 'VAL-ESF-PAR');
            if (valVulasPar) {
                items.push(this.crearItem(valVulasPar.id, valVulasPar.nombre, 1, valVulasPar.unidad, valVulasPar.precioUnitario));
            }

            const gabinete = this.catalogo.productos.find(p => p.id === 'GAB-MET-COL');
            if (gabinete) {
                items.push(this.crearItem(gabinete.id, gabinete.nombre, 1, gabinete.unidad, gabinete.precioUnitario));
            }
        }

        const totalMateriales = items.reduce((acc, item) => acc + item.subtotal, 0);

        return {
            items,
            totalMateriales,
            desperdicioEstimado: techData.longitudTotal * 0.05,
            totalFinal: totalMateriales
        };
    }

    private seleccionarColector(nCircuitos: number) {
        return this.catalogo.colectores
            .sort((a, b) => a.vias - b.vias)
            .find(c => c.vias >= nCircuitos);
    }

    private crearItem(id: string, nombre: string, cantidad: number, unidad: string, precio: number): ItemPresupuesto {
        return {
            productoId: id,
            nombre,
            cantidad,
            unidad,
            precioUnitario: precio,
            subtotal: cantidad * precio
        };
    }
}
