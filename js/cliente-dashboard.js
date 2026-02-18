// js/cliente-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion, formatearMoneda, formatearFecha, formatearFechaHora } from './utils.js';

const dash = new DashboardBase(['cliente_final']);

let clienteId = null;
let misVehiculos = [];
let vehiculoSeleccionado = null;

(async () => {
    if (!await dash.inicializar()) return;
    
    // Obtener cliente_id del usuario
    const usuario = auth.getUsuario();
    clienteId = usuario.cliente_id;
    
    if (!clienteId) {
        mostrarNotificacion('⚠️ Su usuario no está vinculado a un cliente. Contacte al administrador.', 'warning');
        return;
    }

    await cargarVehiculos();
})();

async function cargarVehiculos() {
    try {
        const { data, error } = await supabase
            .from('vehiculos')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('activo', true)
            .order('placa');

        if (error) throw error;

        misVehiculos = data || [];

        if (misVehiculos.length === 0) {
            document.getElementById('listaVehiculos').innerHTML = 
                '<div class="card"><p style="color:var(--gray-700);padding:2rem;text-align:center;">' +
                'No tiene vehículos registrados. Contacte al taller para registrar su vehículo.</p></div>';
            return;
        }

        // Mostrar resumen de vehículos
        const resumenHTML = `
            <div class="card" style="margin-bottom:1.5rem;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;">
                <h2 style="color:white;margin:0 0 1rem;">📊 Resumen de Vehículos</h2>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;">
                    <div>
                        <div style="font-size:2.5rem;font-weight:700;">${misVehiculos.length}</div>
                        <div style="opacity:.9;">Vehículos Registrados</div>
                    </div>
                    <div>
                        <div style="font-size:2.5rem;font-weight:700;" id="totalOTsCliente">-</div>
                        <div style="opacity:.9;">Total OTs</div>
                    </div>
                    <div>
                        <div style="font-size:2.5rem;font-weight:700;" id="totalGastadoCliente">$0</div>
                        <div style="opacity:.9;">Total Gastado</div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('listaVehiculos').insertAdjacentHTML('afterbegin', resumenHTML);

        renderizarVehiculos();

        // Llenar select de filtros
        const selectFiltro = document.getElementById('filtroVehiculoOT');
        selectFiltro.innerHTML = '<option value="">Todos los vehículos (' + misVehiculos.length + ')</option>' +
            misVehiculos.map(v => `<option value="${v.id}">${v.placa} - ${v.marca} ${v.linea}</option>`).join('');

        // Calcular totales
        await calcularTotalesCliente();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error cargando vehículos', 'error');
    }
}

async function calcularTotalesCliente() {
    const { data: ots } = await supabase
        .from('ordenes_trabajo')
        .select('total')
        .eq('cliente_id', clienteId);

    const totalOTs = ots?.length || 0;
    const totalGastado = ots?.reduce((sum, ot) => sum + parseFloat(ot.total || 0), 0) || 0;

    document.getElementById('totalOTsCliente').textContent = totalOTs;
    document.getElementById('totalGastadoCliente').textContent = formatearMoneda(totalGastado);
}

function renderizarVehiculos() {
    const html = misVehiculos.map(v => `
        <div class="vehiculo-card" onclick="verDetalleVehiculo(${v.id})">
            <div style="display:flex;justify-content:space-between;align-items:start;">
                <div style="flex:1;">
                    <h3 style="margin:0 0 .5rem;color:var(--primary);">${v.placa}</h3>
                    <p style="color:var(--gray-700);margin:0;">
                        <strong>${v.marca || ''} ${v.linea || ''} ${v.modelo || ''}</strong><br>
                        Color: ${v.color || 'N/A'} | 
                        KM: ${v.kilometraje?.toLocaleString() || 'N/A'}<br>
                        ${v.vin ? `VIN: ${v.vin}<br>` : ''}
                        ${v.tipo_vehiculo ? `Tipo: ${v.tipo_vehiculo}` : ''}
                    </p>
                </div>
                <div style="font-size:3rem;">🚗</div>
            </div>
            <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--gray-200);">
                <button onclick="event.stopPropagation();verHistorialCompleto(${v.id})" 
                        class="btn btn-primary" style="margin-right:.5rem;">
                    📋 Ver Historial Completo
                </button>
                <button onclick="event.stopPropagation();verOTsVehiculo(${v.id})" 
                        class="btn btn-secondary">
                    🔧 Ver Órdenes de Trabajo
                </button>
            </div>
        </div>
    `).join('');

    document.getElementById('listaVehiculos').innerHTML = html;
}

window.verDetalleVehiculo = async function(vehiculoId) {
    vehiculoSeleccionado = misVehiculos.find(v => v.id === vehiculoId);
    if (!vehiculoSeleccionado) return;

    const { data: historial } = await supabase
        .from('v_historial_vehiculo_detallado')
        .select('*')
        .eq('vehiculo_id', vehiculoId)
        .order('fecha_ingreso', { ascending: false });

    const totalOTs = historial?.filter(h => h.ot_id).length || 0;
    const totalGastado = historial?.reduce((sum, h) => sum + parseFloat(h.ot_total || 0), 0) || 0;

    document.getElementById('tituloVehiculo').textContent = 
        `${vehiculoSeleccionado.placa} - ${vehiculoSeleccionado.marca} ${vehiculoSeleccionado.linea}`;

    const detalle = `
        <div class="card" style="margin-bottom:1.5rem;">
            <h3>📋 Información del Vehículo</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div>
                    <strong>Placa:</strong> ${vehiculoSeleccionado.placa}<br>
                    <strong>Marca:</strong> ${vehiculoSeleccionado.marca || 'N/A'}<br>
                    <strong>Línea:</strong> ${vehiculoSeleccionado.linea || 'N/A'}<br>
                    <strong>Modelo:</strong> ${vehiculoSeleccionado.modelo || 'N/A'}<br>
                    <strong>Color:</strong> ${vehiculoSeleccionado.color || 'N/A'}
                </div>
                <div>
                    <strong>VIN:</strong> ${vehiculoSeleccionado.vin || 'N/A'}<br>
                    <strong>Tipo:</strong> ${vehiculoSeleccionado.tipo_vehiculo || 'N/A'}<br>
                    <strong>Kilometraje:</strong> ${vehiculoSeleccionado.kilometraje?.toLocaleString() || 'N/A'} km<br>
                    <strong>Total Servicios:</strong> ${totalOTs}<br>
                    <strong>Total Gastado:</strong> <span style="color:var(--success);font-weight:700;">${formatearMoneda(totalGastado)}</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('detalleVehiculo').innerHTML = detalle;

    const htmlHistorial = `
        <div class="card">
            <h3>🕒 Historial Completo</h3>
            ${await renderizarHistorialCompleto(vehiculoId)}
        </div>
    `;

    document.getElementById('historialVehiculo').innerHTML = htmlHistorial;
    document.getElementById('modalVehiculo').classList.add('active');
}

