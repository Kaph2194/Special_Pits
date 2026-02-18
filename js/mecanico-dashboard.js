// js/mecanico-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion, formatearMoneda, formatearFecha } from './utils.js';

const dash = new DashboardBase(['mecanico']);

let misOTs = [];

(async () => {
    if (!await dash.inicializar()) return;
    await cargarDashboard();
})();

async function cargarDashboard() {
    const usuarioId = auth.getUsuario().id;
    
    try {
        // Métricas
        const [{ count: pend }, { count: proc }, { count: comp }] = await Promise.all([
            supabase.from('ordenes_trabajo').select('*',{count:'exact',head:true})
                .eq('mecanico_asignado_id', usuarioId).eq('estado','pendiente'),
            supabase.from('ordenes_trabajo').select('*',{count:'exact',head:true})
                .eq('mecanico_asignado_id', usuarioId).eq('estado','en_proceso'),
            supabase.from('ordenes_trabajo').select('*',{count:'exact',head:true})
                .eq('mecanico_asignado_id', usuarioId).eq('estado','completada')
                .gte('updated_at', new Date(new Date().setDate(1)).toISOString())
        ]);

        document.getElementById('misOTsPendientes').textContent   = pend ?? 0;
        document.getElementById('misOTsEnProceso').textContent    = proc ?? 0;
        document.getElementById('misOTsCompletadas').textContent  = comp ?? 0;

        // OTs asignadas
        const { data } = await supabase
            .from('v_ordenes_trabajo_completas')
            .select('*')
            .eq('mecanico_id', usuarioId)
            .in('estado', ['pendiente','en_proceso'])
            .order('prioridad', { ascending: false })
            .order('fecha_ingreso', { ascending: true });

        misOTs = data || [];
        renderizarOTs(misOTs);

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error cargando datos', 'error');
    }
}

