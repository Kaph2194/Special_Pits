// js/caja-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion, formatearMoneda, formatearFecha } from './utils.js';
import { siigoService } from './siigo-service.js';
import { whatsappService } from './whatsapp-business.js';

const dash = new DashboardBase(['superadmin','cajero']);

(async () => {
    if (!await dash.inicializar()) return;
    await cargarDashboard();
    await cargarOTsPendientes();
    await cargarFacturas();
})();

async function cargarDashboard() {
    try {
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        // OTs completadas sin facturar
        const { count: otsPend } = await supabase
            .from('ordenes_trabajo')
            .select('*', {count:'exact',head:true})
            .eq('estado', 'completada');

        // Facturas de hoy
        const { data: facturasHoy, count: countHoy } = await supabase
            .from('facturas')
            .select('total', {count:'exact'})
            .gte('created_at', hoy.toISOString());

        const totalHoy = facturasHoy?.reduce((s, f) => s + parseFloat(f.total || 0), 0) || 0;

        // Total del mes
        const { data: facturasMes } = await supabase
            .from('facturas')
            .select('total')
            .gte('created_at', inicioMes.toISOString());

        const totalMes = facturasMes?.reduce((s, f) => s + parseFloat(f.total || 0), 0) || 0;

        document.getElementById('otsPendientesFacturar').textContent = otsPend ?? 0;
        document.getElementById('facturasHoy').textContent = countHoy ?? 0;
        document.getElementById('totalFacturadoHoy').textContent = formatearMoneda(totalHoy);
        document.getElementById('totalMes').textContent = formatearMoneda(totalMes);

        // Alertas de OTs completadas
        const { data: otsCompletadas } = await supabase
            .from('v_ordenes_trabajo_completas')
            .select('*')
            .eq('estado', 'completada')
            .order('fecha_finalizacion', { ascending: true })
            .limit(10);

        const htmlAlertas = (otsCompletadas || []).map(ot => `
            <div class="card" style="margin-bottom:.75rem;padding:1rem;background:#fef3c7;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${ot.numero_ot}</strong> - ${ot.vehiculo_placa}<br>
                        <small>Cliente: ${ot.cliente_nombre} | Total: ${formatearMoneda(ot.total)}</small><br>
                        <small>Completada: ${formatearFecha(ot.fecha_finalizacion)}</small>
                    </div>
                    <button onclick="facturarOT(${ot.id})" class="btn btn-success">
                        💳 Facturar
                    </button>
                </div>
            </div>
        `).join('') || '<p>No hay OTs pendientes de facturar ✅</p>';

        document.getElementById('alertasOTsCompletadas').innerHTML = htmlAlertas;

    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarOTsPendientes() {
    const { data } = await supabase
        .from('v_ordenes_trabajo_completas')
        .select('*')
        .eq('estado', 'completada')
        .order('fecha_finalizacion');

    const html = (data || []).map(ot => `
        <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:start;">
                <div style="flex:1;">
                    <h3>${ot.numero_ot}</h3>
                    <p style="color:var(--gray-700);margin:.25rem 0;">
                        <strong>Cliente:</strong> ${ot.cliente_nombre}<br>
                        <strong>Vehículo:</strong> ${ot.vehiculo_placa} - ${ot.vehiculo_marca} ${ot.vehiculo_linea}<br>
                        <strong>Mecánico:</strong> ${ot.mecanico_nombre || 'N/A'}<br>
                        <strong>Completada:</strong> ${formatearFecha(ot.fecha_finalizacion)}
                    </p>
                    ${ot.diagnostico ? `<p><strong>Diagnóstico:</strong> ${ot.diagnostico}</p>` : ''}
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.5rem;font-weight:700;color:var(--success);">
                        ${formatearMoneda(ot.total)}
                    </div>
                    <button onclick="facturarOT(${ot.id})" class="btn btn-success" style="margin-top:1rem;">
                        💳 Facturar en SIIGO
                    </button>
                </div>
            </div>
        </div>
    `).join('') || '<p>No hay OTs pendientes de facturar</p>';

    document.getElementById('listaOTsPendientes').innerHTML = html;
}

window.facturarOT = async function(otId) {
    if (!confirm('¿Generar factura en SIIGO para esta OT?')) return;

    const btnFacturar = event.target;
    btnFacturar.disabled = true;
    btnFacturar.innerHTML = '<span class="loading"></span> Facturando...';

    try {
        // Obtener datos completos de la OT
        const { data: ot, error: otError } = await supabase
            .from('v_ordenes_trabajo_completas')
            .select('*')
            .eq('id', otId)
            .single();

        if (otError) throw otError;

        // Obtener cliente
        const { data: cliente, error: clienteError } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', ot.cliente_id)
            .single();

        if (clienteError) throw clienteError;

        // Obtener items de la OT (repuestos + servicios + mano de obra)
        // TODO: Implementar cuando tengamos el detalle de OT
        const items = [
            {
                codigo: 'SERV-001',
                descripcion: ot.observaciones_finalizacion || 'Servicio Automotriz',
                cantidad: 1,
                precio_unitario: ot.subtotal || 0,
                descuento: 0,
                iva: ot.iva_total || 0
            }
        ];

        // Crear factura en SIIGO
        mostrarNotificacion('📤 Enviando factura a SIIGO...', 'info');
        
        const resultado = await siigoService.crearFactura(ot, cliente, items);

        if (!resultado.success) {
            throw new Error(resultado.error || 'Error creando factura en SIIGO');
        }

        // Actualizar estado de OT
        await supabase
            .from('ordenes_trabajo')
            .update({ estado: 'facturada' })
            .eq('id', otId);

        // Enviar notificación por WhatsApp
        if (cliente.telefono) {
            await whatsappService.notificarFacturaEmitida({
                ...resultado.factura,
                cliente_telefono: cliente.telefono
            });
        }

        mostrarNotificacion('✅ Factura creada exitosamente en SIIGO', 'success');
        
        await cargarDashboard();
        await cargarOTsPendientes();
        await cargarFacturas();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    } finally {
        btnFacturar.disabled = false;
        btnFacturar.innerHTML = '💳 Facturar';
    }
}

async function cargarFacturas() {
    const { data } = await supabase
        .from('facturas')
        .select('*, ordenes_trabajo(numero_ot), clientes(razon_social)')
        .order('created_at', { ascending: false })
        .limit(50);

    dash.renderTabla('tablaFacturas', [
        { key: 'numero_factura', label: 'No. Factura' },
        { key: 'id', label: 'Cliente',
          render: r => r.clientes?.razon_social || 'N/A' },
        { key: 'id', label: 'OT',
          render: r => r.ordenes_trabajo?.numero_ot || 'N/A' },
        { key: 'total', label: 'Total', tipo: 'moneda' },
        { key: 'metodo_pago', label: 'Método Pago' },
        { key: 'estado', label: 'Estado', tipo: 'badge',
          color: r => ({ emitida:'green', anulada:'danger' })[r.estado] ?? 'blue' },
        { key: 'created_at', label: 'Fecha', tipo: 'fechahora' }
    ], data || [], [
        { label:'Ver PDF', icono:'📄', fn:'verFacturaPDF', tipo:'secondary' }
    ]);
}
// AGREGAR DESPUÉS DE LA FUNCIÓN cargarFacturas

window.filtrarFacturas = async function() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;

    let query = supabase
        .from('facturas')
        .select('*, ordenes_trabajo(numero_ot, vehiculo_id, vehiculos(placa)), clientes(razon_social)')
        .order('created_at', { ascending: false });

    if (desde) {
        query = query.gte('created_at', desde + 'T00:00:00');
    }
    if (hasta) {
        query = query.lte('created_at', hasta + 'T23:59:59');
    }

    const { data } = await query;

    dash.renderTabla('tablaFacturas', [
        { key: 'numero_factura', label: 'No. Factura' },
        { key: 'id', label: 'Cliente',
          render: r => r.clientes?.razon_social || 'N/A' },
        { key: 'id', label: 'OT',
          render: r => r.ordenes_trabajo?.numero_ot || 'N/A' },
        { key: 'id', label: 'Vehículo',
          render: r => r.ordenes_trabajo?.vehiculos?.placa || 'N/A' },
        { key: 'total', label: 'Total', tipo: 'moneda' },
        { key: 'metodo_pago', label: 'Método' },
        { key: 'estado', label: 'Estado', tipo: 'badge',
          color: r => ({ emitida:'green', anulada:'danger' })[r.estado] ?? 'blue' },
        { key: 'created_at', label: 'Fecha', tipo: 'fechahora' }
    ], data || [], [
        { label:'Ver Detalle', icono:'👁️', fn:'verDetalleFactura', tipo:'secondary' }
    ]);
}

// AGREGAR FUNCIÓN verDetalleFactura
window.verDetalleFactura = async function(facturaId) {
    const { data: factura } = await supabase
        .from('facturas')
        .select(`
            *,
            ordenes_trabajo(
                *,
                vehiculos(placa, marca, linea),
                usuarios!mecanico_asignado_id(nombre)
            ),
            clientes(razon_social, nit, telefono)
        `)
        .eq('id', facturaId)
        .single();

    if (!factura) return;

    // Obtener items de la OT
    const ot = factura.ordenes_trabajo;
    let itemsHTML = '';

    if (ot?.cotizacion_id) {
        const { data: repuestos } = await supabase
            .from('v_repuestos_utilizados_ot')
            .select('*')
            .eq('ot_id', ot.id);

        const { data: servicios } = await supabase
            .from('v_servicios_realizados_ot')
            .select('*')
            .eq('ot_id', ot.id);

        const { data: manoObra } = await supabase
            .from('v_mano_obra_ot')
            .select('*')
            .eq('ot_id', ot.id);

        if (repuestos && repuestos.length > 0) {
            itemsHTML += `
                <div class="card" style="margin-bottom:1rem;">
                    <h4>🔩 Repuestos</h4>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
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
                                    <td>${r.cantidad}</td>
                                    <td>${formatearMoneda(r.precio_unitario)}</td>
                                    <td>${formatearMoneda(r.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (servicios && servicios.length > 0) {
            itemsHTML += `
                <div class="card" style="margin-bottom:1rem;">
                    <h4>⚙️ Servicios</h4>
                    ${servicios.map(s => `
                        <div style="padding:.5rem;border-bottom:1px solid var(--gray-200);">
                            <strong>${s.servicio_nombre}</strong><br>
                            <small>${s.servicio_descripcion || ''}</small>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (manoObra && manoObra.length > 0) {
            itemsHTML += `
                <div class="card">
                    <h4>👷 Mano de Obra</h4>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Descripción</th>
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
            `;
        }
    }

    const modal = `
        <div class="modal" style="display:flex;" onclick="if(event.target===this) this.remove()">
            <div class="modal-content" style="max-width:900px;">
                <h2>📄 Detalle de Factura</h2>
                
                <div class="card" style="margin-bottom:1rem;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <h3>${factura.numero_factura}</h3>
                            <strong>Cliente:</strong> ${factura.clientes?.razon_social}<br>
                            <strong>NIT:</strong> ${factura.clientes?.nit}<br>
                            <strong>Teléfono:</strong> ${factura.clientes?.telefono || 'N/A'}<br>
                            <strong>Fecha:</strong> ${formatearFecha(factura.fecha_factura || factura.created_at)}
                        </div>
                        <div>
                            <strong>OT:</strong> ${ot?.numero_ot || 'N/A'}<br>
                            <strong>Vehículo:</strong> ${ot?.vehiculos?.placa || 'N/A'}<br>
                            <strong>Mecánico:</strong> ${ot?.usuarios?.nombre || 'N/A'}<br>
                            <strong>Método Pago:</strong> ${factura.metodo_pago || 'N/A'}
                        </div>
                    </div>
                </div>

                ${itemsHTML}

                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <strong>Subtotal:</strong> ${formatearMoneda(factura.subtotal)}<br>
                            <strong>IVA:</strong> ${formatearMoneda(factura.iva)}<br>
                        </div>
                        <div style="text-align:right;">
                            <strong style="font-size:1.5rem;color:var(--success);">
                                TOTAL: ${formatearMoneda(factura.total)}
                            </strong>
                        </div>
                    </div>
                </div>

                <div style="display:flex;gap:1rem;margin-top:1rem;">
                    ${factura.siigo_pdf_url ? `
                        <a href="${factura.siigo_pdf_url}" class="btn btn-primary" style="flex:1;">
                            📄 Descargar PDF
                        </a>
                    ` : ''}
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary" style="flex:1;">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
}

window.verFacturaPDF = (id) => mostrarNotificacion('PDF de factura - Por implementar con SIIGO', 'info');

window.filtrarFacturas = async function() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;

    let query = supabase
        .from('facturas')
        .select('*, ordenes_trabajo(numero_ot), clientes(razon_social)')
        .order('created_at', { ascending: false });

    if (desde) query = query.gte('created_at', desde);
    if (hasta) query = query.lte('created_at', hasta);

    const { data } = await query;

    dash.renderTabla('tablaFacturas', [
        { key: 'numero_factura', label: 'No. Factura' },
        { key: 'id', label: 'Cliente',
          render: r => r.clientes?.razon_social || 'N/A' },
        { key: 'total', label: 'Total', tipo: 'moneda' },
        { key: 'created_at', label: 'Fecha', tipo: 'fechahora' }
    ], data || []);
}

// MEJORAR generarCierreCaja
window.generarCierreCaja = async function() {
    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    const { data: facturas } = await supabase
        .from('facturas')
        .select('total, metodo_pago, numero_factura, created_at')
        .gte('created_at', hoy.toISOString())
        .eq('estado', 'emitida');

    const efectivo = facturas?.filter(f => f.metodo_pago === 'efectivo')
        .reduce((s, f) => s + parseFloat(f.total || 0), 0) || 0;
    const tarjeta = facturas?.filter(f => f.metodo_pago === 'tarjeta')
        .reduce((s, f) => s + parseFloat(f.total || 0), 0) || 0;
    const transferencia = facturas?.filter(f => f.metodo_pago === 'transferencia')
        .reduce((s, f) => s + parseFloat(f.total || 0), 0) || 0;

    const total = efectivo + tarjeta + transferencia;

    const html = `
        <div style="margin-bottom:1.5rem;">
            <h4>📊 Cierre de Caja - ${formatearFecha(new Date())}</h4>
        </div>

        <table class="table">
            <thead>
                <tr>
                    <th>Método de Pago</th>
                    <th>Facturas</th>
                    <th style="text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>💵 Efectivo</strong></td>
                    <td>${facturas?.filter(f => f.metodo_pago === 'efectivo').length || 0}</td>
                    <td style="text-align:right;">${formatearMoneda(efectivo)}</td>
                </tr>
                <tr>
                    <td><strong>💳 Tarjeta</strong></td>
                    <td>${facturas?.filter(f => f.metodo_pago === 'tarjeta').length || 0}</td>
                    <td style="text-align:right;">${formatearMoneda(tarjeta)}</td>
                </tr>
                <tr>
                    <td><strong>🏦 Transferencia</strong></td>
                    <td>${facturas?.filter(f => f.metodo_pago === 'transferencia').length || 0}</td>
                    <td style="text-align:right;">${formatearMoneda(transferencia)}</td>
                </tr>
                <tr style="border-top:2px solid var(--gray-900);font-weight:700;">
                    <td><strong>TOTAL</strong></td>
                    <td>${facturas?.length || 0}</td>
                    <td style="text-align:right;font-size:1.25rem;color:var(--success);">
                        ${formatearMoneda(total)}
                    </td>
                </tr>
            </tbody>
        </table>

        <div style="margin-top:1.5rem;">
            <h4>📋 Detalle de Facturas</h4>
            <div style="max-height:300px;overflow-y:auto;">
                ${(facturas || []).map(f => `
                    <div style="display:flex;justify-content:space-between;padding:.5rem;border-bottom:1px solid var(--gray-200);">
                        <div>
                            <strong>${f.numero_factura}</strong><br>
                            <small>${formatearFechaHora(f.created_at)} - ${f.metodo_pago}</small>
                        </div>
                        <strong>${formatearMoneda(f.total)}</strong>
                    </div>
                `).join('')}
            </div>
        </div>

        <button onclick="imprimirCierre()" class="btn btn-primary" style="width:100%;margin-top:1rem;">
            🖨️ Imprimir Cierre
        </button>
    `;

    document.getElementById('resumenCierre').innerHTML = html;
    mostrarNotificacion('✅ Cierre generado', 'success');
}
// AGREGAR FUNCIÓN imprimir cierre
window.imprimirCierre = function() {
    window.print();
}

window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(seccion).classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');
}

window.cerrarSesion = () => auth.logout();
