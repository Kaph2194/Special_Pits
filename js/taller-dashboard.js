// js/taller-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion, formatearFecha, formatearMoneda, formatearFechaHora } from './utils.js';
import { whatsappService } from './whatsapp-business.js';
import { mostrarModalCambiarPassword } from './cambiar-password.js';
import { PrintManager } from './print-manager.js';
import { notificacionesRealtime, NotificacionesRealtime } from './notifications-realtime.js';

const dash = new DashboardBase(['superadmin', 'jefe_taller']);

let todasLasOTs = [];
let clientes = [];
let vehiculos = [];

(async () => {
    if (!await dash.inicializar()) return;
    await cargarMetricas();
    await cargarTodasLasOTs();
    await cargarCotizaciones();
    await cargarSolicitudes();
    await cargarSolicitudesRecientes();
})();

// ============================================
// MÉTRICAS
// ============================================

async function cargarMetricas() {
    try {
        const [
            { count: pendientes },
            { count: proceso },
            { count: completadas },
            { count: solicitudes }
        ] = await Promise.all([
            supabase.from('ordenes_trabajo').select('*', {count:'exact',head:true}).eq('estado','pendiente'),
            supabase.from('ordenes_trabajo').select('*', {count:'exact',head:true}).eq('estado','en_proceso'),
            supabase.from('ordenes_trabajo').select('*', {count:'exact',head:true}).eq('estado','completada'),
            supabase.from('solicitudes_modificacion').select('*', {count:'exact',head:true}).eq('estado','pendiente')
        ]);

        document.getElementById('otsPendientes').textContent = pendientes ?? 0;
        document.getElementById('otsEnProceso').textContent = proceso ?? 0;
        document.getElementById('otsCompletadas').textContent = completadas ?? 0;
        document.getElementById('solicitudesPendientes').textContent = solicitudes ?? 0;

        // Agregar métrica de total OTs
        const totalOTs = (pendientes || 0) + (proceso || 0) + (completadas || 0);
        
        const metricsContainer = document.querySelector('.metrics');
        if (metricsContainer && !document.getElementById('totalOTs')) {
            const totalCard = document.createElement('div');
            totalCard.className = 'metric';
            totalCard.id = 'totalOTs';
            totalCard.innerHTML = `
                <div class="metric-value" style="color:var(--primary);">${totalOTs}</div>
                <div class="metric-label">📊 Total OTs</div>
            `;
            metricsContainer.appendChild(totalCard);
        } else if (document.getElementById('totalOTs')) {
            document.getElementById('totalOTs').querySelector('.metric-value').textContent = totalOTs;
        }

    } catch (error) {
        console.error('Error cargando métricas:', error);
    }
}

// ============================================
// ÓRDENES DE TRABAJO
// ============================================