function renderizarOTs(ots) {
    const container = document.getElementById('listaOTs');
    
    if (!ots || ots.length === 0) {
        container.innerHTML = '<div class="card"><p style="color:var(--gray-700);">No tienes OTs asignadas actualmente</p></div>';
        return;
    }

    const html = ots.map(ot => `
        <div class="ot-card">
            <div class="ot-header">
                <div>
                    <h3>${ot.numero_ot}</h3>
                    <p style="color:var(--gray-700);margin:.25rem 0;">
                        ${ot.vehiculo_marca} ${ot.vehiculo_linea} - ${ot.vehiculo_placa}<br>
                        Cliente: ${ot.cliente_nombre}
                    </p>
                </div>
                <div style="text-align:right;">
                    <span class="badge badge-${
                        ot.prioridad === 'urgente' ? 'danger' : 
                        ot.prioridad === 'alta' ? 'orange' : 'blue'
                    }">${ot.prioridad}</span><br>
                    <span class="badge badge-${
                        ot.estado === 'pendiente' ? 'orange' : 'blue'
                    }" style="margin-top:.5rem;">${ot.estado}</span>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div>
                    <strong>Ingreso:</strong> ${formatearFecha(ot.fecha_ingreso)}<br>
                    <strong>Compromiso:</strong> ${formatearFecha(ot.fecha_compromiso)}<br>
                    <strong>Kilometraje:</strong> ${ot.kilometraje_ingreso?.toLocaleString()} km
                </div>
                <div>
                    <strong>Total:</strong> ${formatearMoneda(ot.total)}<br>
                    ${ot.observaciones_ingreso ? 
                        `<strong>Observaciones:</strong><br><small>${ot.observaciones_ingreso}</small>` : ''}
                </div>
            </div>

            ${ot.diagnostico ? `
                <div style="background:var(--gray-50);padding:1rem;border-radius:.5rem;margin-bottom:1rem;">
                    <strong>Diagnóstico:</strong><br>
                    ${ot.diagnostico}
                </div>
            ` : ''}

            <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                ${ot.estado === 'pendiente' ? `
                    <button onclick="iniciarOT(${ot.id})" class="btn btn-primary">
                        ▶️ Iniciar Trabajo
                    </button>
                ` : ''}
                ${ot.estado === 'en_proceso' ? `
                    <button onclick="completarOT(${ot.id})" class="btn btn-success">
                        ✅ Completar
                    </button>
                ` : ''}
                <button onclick="verHistorial(${ot.vehiculo_id})" class="btn btn-secondary">
                    📋 Historial Vehículo
                </button>
                <button onclick="solicitarModificacion(${ot.id})" class="btn btn-warning">
                    ⚠️ Solicitar Modificación
                </button>
                <button onclick="actualizarDiagnostico(${ot.id})" class="btn btn-secondary">
                    📝 Actualizar Diagnóstico
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

window.iniciarOT = async function(otId) {
    if (!confirm('¿Iniciar trabajo en esta OT?')) return;
    
    try {
        const { error } = await supabase
            .from('ordenes_trabajo')
            .update({ 
                estado: 'en_proceso',
                fecha_inicio: new Date().toISOString()
            })
            .eq('id', otId);

        if (error) throw error;

        mostrarNotificacion('✅ OT iniciada', 'success');
        await cargarDashboard();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.completarOT = async function(otId) {
    const diagnostico = prompt('Diagnóstico final del trabajo:');
    if (!diagnostico) return;

    const recomendaciones = prompt('Recomendaciones para el cliente (opcional):');

    try {
        const { error } = await supabase
            .from('ordenes_trabajo')
            .update({ 
                estado: 'completada',
                fecha_finalizacion: new Date().toISOString(),
                diagnostico: diagnostico,
                recomendaciones: recomendaciones,
                kilometraje_salida: parseInt(prompt('Kilometraje actual del vehículo:') || 0)
            })
            .eq('id', otId);

        if (error) throw error;

        mostrarNotificacion('✅ OT completada. Se notificará al jefe de taller.', 'success');
        await cargarDashboard();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.solicitarModificacion = async function(otId) {
    const ot = misOTs.find(o => o.id === otId);
    if (!ot) return;

    const container = document.createElement('div');
    container.innerHTML = `
        <div class="modal" style="display:flex;" onclick="if(event.target===this) this.remove()">
            <div class="modal-content" style="max-width:600px;">
                <h2>⚠️ Solicitar Modificación</h2>
                <p>OT: ${ot.numero_ot} - ${ot.vehiculo_placa}</p>
                
                <div class="form-group">
                    <label>Tipo de solicitud</label>
                    <select id="tipoSolicitud" class="form-control">
                        <option value="agregar_repuesto">Agregar Repuesto</option>
                        <option value="cambiar_repuesto">Cambiar Repuesto</option>
                        <option value="agregar_horas">Agregar Horas</option>
                        <option value="otro">Otro</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Descripción detallada *</label>
                    <textarea id="descSolicitud" class="form-control" rows="4" required
                              placeholder="Explica detalladamente por qué necesitas esta modificación..."></textarea>
                </div>

                <div style="display:flex;gap:1rem;">
                    <button onclick="enviarSolicitudModificacion(${otId})" class="btn btn-warning" style="flex:1;">
                        📤 Enviar Solicitud
                    </button>
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(container);
}

window.enviarSolicitudModificacion = async function(otId) {
    const tipo = document.getElementById('tipoSolicitud').value;
    const desc = document.getElementById('descSolicitud').value.trim();

    if (!desc) {
        mostrarNotificacion('⚠️ Debes describir la solicitud', 'warning');
        return;
    }

    try {
        const { error } = await supabase
            .from('solicitudes_modificacion')
            .insert({
                ot_id: otId,
                solicitante_id: auth.getUsuario().id,
                tipo_solicitud: tipo,
                descripcion: desc,
                estado: 'pendiente',
                notif_whatsapp: true
            });

        if (error) throw error;

        // TODO: Notificar al jefe de taller por WhatsApp

        mostrarNotificacion('✅ Solicitud enviada. Espera la aprobación del jefe de taller.', 'success');
        document.querySelector('.modal')?.remove();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.actualizarDiagnostico = async function(otId) {
    const ot = misOTs.find(o => o.id === otId);
    const diagnosticoActual = ot?.diagnostico || '';

    const nuevoDiagnostico = prompt('Actualizar diagnóstico:', diagnosticoActual);
    if (nuevoDiagnostico === null) return;

    try {
        await supabase
            .from('ordenes_trabajo')
            .update({ diagnostico: nuevoDiagnostico })
            .eq('id', otId);

        mostrarNotificacion('✅ Diagnóstico actualizado', 'success');
        await cargarDashboard();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.verHistorial = function(vehiculoId) {
    window.location.href = `historial-vehiculo.html?vehiculo_id=${vehiculoId}`;
}

window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(seccion).classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    if (seccion === 'solicitudes') cargarSolicitudesMecanico();
    if (seccion === 'clientes') cargarClientesMecanico();
}

async function cargarSolicitudesMecanico() {
    const { data } = await supabase
        .from('solicitudes_modificacion')
        .select('*, ordenes_trabajo(numero_ot, vehiculo_id)')
        .eq('solicitante_id', auth.getUsuario().id)
        .order('created_at', { ascending: false });

    const html = (data || []).map(s => `
        <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:start;">
                <div>
                    <strong>OT ${s.ordenes_trabajo?.numero_ot || s.ot_id}</strong>
                    <span class="badge badge-${
                        s.estado === 'pendiente' ? 'orange' : 
                        s.estado === 'aprobada' ? 'green' : 'danger'
                    }" style="margin-left:.5rem;">${s.estado}</span><br>
                    <small style="color:var(--gray-700);">${s.tipo_solicitud} - ${formatearFecha(s.created_at)}</small>
                    <p style="margin:.5rem 0;">${s.descripcion}</p>
                    ${s.motivo_rechazo ? `<p style="color:var(--danger);">Motivo rechazo: ${s.motivo_rechazo}</p>` : ''}
                </div>
            </div>
        </div>
    `).join('') || '<p>No tienes solicitudes</p>';

    document.getElementById('listaSolicitudesMecanico').innerHTML = html;
}

async function cargarClientesMecanico() {
    const { data } = await supabase
        .from('v_ordenes_trabajo_completas')
        .select('cliente_id, cliente_nombre, cliente_telefono')
        .eq('mecanico_id', auth.getUsuario().id);

    // Deduplicar clientes
    const clientesUnicos = [...new Map((data || []).map(c => [c.cliente_id, c])).values()];

    const html = clientesUnicos.map(c => `
        <div class="card" style="margin-bottom:1rem;">
            <strong>${c.cliente_nombre}</strong><br>
            <small>📞 ${c.cliente_telefono || 'Sin teléfono'}</small>
        </div>
    `).join('') || '<p>No has atendido clientes aún</p>';

    document.getElementById('listaClientesMecanico').innerHTML = html;
}

window.buscarHistorialVehiculo = async function() {
    const placa = document.getElementById('buscarPlaca').value.trim().toUpperCase();
    if (!placa) {
        document.getElementById('historialContainer').innerHTML = '';
        return;
    }

    const { data: vehiculo } = await supabase
        .from('vehiculos')
        .select('id')
        .eq('placa', placa)
        .single();

    if (!vehiculo) {
        document.getElementById('historialContainer').innerHTML = 
            '<p style="color:var(--gray-700);">Vehículo no encontrado</p>';
        return;
    }

    window.location.href = `historial-vehiculo.html?vehiculo_id=${vehiculo.id}`;
}
// AGREGAR AL FINAL DEL ARCHIVO, ANTES DE window.cerrarSesion

// FUNCIÓN: Buscar historial de vehículo por placa
window.buscarHistorialVehiculo = async function() {
    const placa = document.getElementById('buscarPlaca').value.trim().toUpperCase();
    if (!placa) {
        document.getElementById('historialContainer').innerHTML = '';
        return;
    }

    try {
        const { data: vehiculo } = await supabase
            .from('vehiculos')
            .select('id, placa, marca, linea, cliente_id, clientes(razon_social)')
            .eq('placa', placa)
            .single();

        if (!vehiculo) {
            document.getElementById('historialContainer').innerHTML = 
                '<p style="color:var(--gray-700);padding:1rem;">Vehículo no encontrado</p>';
            return;
        }

        // Obtener historial completo
        const { data: historial } = await supabase
            .from('v_historial_vehiculo_detallado')
            .select('*')
            .eq('vehiculo_id', vehiculo.id)
            .order('fecha_ingreso', { ascending: false });

        let html = `
            <div class="card" style="margin-bottom:1rem;">
                <h3>🚗 ${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.linea}</h3>
                <p>Cliente: ${vehiculo.clientes?.razon_social || 'N/A'}</p>
                <p>Total servicios: ${historial?.length || 0}</p>
            </div>
        `;

        if (historial && historial.length > 0) {
            html += historial.map(h => `
                <div class="card" style="margin-bottom:1rem;">
                    <div style="display:flex;justify-content:space-between;align-items:start;">
                        <div>
                            <strong>${h.numero_ot || 'OT-' + h.ot_id}</strong>
                            <span class="badge badge-${h.ot_estado === 'completada' ? 'green' : 'blue'}" 
                                  style="margin-left:.5rem;">
                                ${h.ot_estado}
                            </span><br>
                            <small style="color:var(--gray-700);">
                                Ingreso: ${formatearFecha(h.fecha_ingreso)}<br>
                                ${h.fecha_finalizacion ? `Finalización: ${formatearFecha(h.fecha_finalizacion)}<br>` : ''}
                                Mecánico: ${h.mecanico_nombre || 'N/A'}<br>
                                KM: ${h.kilometraje_ingreso?.toLocaleString() || 'N/A'}
                            </small>
                        </div>
                        <div style="text-align:right;">
                            <strong style="color:var(--success);font-size:1.25rem;">
                                ${formatearMoneda(h.ot_total)}
                            </strong>
                        </div>
                    </div>
                    ${h.diagnostico ? `
                        <div style="background:var(--gray-50);padding:.75rem;border-radius:.5rem;margin-top:.5rem;">
                            <strong>Diagnóstico:</strong> ${h.diagnostico}
                        </div>
                    ` : ''}
                    ${h.recomendaciones ? `
                        <div style="background:#dbeafe;padding:.75rem;border-radius:.5rem;margin-top:.5rem;">
                            <strong>Recomendaciones:</strong> ${h.recomendaciones}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } else {
            html += '<p style="color:var(--gray-700);padding:1rem;">Sin historial de servicios</p>';
        }

        document.getElementById('historialContainer').innerHTML = html;

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error buscando vehículo', 'error');
    }
}
window.cerrarSesion = () => auth.logout();