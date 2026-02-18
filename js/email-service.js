// js/email-service.js
import { supabase } from './supabase-config.js';
import { formatearMoneda, formatearFecha } from './utils.js';

// ============================================
// ENVIAR EMAIL CON PDF
// ============================================
export async function enviarEmailConPDF(config) {
    const {
        destinatario,
        destinatarioNombre,
        asunto,
        tipo, // 'cotizacion' o 'inspeccion'
        relacionadoId,
        pdfUrl,
        pdfNombre,
        datosAdicionales = {}
    } = config;
    
    try {
        // Obtener plantilla
        const { data: plantilla } = await supabase
            .from('plantillas_email')
            .select('*')
            .eq('nombre', tipo === 'cotizacion' ? 'cotizacion_enviada' : 'inspeccion_enviada')
            .single();
        
        // Reemplazar variables en la plantilla
        let cuerpoHTML = plantilla?.cuerpo_html || '';
        Object.keys(datosAdicionales).forEach(key => {
            const regex = new RegExp(`{${key}}`, 'g');
            cuerpoHTML = cuerpoHTML.replace(regex, datosAdicionales[key]);
        });
        
        // Registrar notificación
        const { data: notificacion, error } = await supabase
            .from('notificaciones_email')
            .insert({
                destinatario_email: destinatario,
                destinatario_nombre: destinatarioNombre,
                asunto: asunto,
                cuerpo_html: cuerpoHTML,
                tipo: tipo,
                relacionado_id: relacionadoId,
                relacionado_tipo: tipo,
                adjuntos: JSON.stringify([{
                    url: pdfUrl,
                    nombre: pdfNombre,
                    tipo: 'application/pdf'
                }]),
                enviado: false
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // IMPORTANTE: Aquí deberías integrar con un servicio de email real
        // como SendGrid, AWS SES, Mailgun, etc.
        // Por ahora solo simulamos el envío
        
        console.log('📧 Email programado para envío:', {
            destinatario,
            asunto,
            adjuntos: [pdfNombre]
        });
        
        // Simular envío exitoso
        await supabase
            .from('notificaciones_email')
            .update({
                enviado: true,
                fecha_envio: new Date().toISOString()
            })
            .eq('id', notificacion.id);
        
        return {
            success: true,
            notificacionId: notificacion.id,
            mensaje: 'Email enviado correctamente'
        };
        
    } catch (error) {
        console.error('Error enviando email:', error);
        throw error;
    }
}

// ============================================
// FUNCIÓN AUXILIAR: Preparar datos para email de cotización
// ============================================
export async function prepararEmailCotizacion(cotizacionId, pdfUrl, pdfNombre) {
    const { data: cotizacion } = await supabase
        .from('v_cotizaciones_completas')
        .select('*')
        .eq('id', cotizacionId)
        .single();
    
    if (!cotizacion) throw new Error('Cotización no encontrada');
    
    const fechaVencimiento = new Date(cotizacion.fecha_cotizacion);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 15);
    
    return await enviarEmailConPDF({
        destinatario: cotizacion.cliente_email || 'cliente@ejemplo.com',
        destinatarioNombre: cotizacion.cliente_nombre,
        asunto: `Cotización ${cotizacion.folio} - Special Car`,
        tipo: 'cotizacion',
        relacionadoId: cotizacionId,
        pdfUrl: pdfUrl,
        pdfNombre: pdfNombre,
        datosAdicionales: {
            folio: cotizacion.folio,
            cliente_nombre: cotizacion.cliente_nombre,
            vehiculo_placa: cotizacion.vehiculo_placa,
            total: formatearMoneda(cotizacion.total),
            fecha_vencimiento: formatearFecha(fechaVencimiento)
        }
    });
}

// ============================================
// FUNCIÓN AUXILIAR: Preparar datos para email de inspección
// ============================================
export async function prepararEmailInspeccion(inspeccionId, pdfUrl, pdfNombre) {
    const { data: inspeccion } = await supabase
        .from('v_inspecciones_completas')
        .select('*')
        .eq('id', inspeccionId)
        .single();
    
    if (!inspeccion) throw new Error('Inspección no encontrada');
    
    return await enviarEmailConPDF({
        destinatario: inspeccion.conductor_email || 'cliente@ejemplo.com',
        destinatarioNombre: inspeccion.conductor_nombre,
        asunto: `Inspección de ${inspeccion.tipo} - Vehículo ${inspeccion.placa}`,
        tipo: 'inspeccion',
        relacionadoId: inspeccionId,
        pdfUrl: pdfUrl,
        pdfNombre: pdfNombre,
        datosAdicionales: {
            tipo: inspeccion.tipo,
            cliente_nombre: inspeccion.conductor_nombre,
            vehiculo_placa: inspeccion.placa,
            fecha: formatearFecha(inspeccion.fecha_hora),
            kilometraje: inspeccion.kilometraje?.toLocaleString(),
            inspector: inspeccion.inspector_nombre
        }
    });
}