async function cargarTodasLasOTs() {
    try {
        const { data, error } = await supabase
            .from('v_ordenes_trabajo_completas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        todasLasOTs = data || [];
        
        // Extraer clientes únicos
        clientes = [...new Map(todasLasOTs.map(ot => 
            [ot.cliente_id, { id: ot.cliente_id, nombre: ot.cliente_nombre }]
        )).values()];

        // Extraer vehículos únicos
        vehiculos = [...new Map(todasLasOTs.map(ot => 
            [ot.vehiculo_id, { 
                id: ot.vehiculo_id, 
                placa: ot.vehiculo_placa,
                cliente_id: ot.cliente_id 
            }]
        )).values()];

        // Llenar selects de filtros
        const selectCliente = document.getElementById('filtroCliente');
        if (selectCliente) {
            selectCliente.innerHTML = '<option value="">Todos los clientes</option>' +
                clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }

        const selectVehiculo = document.getElementById('filtroVehiculo');
        if (selectVehiculo) {
            selectVehiculo.innerHTML = '<option value="">Todos los vehículos</option>' +
                vehiculos.map(v => `<option value="${v.id}">${v.placa}</option>`).join('');
        }

        filtrarOTs();

    } catch (error) {
        console.error('Error cargando OTs:', error);
        mostrarNotificacion('Error cargando órdenes de trabajo', 'error');
    }
}

window.filtrarOTs = function() {
    const clienteId = document.getElementById('filtroCliente')?.value;
    const vehiculoId = document.getElementById('filtroVehiculo')?.value;
    const estado = document.getElementById('filtroEstadoOT')?.value;

    let filtradas = todasLasOTs;

    if (clienteId) {
        filtradas = filtradas.filter(ot => ot.cliente_id == clienteId);
        
        // Actualizar lista de vehículos según cliente
        const vehiculosCliente = vehiculos.filter(v => v.cliente_id == clienteId);
        const selectVehiculo = document.getElementById('filtroVehiculo');
        if (selectVehiculo) {
            selectVehiculo.innerHTML = '<option value="">Todos los vehículos</option>' +
                vehiculosCliente.map(v => `<option value="${v.id}">${v.placa}</option>`).join('');
        }
    }

    if (vehiculoId) {
        filtradas = filtradas.filter(ot => ot.vehiculo_id == vehiculoId);
    }

    if (estado) {
        filtradas = filtradas.filter(ot => ot.estado === estado);
    }

    renderizarOTs(filtradas);
}

function renderizarOTs(ots) {
    const html = ots.map(ot => `
        <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:start;">
                <div style="flex:1;">
                    <h3>${ot.numero_ot}</h3>
                    <span class="badge badge-${
                        ot.prioridad === 'urgente' ? 'danger' : 
                        ot.prioridad === 'alta' ? 'orange' : 'blue'
                    }">${ot.prioridad || 'normal'}</span>
                    <span class="badge badge-${
                        ot.estado === 'pendiente' ? 'orange' : 
                        ot.estado === 'en_proceso' ? 'blue' : 'green'
                    }" style="margin-left:.5rem;">${ot.estado}</span>
                    
                    <div style="margin-top:.75rem;color:var(--gray-700);">
                        <strong>Cliente:</strong> ${ot.cliente_nombre}<br>
                        <strong>Vehículo:</strong> ${ot.vehiculo_placa} - ${ot.vehiculo_marca || ''} ${ot.vehiculo_linea || ''}<br>
                        <strong>Ingreso:</strong> ${formatearFecha(ot.fecha_ingreso)}<br>
                        ${ot.fecha_compromiso ? `<strong>Compromiso:</strong> ${formatearFecha(ot.fecha_compromiso)}<br>` : ''}
                        ${ot.mecanico_nombre ? `<strong>Mecánico:</strong> ${ot.mecanico_nombre}<br>` : ''}
                        <strong>Total:</strong> ${formatearMoneda(ot.total)}
                    </div>

                    ${ot.observaciones_ingreso ? `
                        <div style="background:var(--gray-50);padding:.75rem;border-radius:.5rem;margin-top:.75rem;">
                            <strong>Observaciones:</strong> ${ot.observaciones_ingreso}
                        </div>
                    ` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:.5rem;">
                    ${ot.estado === 'pendiente' ? `
                        <button onclick="asignarMecanico(${ot.id})" class="btn btn-primary">
                            👷 Asignar Mecánico
                        </button>
                    ` : ''}
                    ${ot.estado !== 'completada' ? `
                        <button onclick="verDetalleOT(${ot.id})" class="btn btn-secondary">
                            👁️ Ver Detalle
                        </button>
                    ` : ''}
                    <button onclick="verHistorialVehiculo(${ot.vehiculo_id})" class="btn btn-secondary">
                        📋 Historial Vehículo
                    </button>
                </div>
            </div>
        </div>
    `).join('') || '<p style="color:var(--gray-700);padding:2rem;text-align:center;">No hay órdenes de trabajo con estos filtros</p>';

    const container = document.getElementById('listaOTsTaller');
    if (container) {
        container.innerHTML = html;
    }
}

window.verHistorialVehiculo = function(vehiculoId) {
    window.location.href = `historial-vehiculo.html?vehiculo_id=${vehiculoId}`;
}

window.asignarMecanico = async function(otId) {
    const { data: mecanicos } = await supabase
        .from('usuarios')
        .select('id, nombre, telefono, email')
        .eq('rol', 'mecanico')
        .eq('activo', true);

    if (!mecanicos || mecanicos.length === 0) {
        mostrarNotificacion('⚠️ No hay mecánicos disponibles', 'warning');
        return;
    }

    // Obtener carga de trabajo de cada mecánico
    const { data: otsActivas } = await supabase
        .from('ordenes_trabajo')
        .select('mecanico_asignado_id')
        .in('estado', ['pendiente', 'en_proceso']);

    const cargaTrabajo = {};
    (otsActivas || []).forEach(ot => {
        const mecId = ot.mecanico_asignado_id;
        if (mecId) {
            cargaTrabajo[mecId] = (cargaTrabajo[mecId] || 0) + 1;
        }
    });

    const modal = `
        <div class="modal" style="display:flex;" id="modalAsignarMecanico">
            <div class="modal-content" style="max-width:600px;">
                <h2>👷 Asignar Mecánico a OT</h2>
                
                <div class="card" style="margin-bottom:1.5rem;">
                    <p style="margin:0;color:var(--gray-700);">
                        Seleccione el mecánico que realizará este trabajo:
                    </p>
                </div>

                <div style="display:flex;flex-direction:column;gap:1rem;">
                    ${mecanicos.map(m => `
                        <div class="card" onclick="seleccionarMecanico(${otId}, ${m.id})" 
                             style="cursor:pointer;transition:all .3s;border:2px solid transparent;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <div>
                                    <strong style="font-size:1.1rem;">${m.nombre}</strong><br>
                                    <small style="color:var(--gray-700);">
                                        📧 ${m.email || 'Sin email'}<br>
                                        📞 ${m.telefono || 'Sin teléfono'}
                                    </small>
                                </div>
                                <div style="text-align:center;">
                                    <div style="font-size:2rem;font-weight:700;color:var(--primary);">
                                        ${cargaTrabajo[m.id] || 0}
                                    </div>
                                    <small style="color:var(--gray-700);">OTs activas</small>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <button onclick="cerrarModalAsignarMecanico()" class="btn btn-secondary" 
                        style="width:100%;margin-top:1rem;">
                    Cancelar
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    // Agregar hover effect
    document.querySelectorAll('#modalAsignarMecanico .card[onclick]').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.borderColor = 'var(--primary)';
            this.style.background = 'var(--gray-50)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.borderColor = 'transparent';
            this.style.background = 'white';
        });
    });
}

