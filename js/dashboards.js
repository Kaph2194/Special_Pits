// js/dashboards.js
import { supabase } from './supabase-config.js';
import { auth, protegerRuta, aplicarPermisos } from './auth-system.js';
import { formatearMoneda, formatearFecha, formatearFechaHora } from './utils.js';

// ============================================
// CLASE BASE PARA DASHBOARDS
// ============================================
export class DashboardBase {
    constructor(rolRequerido) {
        this.rolRequerido = rolRequerido;
        this.usuario = null;
    }

    async inicializar() {
        const acceso = await protegerRuta();
        if (!acceso) return false;

        this.usuario = auth.getUsuario();

        if (this.rolRequerido && !this.rolRequerido.includes(this.usuario.rol)) {
            alert('No tienes acceso a este panel');
            auth.redirigirSegunRol();
            return false;
        }

        // Mostrar nombre del usuario
        const elNombre = document.getElementById('nombreUsuario');
        if (elNombre) elNombre.textContent = this.usuario.nombre;

        const elRol = document.getElementById('rolUsuario');
        if (elRol) elRol.textContent = this.getRolNombre(this.usuario.rol);

        // Aplicar permisos de visibilidad
        aplicarPermisos();

        return true;
    }

    getRolNombre(rol) {
        const nombres = {
            'superadmin':           '🔐 SuperAdmin',
            'jefe_taller':          '👔 Jefe de Taller',
            'jefe_almacen':         '📦 Jefe de Almacén',
            'mecanico':             '🔧 Mecánico',
            'cajero':               '💰 Cajero',
            'cliente_final':        '🚗 Cliente',
            'cliente_financiero':   '📊 Financiero',
            'cliente_admin_taller': '🏭 Admin Taller',
            'cliente_gerencia':     '👑 Gerencia'
        };
        return nombres[rol] || rol;
    }

    async cargarMetrica(elementId, query) {
        try {
            const { count, data, error } = await query;
            if (error) throw error;

            const el = document.getElementById(elementId);
            if (el) el.textContent = count ?? data;
        } catch (error) {
            console.error(`Error cargando métrica ${elementId}:`, error);
        }
    }

    renderTabla(containerId, columnas, datos, acciones = []) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!datos || datos.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:2rem; color:var(--gray-700);">
                    No hay datos disponibles
                </div>`;
            return;
        }

        const thead = columnas.map(c => `<th>${c.label}</th>`).join('');
        const tbody = datos.map(row => {
            const celdas = columnas.map(c => {
                let valor = row[c.key] ?? '-';

                if (c.tipo === 'moneda')  valor = formatearMoneda(valor);
                if (c.tipo === 'fecha')   valor = formatearFecha(valor);
                if (c.tipo === 'fechahora') valor = formatearFechaHora(valor);
                if (c.tipo === 'badge')   valor = `<span class="badge badge-${c.color?.(row) ?? 'blue'}">${valor}</span>`;
                if (c.render) valor = c.render(row);

                return `<td>${valor}</td>`;
            }).join('');

            const botonesAccion = acciones.map(a => `
                <button 
                    onclick="${a.fn}(${row.id})" 
                    class="btn btn-${a.tipo ?? 'secondary'}" 
                    style="padding:0.25rem 0.75rem; font-size:0.875rem;"
                    title="${a.label}">
                    ${a.icono} ${a.label}
                </button>
            `).join('');

            return `<tr>${celdas}${acciones.length ? `<td>${botonesAccion}</td>` : ''}</tr>`;
        }).join('');

        container.innerHTML = `
            <div style="overflow-x:auto;">
                <table class="table">
                    <thead>
                        <tr>${thead}${acciones.length ? '<th>Acciones</th>' : ''}</tr>
                    </thead>
                    <tbody>${tbody}</tbody>
                </table>
            </div>`;
    }
}

// ============================================
// WHATSAPP SERVICE
// ============================================
export class WhatsAppService {
    // Enviar mensaje vía WhatsApp Business API (Meta)
    static async enviarMensaje(telefono, mensaje, tipo, relacionadoId) {
        try {
            // Limpiar teléfono
            const telefonoLimpio = telefono.replace(/[^0-9]/g, '');
            const telefonoConPais = telefonoLimpio.startsWith('57')
                ? telefonoLimpio
                : `57${telefonoLimpio}`;

            // Registrar en BD
            const { data: notif, error } = await supabase
                .from('notificaciones_whatsapp')
                .insert({
                    destinatario_telefono: telefonoConPais,
                    mensaje,
                    tipo,
                    relacionado_id: relacionadoId,
                    relacionado_tipo: tipo
                })
                .select()
                .single();

            if (error) throw error;

            // TODO: Integrar con API de WhatsApp Business
            // Por ahora generamos link de WhatsApp Web como fallback
            const mensajeCodificado = encodeURIComponent(mensaje);
            const urlWhatsApp = `https://wa.me/${telefonoConPais}?text=${mensajeCodificado}`;

            // Marcar como enviado (simulado)
            await supabase
                .from('notificaciones_whatsapp')
                .update({ enviado: true, fecha_envio: new Date().toISOString() })
                .eq('id', notif.id);

            console.log('📱 WhatsApp:', urlWhatsApp);
            return { success: true, url: urlWhatsApp, notifId: notif.id };

        } catch (error) {
            console.error('Error WhatsApp:', error);
            return { success: false, error: error.message };
        }
    }

    static async notificarCierreOT(ot) {
        const mensaje = `🔧 *Special Car*\n\nSu vehículo *${ot.vehiculo_placa}* ha finalizado su servicio.\n\n` +
            `📋 OT: ${ot.numero_ot}\n` +
            `💰 Total: ${formatearMoneda(ot.total)}\n\n` +
            `Por favor acérquese a reclamar su vehículo.\n` +
            `📍 Special Car - Servicio al cliente`;

        return await this.enviarMensaje(ot.cliente_telefono, mensaje, 'ot_completada', ot.id);
    }

    static async notificarCotizacion(cotizacion) {
        const mensaje = `🚗 *Special Car*\n\nTenemos lista su cotización.\n\n` +
            `📋 No. ${cotizacion.folio}\n` +
            `🚙 Vehículo: ${cotizacion.vehiculo_placa}\n` +
            `💰 Total: ${formatearMoneda(cotizacion.total)}\n\n` +
            `Válida por 15 días. Contáctenos para aprobarla.`;

        return await this.enviarMensaje(
            cotizacion.cliente_telefono, mensaje, 'cotizacion_enviada', cotizacion.id
        );
    }

    static async notificarSolicitudModificacion(solicitud, jefetelefono) {
        const mensaje = `⚠️ *Special Car - Solicitud de Modificación*\n\n` +
            `El mecánico solicita autorización:\n\n` +
            `📋 OT: ${solicitud.numero_ot}\n` +
            `📝 Tipo: ${solicitud.tipo_solicitud}\n` +
            `💬 Descripción: ${solicitud.descripcion}\n\n` +
            `Por favor revise el sistema para aprobar o rechazar.`;

        return await this.enviarMensaje(
            jefetelefono, mensaje, 'solicitud_modificacion', solicitud.id
        );
    }
}