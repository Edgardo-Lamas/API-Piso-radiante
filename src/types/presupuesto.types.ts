export interface ItemPresupuesto {
    productoId: string;
    nombre: string;
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    subtotal: number;
}

export interface ResumenPresupuesto {
    items: ItemPresupuesto[];
    totalMateriales: number;
    desperdicioEstimado: number;
    totalFinal: number;
}

export interface ProductoCatalogo {
    id: string;
    nombre: string;
    descripcion: string;
    precioUnitario: number;
    unidad: string;
    categoria: string;
}

export interface ColectorCatalogo {
    vias: number;
    id: string;
    nombre: string;
    precioUnitario: number;
}

export interface Catalogo {
    productos: ProductoCatalogo[];
    colectores: ColectorCatalogo[];
}