window.seleccionarMecanico = async function(otId, mecanicoId) {
    try {
        await supabase
            .from('ordenes_trabajo')
            .update({ 
                mecanico_asignado_id: mecanicoId,
                estado: 'en_proceso'
            })
            .eq('id', otId);

        await auth.registrarAccion('asignar_mecanico', 'ordenes_trabajo', otId);
        mostrarNotificacion('✅ Mecánico asignado correctamente', 'success');
        
        cerrarModalAsignarMecanico();
        await cargarMetricas();
        await cargarTodasLasOTs();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.cerrarModalAsignarMecanico = () => {
    document.getElementById('modalAsignarMecanico')?.remove();
}


window.verDetalleOT = async function(otId) {
    try {
        // Obtener OT completa
        const { data: ot } = await supabase
            .from('v_ordenes_trabajo_completas')
            .select('*')
            .eq('id', otId)
            .single();

        if (!ot) return;

        // Obtener repuestos
        const { data: repuestos } = await supabase
            .from('v_repuestos_utilizados_ot')
            .select('*')
            .eq('ot_id', otId);

        // Obtener servicios
        const { data: servicios } = await supabase
            .from('v_servicios_realizados_ot')
            .select('*')
            .eq('ot_id', otId);

        // Obtener mano de obra
        const { data: manoObra } = await supabase
            .from('v_mano_obra_ot')
            .select('*')
            .eq('ot_id', otId);

        // Obtener solicitudes
        const { data: solicitudes } = await supabase
            .from('solicitudes_modificacion')
            .select('*, usuarios!solicitante_id(nombre)')
            .eq('ot_id', otId)
            .order('created_at', { ascending: false });

        const modal = `
            <div class="modal" style="display:flex;" onclick="if(event.target===this) this.remove()">
                <div class="modal-content" style="max-width:1000px;max-height:90vh;overflow-y:auto;">
                    <h2>🔧 Detalle de Orden de Trabajo</h2>
                    
                    <!-- INFORMACIÓN GENERAL -->
                    <div class="card" style="margin-bottom:1rem;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                            <div>
                                <h3>${ot.numero_ot}</h3>
                                <span class="badge badge-${
                                    ot.estado === 'pendiente' ? 'orange' :
                                    ot.estado === 'en_proceso' ? 'blue' : 'green'
                                }">${ot.estado}</span>
                                ${ot.prioridad ? `<span class="badge badge-${
                                    ot.prioridad === 'urgente' ? 'danger' : 'warning'
                                }" style="margin-left:.5rem;">${ot.prioridad}</span>` : ''}
                                
                                <div style="margin-top:1rem;">
                                    <strong>Cliente:</strong> ${ot.cliente_nombre}<br>
                                    <strong>Vehículo:</strong> ${ot.vehiculo_placa} - ${ot.vehiculo_marca || ''} ${ot.vehiculo_linea || ''}<br>
                                    <strong>Ingreso:</strong> ${formatearFecha(ot.fecha_ingreso)}<br>
                                    ${ot.fecha_compromiso ? `<strong>Compromiso:</strong> ${formatearFecha(ot.fecha_compromiso)}<br>` : ''}
                                    ${ot.mecanico_nombre ? `<strong>Mecánico:</strong> ${ot.mecanico_nombre}<br>` : ''}
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:2.5rem;font-weight:700;color:var(--success);">
                                    ${formatearMoneda(ot.total)}
                                </div>
                                <small style="color:var(--gray-700);">Total de la OT</small>
                                
                                <div style="margin-top:1rem;text-align:left;">
                                    <strong>KM Ingreso:</strong> ${ot.kilometraje_ingreso?.toLocaleString() || 'N/A'}<br>
                                    ${ot.kilometraje_salida ? `<strong>KM Salida:</strong> ${ot.kilometraje_salida.toLocaleString()}<br>` : ''}
                                </div>
                            </div>
                        </div>

                        ${ot.observaciones_ingreso ? `
                            <div style="margin-top:1rem;padding:1rem;background:var(--gray-50);border-radius:.5rem;">
                                <strong>Observaciones de Ingreso:</strong><br>
                                ${ot.observaciones_ingreso}
                            </div>
                        ` : ''}

                        ${ot.diagnostico ? `
                            <div style="margin-top:1rem;padding:1rem;background:#dbeafe;border-radius:.5rem;">
                                <strong>🔍 Diagnóstico:</strong><br>
                                ${ot.diagnostico}
                            </div>
                        ` : ''}

                        ${ot.recomendaciones ? `
                            <div style="margin-top:1rem;padding:1rem;background:#fef3c7;border-radius:.5rem;">
                                <strong>💡 Recomendaciones:</strong><br>
                                ${ot.recomendaciones}
                            </div>
                        ` : ''}
                    </div>

                    <!-- REPUESTOS -->
                    ${repuestos && repuestos.length > 0 ? `
                        <div class="card" style="margin-bottom:1rem;">
                            <h3>🔩 Repuestos Utilizados</h3>
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Repuesto</th>
                                        <th>Proveedor</th>
                                        <th>Cantidad</th>
                                        <th>P. Unit</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${repuestos.map(r => `
                                        <tr>
                                            <td>${r.repuesto_codigo}</td>
                                            <td>${r.repuesto_nombre}</td>
                                            <td>${r.proveedor_nombre || 'N/A'}</td>
                                            <td>${r.cantidad}</td>
                                            <td>${formatearMoneda(r.precio_unitario)}</td>
                                            <td>${formatearMoneda(r.total)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}

                    <!-- SERVICIOS -->
                    ${servicios && servicios.length > 0 ? `
                        <div class="card" style="margin-bottom:1rem;">
                            <h3>⚙️ Servicios Realizados</h3>
                            ${servicios.map(s => `
                                <div style="padding:.75rem;background:var(--gray-50);border-radius:.5rem;margin-bottom:.5rem;">
                                    <strong>${s.servicio_nombre}</strong><br>
                                    <small>${s.servicio_descripcion || ''}</small>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <!-- MANO DE OBRA -->
                    ${manoObra && manoObra.length > 0 ? `
                        <div class="card" style="margin-bottom:1rem;">
                            <h3>👷 Mano de Obra</h3>
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Concepto</th>
                                        <th>Horas</th>
                                        <th>Valor/Hora</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${manoObra.map(mo => `
                                        <tr>
                                            <td>${mo.mo_nombre}</td>
                                            <td>${mo.horas}</td>
                                            <td>${formatearMoneda(mo.valor_hora)}</td>
                                            <td>${formatearMoneda(mo.total)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}

                    <!-- SOLICITUDES -->
                    ${solicitudes && solicitudes.length > 0 ? `
                        <div class="card">
                            <h3>📝 Solicitudes de Modificación</h3>
                            ${solicitudes.map(s => `
                                <div style="padding:.75rem;border-bottom:1px solid var(--gray-200);">
                                    <div style="display:flex;justify-content:space-between;align-items:start;">
                                        <div>
                                            <strong>${s.tipo_solicitud}</strong>
                                            <span class="badge badge-${
                                                s.estado === 'pendiente' ? 'orange' :
                                                s.estado === 'aprobada' ? 'green' : 'danger'
                                            }" style="margin-left:.5rem;">${s.estado}</span><br>
                                            <small>Por: ${s.usuarios?.nombre || 'N/A'}</small><br>
                                            <p style="margin:.5rem 0;">${s.descripcion}</p>
                                        </div>
                                        <small>${formatearFechaHora(s.created_at)}</small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary" 
                            style="width:100%;margin-top:1rem;">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modal);

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error cargando detalle de OT', 'error');
    }
    <button onclick="imprimirOT(${otId})" class="btn btn-primary" 
        style="width:100%;margin-top:1rem;">
        🖨️ Imprimir Orden de Trabajo
    </button>
}
window.imprimirOT = async function(otId) {
    const { data: ot } = await supabase
        .from('v_ordenes_trabajo_completas')
        .select('*')
        .eq('id', otId)
        .single();

    const { data: repuestos } = await supabase
        .from('v_repuestos_utilizados_ot')
        .select('*')
        .eq('ot_id', otId);

    const { data: servicios } = await supabase
        .from('v_servicios_realizados_ot')
        .select('*')
        .eq('ot_id', otId);

    const { data: manoObra } = await supabase
        .from('v_mano_obra_ot')
        .select('*')
        .eq('ot_id', otId);

    PrintManager.imprimirOT(ot, repuestos || [], servicios || [], manoObra || []);
}
// ============================================
// COTIZACIONES
// ============================================

async function cargarCotizaciones() {
    try {
        const { data } = await supabase
            .from('v_cotizaciones_completas')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        dash.renderTabla('tablaCotizaciones', [
            { key: 'folio', label: 'Folio' },
            { key: 'cliente_nombre', label: 'Cliente' },
            { key: 'vehiculo_placa', label: 'Vehículo' },
            { key: 'total', label: 'Total', tipo: 'moneda' },
            { key: 'estado', label: 'Estado', tipo: 'badge',
              color: r => ({pendiente:'orange',aprobada:'green',rechazada:'danger'})[r.estado] ?? 'gray' },
            { key: 'fecha_cotizacion', label: 'Fecha', tipo: 'fecha' }
        ], data || [], [
            { label:'Ver', icono:'👁️', fn:'verCotizacion', tipo:'secondary' },
            { label:'Aprobar', icono:'✅', fn:'aprobarCotizacion', tipo:'success',
              visible: (r) => r.estado === 'pendiente' },
            { label:'Rechazar', icono:'❌', fn:'rechazarCotizacion', tipo:'danger',
              visible: (r) => r.estado === 'pendiente' }
        ]);

    } catch (error) {
        console.error('Error:', error);
    }
}

window.verCotizacion = (id) => {
    window.location.href = `cotizacion.html?id=${id}`;
}

window.aprobarCotizacion = async function(id) {
    if (!confirm('¿Aprobar esta cotización?')) return;
    
    try {
        await supabase.from('cotizaciones').update({ estado:'aprobada' }).eq('id', id);

        const { data: cot } = await supabase
            .from('v_cotizaciones_completas').select('*').eq('id',id).single();
        
        if (cot?.cliente_telefono) {
            await whatsappService.notificarCotizacionAprobada(cot);
        }
        
        mostrarNotificacion('✅ Cotización aprobada y cliente notificado', 'success');
        await cargarCotizaciones();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.rechazarCotizacion = async function(id) {
    const motivo = prompt('Ingrese el motivo del rechazo:');
    if (!motivo) return;
    
    try {
        await supabase.from('cotizaciones')
            .update({ estado:'rechazada', observaciones: motivo })
            .eq('id', id);
        
        mostrarNotificacion('✅ Cotización rechazada', 'success');
        await cargarCotizaciones();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

// ============================================
// SOLICITUDES DE MODIFICACIÓN
// ============================================

async function cargarSolicitudes() {
    try {
        const { data } = await supabase
            .from('solicitudes_modificacion')
            .select(`
                *,
                ordenes_trabajo(numero_ot, vehiculo_id, vehiculos(placa)),
                usuarios!solicitante_id(nombre)
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        dash.renderTabla('tablaSolicitudes', [
            { key: 'id', label: 'OT',
              render: r => r.ordenes_trabajo?.numero_ot || 'N/A' },
            { key: 'id', label: 'Vehículo',
              render: r => r.ordenes_trabajo?.vehiculos?.placa || 'N/A' },
            { key: 'tipo_solicitud', label: 'Tipo' },
            { key: 'descripcion', label: 'Descripción' },
            { key: 'id', label: 'Solicitante',
              render: r => r.usuarios?.nombre || 'N/A' },
            { key: 'estado', label: 'Estado', tipo: 'badge',
              color: r => ({pendiente:'orange',aprobada:'green',rechazada:'danger'})[r.estado] ?? 'gray' },
            { key: 'created_at', label: 'Fecha', tipo: 'fechahora' }
        ], data || [], [
            { label:'Aprobar', icono:'✅', fn:'aprobarSolicitud', tipo:'success',
              visible: (r) => r.estado === 'pendiente' },
            { label:'Rechazar', icono:'❌', fn:'rechazarSolicitud', tipo:'danger',
              visible: (r) => r.estado === 'pendiente' }
        ]);

    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarSolicitudesRecientes() {
    try {
        const { data } = await supabase
            .from('solicitudes_modificacion')
            .select(`
                *,
                ordenes_trabajo(numero_ot, vehiculo_id, vehiculos(placa)),
                usuarios!solicitante_id(nombre)
            `)
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: false })
            .limit(5);

        const html = (data || []).map(s => `
            <div class="card" style="margin-bottom:.75rem;padding:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div>
                        <strong>${s.ordenes_trabajo?.numero_ot || 'OT'}</strong> - 
                        <span>${s.ordenes_trabajo?.vehiculos?.placa || 'N/A'}</span><br>
                        <small style="color:var(--gray-700);">
                            ${s.tipo_solicitud} | ${s.usuarios?.nombre || 'Mecánico'}
                        </small><br>
                        <p style="margin:.5rem 0;">${s.descripcion}</p>
                    </div>
                    <div style="display:flex;gap:.5rem;">
                        <button onclick="aprobarSolicitud(${s.id})" class="btn btn-success" 
                                style="padding:.5rem .75rem;font-size:.875rem;">
                            ✅
                        </button>
                        <button onclick="rechazarSolicitud(${s.id})" class="btn btn-danger" 
                                style="padding:.5rem .75rem;font-size:.875rem;">
                            ❌
                        </button>
                    </div>
                </div>
            </div>
        `).join('') || '<p style="color:var(--gray-700);padding:1rem;">Sin solicitudes pendientes</p>';

        const container = document.getElementById('solicitudesRecientes');
        if (container) {
            container.innerHTML = html;
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

window.aprobarSolicitud = async function(solicitudId) {
    if (!confirm('¿Aprobar esta solicitud?')) return;

    try {
        const { error } = await supabase
            .from('solicitudes_modificacion')
            .update({
                estado: 'aprobada',
                aprobador_id: auth.getUsuario().id,
                fecha_aprobacion: new Date().toISOString()
            })
            .eq('id', solicitudId);

        if (error) throw error;

        const { data: solicitud } = await supabase
            .from('solicitudes_modificacion')
            .select('*, usuarios!solicitante_id(nombre, telefono)')
            .eq('id', solicitudId)
            .single();

        if (solicitud?.usuarios?.telefono) {
            const mensaje = `✅ *Special Car*\n\n` +
                `Tu solicitud fue *APROBADA*:\n` +
                `${solicitud.descripcion}\n\n` +
                `Puedes proceder con el trabajo solicitado.`;

            await whatsappService.enviarMensaje(
                solicitud.usuarios.telefono,
                mensaje,
                'solicitud_aprobada',
                solicitudId
            );
        }

        mostrarNotificacion('✅ Solicitud aprobada y notificada', 'success');

        await cargarMetricas();
        await cargarSolicitudesRecientes();
        await cargarSolicitudes();

    } catch(error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.rechazarSolicitud = async function(solicitudId) {
    const motivo = prompt('Ingrese el motivo del rechazo:');
    if (!motivo) return;

    try {
        await supabase
            .from('solicitudes_modificacion')
            .update({
                estado: 'rechazada',
                aprobador_id: auth.getUsuario().id,
                fecha_aprobacion: new Date().toISOString(),
                observaciones_aprobacion: motivo
            })
            .eq('id', solicitudId);

        mostrarNotificacion('✅ Solicitud rechazada', 'success');
        await cargarMetricas();
        await cargarSolicitudesRecientes();
        await cargarSolicitudes();

    } catch(error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

// ============================================
// NAVEGACIÓN
// ============================================

window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const seccionEl = document.getElementById(seccion);
    if (seccionEl) seccionEl.classList.add('active');
    
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    if (seccion === 'ots') cargarTodasLasOTs();
    if (seccion === 'cotizaciones') cargarCotizaciones();
    if (seccion === 'solicitudes') cargarSolicitudes();
}
window.mostrarModalCambiarPassword = mostrarModalCambiarPassword;
window.cerrarSesion = () => auth.logout();