async function renderizarHistorialCompleto(vehiculoId) {
    const { data } = await supabase
        .from('v_historial_vehiculo_detallado')
        .select('*')
        .eq('vehiculo_id', vehiculoId)
        .order('fecha_ingreso', { ascending: false });

    if (!data || data.length === 0) {
        return '<p style="color:var(--gray-700);padding:1rem;">Sin historial de servicios</p>';
    }

    return data.map(h => `
        <div class="timeline-item">
            <div class="timeline-icon">🔧</div>
            <div class="timeline-content">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:.5rem;">
                    <div>
                        <strong style="color:var(--primary);">${h.numero_ot || 'OT-' + h.ot_id}</strong>
                        <span class="badge badge-${
                            h.ot_estado === 'completada' ? 'green' : 
                            h.ot_estado === 'en_proceso' ? 'blue' : 'orange'
                        }" style="margin-left:.5rem;">${h.ot_estado}</span>
                    </div>
                    <div style="text-align:right;">
                        <strong style="color:var(--success);font-size:1.25rem;">
                            ${formatearMoneda(h.ot_total)}
                        </strong>
                    </div>
                </div>
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:.5rem 0;">
                    <div>
                        <small style="color:var(--gray-700);">
                            📅 <strong>Ingreso:</strong> ${formatearFecha(h.fecha_ingreso)}<br>
                            ${h.fecha_finalizacion ? `✅ <strong>Finalización:</strong> ${formatearFecha(h.fecha_finalizacion)}<br>` : ''}
                            🔧 <strong>Mecánico:</strong> ${h.mecanico_nombre || 'N/A'}<br>
                            📊 <strong>KM Ingreso:</strong> ${h.kilometraje_ingreso?.toLocaleString() || 'N/A'}
                        </small>
                    </div>
                    <div>
                        ${h.numero_factura ? `
                            <small style="color:var(--gray-700);">
                                💰 <strong>Factura:</strong> ${h.numero_factura}<br>
                                📅 ${formatearFecha(h.fecha_factura)}<br>
                                💵 ${formatearMoneda(h.factura_total)}
                            </small>
                        ` : '<small style="color:var(--warning);">Sin factura generada</small>'}
                    </div>
                </div>

                ${h.diagnostico ? `
                    <div style="background:var(--gray-50);padding:.75rem;border-radius:.5rem;margin:.5rem 0;">
                        <strong>🔍 Diagnóstico:</strong><br>
                        ${h.diagnostico}
                    </div>
                ` : ''}

                ${h.recomendaciones ? `
                    <div style="background:#dbeafe;padding:.75rem;border-radius:.5rem;margin:.5rem 0;">
                        <strong>💡 Recomendaciones:</strong><br>
                        ${h.recomendaciones}
                    </div>
                ` : ''}

                <div style="margin-top:.75rem;">
                    <button onclick="verDetalleOT(${h.ot_id})" class="btn btn-primary" 
                            style="padding:.5rem 1rem;font-size:.875rem;margin-right:.5rem;">
                        📋 Ver Detalle Completo
                    </button>
                    ${h.numero_factura ? `
                        <button onclick="descargarFactura(${h.factura_id})" class="btn btn-secondary" 
                                style="padding:.5rem 1rem;font-size:.875rem;">
                            📄 Descargar Factura
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

window.verDetalleOT = async function(otId) {
    // Obtener detalle completo de la OT
    const { data: ot } = await supabase
        .from('v_ordenes_trabajo_completas')
        .select('*')
        .eq('id', otId)
        .single();

    if (!ot) return;

    // Obtener repuestos utilizados
    const { data: repuestos } = await supabase
        .from('v_repuestos_utilizados_ot')
        .select('*')
        .eq('ot_id', otId);

    // Obtener servicios realizados
    const { data: servicios } = await supabase
        .from('v_servicios_realizados_ot')
        .select('*')
        .eq('ot_id', otId);

    // Obtener mano de obra
    const { data: manoObra } = await supabase
        .from('v_mano_obra_ot')
        .select('*')
        .eq('ot_id', otId);

    let detalleHTML = `
        <div class="modal" style="display:flex;" onclick="if(event.target===this) this.remove()">
            <div class="modal-content" style="max-width:900px;">
                <h2>🔧 Detalle de Orden de Trabajo</h2>
                
                <div class="card" style="margin-bottom:1rem;">
                    <h3>${ot.numero_ot}</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <strong>Estado:</strong> 
                            <span class="badge badge-${ot.estado === 'completada' ? 'green' : 'blue'}">
                                ${ot.estado}
                            </span><br>
                            <strong>Ingreso:</strong> ${formatearFecha(ot.fecha_ingreso)}<br>
                            ${ot.fecha_finalizacion ? `<strong>Finalización:</strong> ${formatearFecha(ot.fecha_finalizacion)}<br>` : ''}
                            <strong>Mecánico:</strong> ${ot.mecanico_nombre || 'N/A'}
                        </div>
                        <div style="text-align:right;">
                            <strong>Total:</strong><br>
                            <span style="font-size:2rem;color:var(--success);font-weight:700;">
                                ${formatearMoneda(ot.total)}
                            </span>
                        </div>
                    </div>
                </div>

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
                                <th>Precio Unit.</th>
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

                ${manoObra && manoObra.length > 0 ? `
                <div class="card">
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

                <button onclick="this.closest('.modal').remove()" class="btn btn-secondary" 
                        style="width:100%;margin-top:1rem;">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', detalleHTML);
}

window.verHistorialCompleto = function(vehiculoId) {
    window.location.href = `historial-vehiculo.html?vehiculo_id=${vehiculoId}`;
}

window.verOTsVehiculo = function(vehiculoId) {
    cambiarSeccion('ots');
    document.getElementById('filtroVehiculoOT').value = vehiculoId;
    filtrarOTs();
}

window.filtrarOTs = async function() {
    const vehiculoId = document.getElementById('filtroVehiculoOT').value;

    let query = supabase
        .from('v_ordenes_trabajo_completas')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    if (vehiculoId) {
        query = query.eq('vehiculo_id', vehiculoId);
    }

    const { data } = await query;

    renderizarOTs(data || []);
}

function renderizarOTs(ots) {
    const html = ots.map(ot => `
        <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:start;">
                <div style="flex:1;">
                    <h3>${ot.numero_ot}</h3>
                    <span class="badge badge-${
                        ot.estado === 'pendiente' ? 'orange' :
                        ot.estado === 'en_proceso' ? 'blue' :
                        ot.estado === 'completada' ? 'green' : 'blue'
                    }">${ot.estado}</span>
                    <p style="color:var(--gray-700);margin:.5rem 0;">
                        <strong>Vehículo:</strong> ${ot.vehiculo_placa}<br>
                        <strong>Ingreso:</strong> ${formatearFecha(ot.fecha_ingreso)}<br>
                        ${ot.fecha_compromiso ? `<strong>Compromiso:</strong> ${formatearFecha(ot.fecha_compromiso)}<br>` : ''}
                        ${ot.mecanico_nombre ? `<strong>Mecánico:</strong> ${ot.mecanico_nombre}<br>` : ''}
                    </p>
                    ${ot.diagnostico ? `
                        <div style="background:var(--gray-50);padding:1rem;border-radius:.5rem;margin-top:.5rem;">
                            <strong>Diagnóstico:</strong><br>${ot.diagnostico}
                        </div>
                    ` : ''}
                    ${ot.recomendaciones ? `
                        <div style="background:#dbeafe;padding:1rem;border-radius:.5rem;margin-top:.5rem;">
                            <strong>Recomendaciones:</strong><br>${ot.recomendaciones}
                        </div>
                    ` : ''}
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--primary);">
                        ${formatearMoneda(ot.total)}
                    </div>
                    <button onclick="verDetalleOT(${ot.id})" class="btn btn-primary" 
                            style="margin-top:.5rem;">
                        Ver Detalle
                    </button>
                </div>
            </div>
        </div>
    `).join('') || '<p>No tiene órdenes de trabajo</p>';

    document.getElementById('listaOTs').innerHTML = html;
}

// Cargar OTs al cambiar a la sección
window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(seccion).classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    if (seccion === 'ots') filtrarOTs();
    if (seccion === 'facturas') cargarFacturas();
    if (seccion === 'cotizaciones') cargarCotizaciones();
}

async function cargarFacturas() {
    const { data } = await supabase
        .from('facturas')
        .select('*, ordenes_trabajo(numero_ot), vehiculos(placa)')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    const html = (data || []).map(f => `
        <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h3>${f.numero_factura}</h3>
                    <p style="color:var(--gray-700);margin:.25rem 0;">
                        OT: ${f.ordenes_trabajo?.numero_ot || 'N/A'}<br>
                        Fecha: ${formatearFecha(f.fecha_factura || f.created_at)}<br>
                        ${f.metodo_pago ? `Método: ${f.metodo_pago}` : ''}
                    </p>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--success);">
                        ${formatearMoneda(f.total)}
                    </div>
                    ${f.siigo_pdf_url ? `
                        <a href="${f.siigo_pdf_url}" class="btn btn-secondary" 
                           style="margin-top:.5rem;padding:.5rem 1rem;font-size:.875rem;">
                            📄 Descargar PDF
                        </a>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('') || '<p>No tiene facturas</p>';

    document.getElementById('listaFacturas').innerHTML = html;
}

async function cargarCotizaciones() {
    const { data } = await supabase
        .from('v_cotizaciones_completas')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

    const html = (data || []).map(c => `
        <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:start;">
                <div>
                    <h3>${c.folio}</h3>
                    <span class="badge badge-${
                        c.estado === 'pendiente' ? 'orange' :
                        c.estado === 'aprobada' ? 'green' : 'danger'
                    }">${c.estado}</span>
                    <p style="color:var(--gray-700);margin:.5rem 0;">
                        Vehículo: ${c.vehiculo_placa}<br>
                        Fecha: ${formatearFecha(c.fecha_cotizacion)}<br>
                        ${c.fecha_vencimiento ? `Válida hasta: ${formatearFecha(c.fecha_vencimiento)}` : ''}
                    </p>
                    ${c.observaciones ? `<p><small>${c.observaciones}</small></p>` : ''}
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--primary);">
                        ${formatearMoneda(c.total)}
                    </div>
                    ${c.pdf_url ? `
                        <a href="${c.pdf_url}" class="btn btn-secondary"
                           style="margin-top:.5rem;padding:.5rem 1rem;font-size:.875rem;">
                            📄 Ver PDF
                        </a>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('') || '<p>No tiene cotizaciones</p>';

    document.getElementById('listaCotizaciones').innerHTML = html;
}

window.descargarFactura = (facturaId) => {
    mostrarNotificacion('Descarga de factura - Por implementar con SIIGO', 'info');
}

window.cerrarModal = () => document.getElementById('modalVehiculo').classList.remove('active');
window.cerrarSesion = () => auth.logout();