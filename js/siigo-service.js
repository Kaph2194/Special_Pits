// js/siigo-service.js
import { supabase } from './supabase-config.js';

export class SiigoService {
    constructor() {
        // TODO: Configurar credenciales en variables de entorno
        this.apiUrl = 'https://api.siigo.com';
        this.username = ''; // Configurar en Supabase Edge Functions
        this.accessKey = ''; // Configurar en Supabase Edge Functions
        this.token = null;
        this.tokenExpiry = null;
    }

    // Autenticar con SIIGO
    async autenticar() {
        try {
            // TODO: Implementar con Supabase Edge Function para seguridad
            // Por ahora simulamos la autenticación
            
            const response = await fetch(`${this.apiUrl}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Partner-Id': 'SpecialCar'
                },
                body: JSON.stringify({
                    username: this.username,
                    access_key: this.accessKey
                })
            });

            if (!response.ok) throw new Error('Error autenticando con SIIGO');

            const data = await response.json();
            this.token = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);

            console.log('✅ Autenticado con SIIGO');
            return true;

        } catch (error) {
            console.error('❌ Error SIIGO Auth:', error);
            return false;
        }
    }

    // Verificar si el token está vigente
    async verificarToken() {
        if (!this.token || Date.now() >= this.tokenExpiry) {
            return await this.autenticar();
        }
        return true;
    }

    // Crear factura en SIIGO
    async crearFactura(ordenTrabajo, cliente, items) {
        try {
            await this.verificarToken();

            const facturaSiigo = {
                document: {
                    id: 24660 // ID del tipo de documento en SIIGO (Factura de Venta)
                },
                date: new Date().toISOString().split('T')[0],
                customer: {
                    identification: cliente.nit,
                    branch_office: 0
                },
                cost_center: 4496, // Centro de costos (configurar según SIIGO)
                seller: 629, // ID del vendedor (configurar)
                observations: ordenTrabajo.observaciones_finalizacion || '',
                items: items.map((item, index) => ({
                    code: item.codigo || `ITEM-${index + 1}`,
                    description: item.descripcion,
                    quantity: item.cantidad,
                    price: item.precio_unitario,
                    discount: item.descuento || 0,
                    taxes: [{
                        id: 13156, // ID del IVA 19% en SIIGO
                        value: item.iva
                    }]
                })),
                payments: [{
                    id: 5636, // ID del medio de pago (configurar)
                    value: ordenTrabajo.total,
                    due_date: new Date().toISOString().split('T')[0]
                }]
            };

            // TODO: Implementar con Supabase Edge Function
            const response = await fetch(`${this.apiUrl}/v1/invoices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'Partner-Id': 'SpecialCar'
                },
                body: JSON.stringify(facturaSiigo)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error creando factura en SIIGO');
            }

            const facturaCreada = await response.json();

            // Guardar en nuestra BD
            const { data: facturaLocal, error: dbError } = await supabase
                .from('facturas')
                .insert({
                    ot_id: ordenTrabajo.id,
                    cliente_id: cliente.id,
                    numero_factura: facturaCreada.number,
                    subtotal: ordenTrabajo.subtotal,
                    iva: ordenTrabajo.iva_total,
                    total: ordenTrabajo.total,
                    estado: 'emitida',
                    siigo_id: facturaCreada.id,
                    siigo_pdf_url: facturaCreada.pdf_url || null
                })
                .select()
                .single();

            if (dbError) throw dbError;

            return {
                success: true,
                factura: facturaLocal,
                siigo: facturaCreada
            };

        } catch (error) {
            console.error('Error creando factura SIIGO:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Obtener PDF de factura
    async obtenerPDFFactura(siigoId) {
        try {
            await this.verificarToken();

            const response = await fetch(`${this.apiUrl}/v1/invoices/${siigoId}/pdf`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Partner-Id': 'SpecialCar'
                }
            });

            if (!response.ok) throw new Error('Error obteniendo PDF');

            const blob = await response.blob();
            return URL.createObjectURL(blob);

        } catch (error) {
            console.error('Error obteniendo PDF:', error);
            return null;
        }
    }

    // Anular factura
    async anularFactura(siigoId, motivo) {
        try {
            await this.verificarToken();

            const response = await fetch(`${this.apiUrl}/v1/invoices/${siigoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Partner-Id': 'SpecialCar',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ observations: motivo })
            });

            if (!response.ok) throw new Error('Error anulando factura');

            return { success: true };

        } catch (error) {
            console.error('Error anulando factura:', error);
            return { success: false, error: error.message };
        }
    }

    // Consultar cliente en SIIGO
    async consultarCliente(nit) {
        try {
            await this.verificarToken();

            const response = await fetch(
                `${this.apiUrl}/v1/customers?identification=${nit}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Partner-Id': 'SpecialCar'
                    }
                }
            );

            if (!response.ok) return null;

            const data = await response.json();
            return data.results?.[0] || null;

        } catch (error) {
            console.error('Error consultando cliente:', error);
            return null;
        }
    }

    // Crear cliente en SIIGO
    async crearCliente(cliente) {
        try {
            await this.verificarToken();

            const clienteSiigo = {
                type: 'Customer',
                person_type: 'Company',
                id_type: {
                    code: '31' // NIT
                },
                identification: cliente.nit,
                name: [cliente.razon_social],
                commercial_name: cliente.razon_social,
                branch_office: 0,
                active: true,
                vat_responsible: true,
                fiscal_responsibilities: [{
                    code: 'R-99-PN' // Responsabilidad fiscal
                }],
                address: {
                    address: cliente.direccion || '',
                    city: {
                        city_code: '11001', // Bogotá (ajustar según ciudad)
                        state_code: '11'
                    }
                },
                phones: [{
                    number: cliente.telefono
                }],
                contacts: [{
                    first_name: cliente.razon_social.split(' ')[0],
                    email: cliente.email
                }]
            };

            const response = await fetch(`${this.apiUrl}/v1/customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'Partner-Id': 'SpecialCar'
                },
                body: JSON.stringify(clienteSiigo)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error creando cliente');
            }

            return await response.json();

        } catch (error) {
            console.error('Error creando cliente SIIGO:', error);
            return null;
        }
    }
}

// Mock para desarrollo (sin credenciales reales)
export class SiigoServiceMock {
    async crearFactura(ordenTrabajo, cliente, items) {
        // Simular delay de API
        await new Promise(resolve => setTimeout(resolve, 1500));

        const numeroFactura = `FAC-${Date.now().toString().slice(-8)}`;

        const { data: facturaLocal, error } = await supabase
            .from('facturas')
            .insert({
                ot_id: ordenTrabajo.id,
                cliente_id: cliente.id,
                numero_factura: numeroFactura,
                subtotal: ordenTrabajo.subtotal,
                iva: ordenTrabajo.iva_total,
                total: ordenTrabajo.total,
                estado: 'emitida',
                metodo_pago: 'efectivo',
                siigo_id: `MOCK-${Date.now()}`,
                siigo_pdf_url: null
            })
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            factura: facturaLocal,
            siigo: {
                id: `MOCK-${Date.now()}`,
                number: numeroFactura,
                pdf_url: null
            }
        };
    }

    async obtenerPDFFactura(siigoId) {
        console.log('Mock: Obteniendo PDF', siigoId);
        return null;
    }

    async anularFactura(siigoId, motivo) {
        console.log('Mock: Anulando factura', siigoId, motivo);
        return { success: true };
    }
}

// Exportar la versión a usar (cambiar a SiigoService cuando tengas credenciales)
export const siigoService = new SiigoServiceMock();