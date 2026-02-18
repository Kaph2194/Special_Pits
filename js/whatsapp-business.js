// js/whatsapp-business.js
import { supabase } from './supabase-config.js';

export class WhatsAppBusinessService {
    constructor() {
        // TODO: Configurar en Supabase Edge Functions
        this.apiUrl = 'https://graph.facebook.com/v18.0';
        this.phoneNumberId = ''; // ID del número de teléfono en Meta
        this.accessToken = ''; // Token de acceso de Meta Business
    }

    // Enviar mensaje de texto
    async enviarMensaje(telefono, mensaje, tipo = 'text', relacionadoId = null) {
        try {
            // Limpiar y formatear teléfono
            const telefonoLimpio = telefono.replace(/[^0-9]/g, '');
            const telefonoInternacional = telefonoLimpio.startsWith('57') 
                ? telefonoLimpio 
                : `57${telefonoLimpio}`;

            // Registrar en BD antes de enviar
            const { data: notif, error: dbError } = await supabase
                .from('notificaciones_whatsapp')
                .insert({
                    destinatario_telefono: telefonoInternacional,
                    mensaje: mensaje,
                    tipo: tipo,
                    relacionado_id: relacionadoId,
                    relacionado_tipo: tipo,
                    enviado: false
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // TODO: Implementar con Supabase Edge Function
            const response = await fetch(
                `${this.apiUrl}/${this.phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: telefonoInternacional,
                        type: 'text',
                        text: {
                            preview_url: false,
                            body: mensaje
                        }
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Error enviando mensaje');
            }

            const data = await response.json();

            // Actualizar como enviado
            await supabase
                .from('notificaciones_whatsapp')
                .update({
                    enviado: true,
                    fecha_envio: new Date().toISOString(),
                    respuesta_api: data
                })
                .eq('id', notif.id);

            console.log('✅ WhatsApp enviado:', data.messages[0].id);

            return {
                success: true,
                messageId: data.messages[0].id,
                notifId: notif.id
            };

        } catch (error) {
            console.error('❌ Error WhatsApp:', error);

            // Registrar error
            if (notif?.id) {
                await supabase
                    .from('notificaciones_whatsapp')
                    .update({
                        error_envio: error.message,
                        intentos: supabase.raw('intentos + 1')
                    })
                    .eq('id', notif.id);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    // Enviar plantilla (template)
    async enviarPlantilla(telefono, templateName, templateParams, relacionadoId = null) {
        try {
            const telefonoLimpio = telefono.replace(/[^0-9]/g, '');
            const telefonoInternacional = telefonoLimpio.startsWith('57') 
                ? telefonoLimpio 
                : `57${telefonoLimpio}`;

            const response = await fetch(
                `${this.apiUrl}/${this.phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: telefonoInternacional,
                        type: 'template',
                        template: {
                            name: templateName,
                            language: {
                                code: 'es'
                            },
                            components: templateParams
                        }
                    })
                }
            );

            if (!response.ok) throw new Error('Error enviando plantilla');

            const data = await response.json();

            // Registrar en BD
            await supabase.from('notificaciones_whatsapp').insert({
                destinatario_telefono: telefonoInternacional,
                mensaje: `Template: ${templateName}`,
                tipo: 'template',
                relacionado_id: relacionadoId,
                enviado: true,
                fecha_envio: new Date().toISOString(),
                respuesta_api: data
            });

            return {
                success: true,
                messageId: data.messages[0].id
            };

        } catch (error) {
            console.error('Error plantilla WhatsApp:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Notificaciones predefinidas

    async notificarOTCompletada(ot) {
        const mensaje = `🔧 *Special Car*\n\n` +
            `Su vehículo *${ot.vehiculo_placa}* ha finalizado su servicio.\n\n` +
            `📋 Orden de Trabajo: *${ot.numero_ot}*\n` +
            `💰 Total: *${this.formatearMoneda(ot.total)}*\n\n` +
            `${ot.recomendaciones ? `💡 Recomendaciones:\n${ot.recomendaciones}\n\n` : ''}` +
            `Por favor acérquese a nuestro taller para retirar su vehículo.\n\n` +
            `📍 Special Car - Servicio Automotriz\n` +
            `📞 ${ot.jefe_taller_telefono || '300 123 4567'}`;

        return await this.enviarMensaje(
            ot.cliente_telefono,
            mensaje,
            'ot_completada',
            ot.id
        );
    }

    async notificarCotizacionAprobada(cotizacion) {
        const mensaje = `📋 *Special Car*\n\n` +
            `Su cotización ha sido aprobada.\n\n` +
            `📄 Folio: *${cotizacion.folio}*\n` +
            `🚙 Vehículo: *${cotizacion.vehiculo_placa}*\n` +
            `💰 Total: *${this.formatearMoneda(cotizacion.total)}*\n\n` +
            `Procederemos a realizar el servicio en las próximas horas.\n` +
            `Le notificaremos cuando esté listo.\n\n` +
            `Gracias por confiar en nosotros! 🙌`;

        return await this.enviarMensaje(
            cotizacion.cliente_telefono,
            mensaje,
            'cotizacion_aprobada',
            cotizacion.id
        );
    }

    async notificarSolicitudModificacion(solicitud, jefetelefono) {
        const mensaje = `⚠️ *Special Car - Nueva Solicitud*\n\n` +
            `El mecánico *${solicitud.mecanico_nombre}* solicita autorización:\n\n` +
            `📋 OT: *${solicitud.numero_ot}*\n` +
            `🚙 Vehículo: *${solicitud.vehiculo_placa}*\n` +
            `📝 Tipo: *${solicitud.tipo_solicitud}*\n\n` +
            `💬 Descripción:\n${solicitud.descripcion}\n\n` +
            `Por favor revise el sistema para aprobar o rechazar.`;

        return await this.enviarMensaje(
            jefetelefono,
            mensaje,
            'solicitud_modificacion',
            solicitud.id
        );
    }

    async notificarFacturaEmitida(factura) {
        const mensaje = `💰 *Special Car - Factura Emitida*\n\n` +
            `Su factura ha sido generada exitosamente.\n\n` +
            `📄 No. Factura: *${factura.numero_factura}*\n` +
            `💵 Total: *${this.formatearMoneda(factura.total)}*\n\n` +
            `${factura.siigo_pdf_url ? `Puede descargar su factura en:\n${factura.siigo_pdf_url}\n\n` : ''}` +
            `Gracias por su preferencia! 🙏`;

        return await this.enviarMensaje(
            factura.cliente_telefono,
            mensaje,
            'factura_emitida',
            factura.id
        );
    }

    formatearMoneda(valor) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(valor);
    }
}

// Mock para desarrollo (sin credenciales)
export class WhatsAppBusinessServiceMock {
    async enviarMensaje(telefono, mensaje, tipo, relacionadoId) {
        console.log('📱 Mock WhatsApp:', {telefono, mensaje: mensaje.substring(0, 50)});

        const telefonoLimpio = telefono.replace(/[^0-9]/g, '');
        const telefonoInternacional = telefonoLimpio.startsWith('57') 
            ? telefonoLimpio 
            : `57${telefonoLimpio}`;

        // Simular delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Guardar en BD
        const { data, error } = await supabase
            .from('notificaciones_whatsapp')
            .insert({
                destinatario_telefono: telefonoInternacional,
                mensaje: mensaje,
                tipo: tipo,
                relacionado_id: relacionadoId,
                enviado: true,
                fecha_envio: new Date().toISOString(),
                respuesta_api: { mock: true, messageId: `MOCK-${Date.now()}` }
            })
            .select()
            .single();

        if (error) throw error;

        // Generar URL de WhatsApp Web
        const mensajeCodificado = encodeURIComponent(mensaje);
        const urlWhatsApp = `https://wa.me/${telefonoInternacional}?text=${mensajeCodificado}`;

        console.log('🔗 URL WhatsApp:', urlWhatsApp);

        return {
            success: true,
            messageId: `MOCK-${Date.now()}`,
            url: urlWhatsApp,
            notifId: data.id
        };
    }

    async notificarOTCompletada(ot) {
        const mensaje = `🔧 Special Car\n\nSu vehículo ${ot.vehiculo_placa} ha finalizado.\nOT: ${ot.numero_ot}\nTotal: $${ot.total}`;
        return await this.enviarMensaje(ot.cliente_telefono, mensaje, 'ot_completada', ot.id);
    }

    async notificarCotizacionAprobada(cotizacion) {
        const mensaje = `📋 Special Car\n\nCotización ${cotizacion.folio} aprobada.\nVehículo: ${cotizacion.vehiculo_placa}`;
        return await this.enviarMensaje(cotizacion.cliente_telefono, mensaje, 'cotizacion_aprobada', cotizacion.id);
    }

    async notificarSolicitudModificacion(solicitud, jefetelefono) {
        const mensaje = `⚠️ Nueva solicitud de ${solicitud.mecanico_nombre}\nOT: ${solicitud.numero_ot}`;
        return await this.enviarMensaje(jefetelefono, mensaje, 'solicitud_modificacion', solicitud.id);
    }

    async notificarFacturaEmitida(factura) {
        const mensaje = `💰 Factura ${factura.numero_factura} emitida\nTotal: $${factura.total}`;
        return await this.enviarMensaje(factura.cliente_telefono, mensaje, 'factura_emitida', factura.id);
    }
}

// Exportar versión a usar
export const whatsappService = new WhatsAppBusinessServiceMock();