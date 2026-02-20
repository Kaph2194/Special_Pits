// js/financiero-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { formatearMoneda, formatearFecha } from './utils.js';
import { mostrarModalCambiarPassword } from './cambiar-password.js';
import { notificacionesRealtime, NotificacionesRealtime } from './notifications-realtime.js';

const dash = new DashboardBase(['superadmin','cliente_financiero','cliente_gerencia']);

let chartIngresosCostos = null;
let chartUtilidad = null;

(async () => {
    if (!await dash.inicializar()) return;
    await cargarKPIs();
    await cargarIngresos();
    await cargarInventario();
    await cargarFacturas();
})();

async function cargarKPIs() {
    try {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0,0,0,0);

        const inicioMesAnterior = new Date(inicioMes);
        inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);

        // 1. INGRESOS DEL MES (OTs completadas y facturadas)
        const { data: otsActual } = await supabase
            .from('ordenes_trabajo')
            .select('total, subtotal, iva_total')
            .in('estado', ['completada', 'facturada'])
            .gte('fecha_finalizacion', inicioMes.toISOString());

        const ingresosActual = otsActual?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;
        const subtotalActual = otsActual?.reduce((s, o) => s + parseFloat(o.subtotal || 0), 0) || 0;

        // 2. INGRESOS MES ANTERIOR
        const { data: otsAnterior } = await supabase
            .from('ordenes_trabajo')
            .select('total')
            .in('estado', ['completada', 'facturada'])
            .gte('fecha_finalizacion', inicioMesAnterior.toISOString())
            .lt('fecha_finalizacion', inicioMes.toISOString());

        const ingresosAnterior = otsAnterior?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;

        // 3. COSTOS DEL MES (repuestos utilizados en cotizaciones aprobadas)
        const { data: cotizacionesMes } = await supabase
            .from('cotizaciones')
            .select('id')
            .eq('estado', 'aprobada')
            .gte('created_at', inicioMes.toISOString());

        let costosRepuestos = 0;
        if (cotizacionesMes && cotizacionesMes.length > 0) {
            const { data: repuestosUsados } = await supabase
                .from('cotizacion_repuestos')
                .select('cantidad, repuestos(costo_unitario)')
                .in('cotizacion_id', cotizacionesMes.map(c => c.id));

            costosRepuestos = repuestosUsados?.reduce((s, r) => {
                const costo = r.repuestos?.costo_unitario || 0;
                return s + (r.cantidad * costo);
            }, 0) || 0;
        }

        // Estimación de otros costos (30% de mano de obra)
        const costosManoObra = subtotalActual * 0.30;
        const costosTotal = costosRepuestos + costosManoObra;

        // 4. UTILIDAD
        const utilidad = ingresosActual - costosTotal;
        const margen = ingresosActual > 0 ? (utilidad / ingresosActual * 100) : 0;

        // 5. OTs COMPLETADAS
        const cantidadOTs = otsActual?.length || 0;
        const ticketPromedio = cantidadOTs > 0 ? ingresosActual / cantidadOTs : 0;

        // 6. VALOR INVENTARIO
        const { data: repuestos } = await supabase
            .from('repuestos')
            .select('stock_actual, costo_unitario')
            .eq('activo', true);

        const valorInventario = repuestos?.reduce((s, r) => 
            s + ((r.stock_actual || 0) * (r.costo_unitario || 0)), 0) || 0;

        // 7. FACTURAS
        const { data: facturas, count: countFacturas } = await supabase
            .from('facturas')
            .select('total', {count:'exact'})
            .gte('created_at', inicioMes.toISOString());

        const totalFacturado = facturas?.reduce((s, f) => s + parseFloat(f.total || 0), 0) || 0;
        const promedioFactura = countFacturas > 0 ? totalFacturado / countFacturas : 0;

        // ACTUALIZAR UI
        document.getElementById('ingresosMes').textContent = formatearMoneda(ingresosActual);
        document.getElementById('costosMes').textContent = formatearMoneda(costosTotal);
        document.getElementById('utilidadMes').textContent = formatearMoneda(utilidad);
        document.getElementById('otsCompletadas').textContent = cantidadOTs;
        document.getElementById('valorInventario').textContent = formatearMoneda(valorInventario);
        document.getElementById('totalFacturas').textContent = countFacturas || 0;

        // Cambio vs mes anterior
        const cambio = ingresosAnterior > 0 
            ? ((ingresosActual - ingresosAnterior) / ingresosAnterior * 100)
            : 0;

        const elCambio = document.getElementById('cambioIngresos');
        if (elCambio) {
            elCambio.textContent = `${cambio >= 0 ? '↗' : '↘'} ${Math.abs(cambio).toFixed(1)}% vs mes anterior`;
            elCambio.className = `kpi-change ${cambio >= 0 ? 'positive' : 'negative'}`;
        }

        const elMargen = document.getElementById('margenUtilidad');
        if (elMargen) {
            elMargen.textContent = `Margen: ${margen.toFixed(1)}%`;
        }

        const elTicket = document.getElementById('ticketPromedio');
        if (elTicket) {
            elTicket.textContent = `Ticket promedio: ${formatearMoneda(ticketPromedio)}`;
        }

        const elPromFactura = document.getElementById('promedioFactura');
        if (elPromFactura) {
            elPromFactura.textContent = `Promedio: ${formatearMoneda(promedioFactura)}`;
        }

        // CARGAR GRÁFICOS
        await cargarGraficos();

    } catch (error) {
        console.error('Error cargando KPIs:', error);
    }
}

async function cargarGraficos() {
    try {
        // Obtener datos de últimos 6 meses
        const { data: historicoMensual } = await supabase
            .from('v_dashboard_financiero')
            .select('*')
            .order('mes', { ascending: true })
            .limit(6);

        if (!historicoMensual || historicoMensual.length === 0) return;

        const labels = historicoMensual.map(m => 
            new Date(m.mes).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
        );
        
        const ingresos = historicoMensual.map(m => parseFloat(m.ingresos_brutos || 0));
        // Estimar costos como 40% de ingresos
        const costos = ingresos.map(i => i * 0.4);
        const utilidades = ingresos.map((ing, i) => ing - costos[i]);

        // Verificar si Chart.js está disponible
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js no está cargado');
            return;
        }

        // Gráfico Ingresos vs Costos
        const canvasIngresos = document.getElementById('canvasIngresosCostos');
        if (canvasIngresos) {
            const ctx = canvasIngresos.getContext('2d');
            
            if (chartIngresosCostos) {
                chartIngresosCostos.destroy();
            }

            chartIngresosCostos = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Ingresos',
                            data: ingresos,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Costos',
                            data: costos,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + (value/1000000).toFixed(1) + 'M';
                                }
                            }
                        }
                    }
                }
            });
        }

        // Gráfico de Utilidad
        const canvasUtilidad = document.getElementById('canvasUtilidad');
        if (canvasUtilidad) {
            const ctx = canvasUtilidad.getContext('2d');
            
            if (chartUtilidad) {
                chartUtilidad.destroy();
            }

            chartUtilidad = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Utilidad',
                        data: utilidades,
                        backgroundColor: 'rgba(37, 99, 235, 0.8)',
                        borderColor: '#2563eb',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + (value/1000000).toFixed(1) + 'M';
                                }
                            }
                        }
                    }
                }
            });
        }

    } catch (error) {
        console.error('Error cargando gráficos:', error);
    }
}

async function cargarIngresos() {
    const { data } = await supabase
        .from('v_dashboard_financiero')
        .select('*')
        .order('mes', { ascending: false })
        .limit(12);

    dash.renderTabla('tablaIngresos', [
        { key: 'mes', label: 'Mes',
          render: r => new Date(r.mes).toLocaleDateString('es-CO', {year:'numeric',month:'long'}) },
        { key: 'total_ots', label: 'OTs' },
        { key: 'ingresos_brutos', label: 'Ingresos', tipo: 'moneda' },
        { key: 'ticket_promedio', label: 'Ticket Promedio', tipo: 'moneda' },
        { key: 'clientes_atendidos', label: 'Clientes' }
    ], data || []);
}

async function cargarInventario() {
    const { data } = await supabase
        .from('repuestos')
        .select('codigo, nombre, stock_actual, costo_unitario, precio_venta, proveedor_id, proveedores(razon_social)')
        .eq('activo', true)
        .order('stock_actual', { ascending: false })
        .limit(50);

    dash.renderTabla('tablaInventario', [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Repuesto' },
        { key: 'stock_actual', label: 'Stock' },
        { key: 'costo_unitario', label: 'Costo Unit.', tipo: 'moneda' },
        { key: 'precio_venta', label: 'P. Venta', tipo: 'moneda' },
        { key: 'id', label: 'Valor Inv.',
          render: r => formatearMoneda((r.stock_actual || 0) * (r.costo_unitario || 0)) },
        { key: 'id', label: 'Proveedor',
          render: r => r.proveedores?.razon_social || 'N/A' }
    ], data || []);
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
        { key: 'total', label: 'Total', tipo: 'moneda' },
        { key: 'metodo_pago', label: 'Método' },
        { key: 'created_at', label: 'Fecha', tipo: 'fechahora' }
    ], data || []);
}

async function cargarCXP() {
    const { data } = await supabase
        .from('v_cuentas_por_pagar_completas')
        .select('*')
        .order('fecha_vencimiento');

    const deudaTotal = (data || [])
        .filter(c => c.estado !== 'pagada')
        .reduce((s, c) => s + parseFloat(c.saldo_pendiente || 0), 0);

    const deudaVencida = (data || [])
        .filter(c => c.estado === 'vencida')
        .reduce((s, c) => s + parseFloat(c.saldo_pendiente || 0), 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    const pagadoMes = (data || [])
        .filter(c => c.estado === 'pagada' && new Date(c.updated_at) >= inicioMes)
        .reduce((s, c) => s + parseFloat(c.total || 0), 0);

    document.getElementById('fin_deuda_total').textContent = formatearMoneda(deudaTotal);
    document.getElementById('fin_deuda_vencida').textContent = formatearMoneda(deudaVencida);
    document.getElementById('fin_pagado_mes').textContent = formatearMoneda(pagadoMes);

    dash.renderTabla('tablaCXPFinanciero', [
        { key: 'numero_factura', label: 'Factura' },
        { key: 'proveedor_nombre', label: 'Proveedor' },
        { key: 'fecha_vencimiento', label: 'Vencimiento', tipo: 'fecha' },
        { key: 'total', label: 'Total', tipo: 'moneda' },
        { key: 'saldo_pendiente', label: 'Saldo', tipo: 'moneda' },
        { key: 'estado', label: 'Estado', tipo: 'badge',
          color: r => ({ pendiente:'orange', pagada:'green', vencida:'danger' })[r.estado] }
    ], data || []);
}

window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(seccion).classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    if (seccion === 'cxp') cargarCXP();
    if (seccion === 'costos') {
        document.getElementById('tablaCostos').innerHTML = 
            '<p style="color:var(--gray-700);padding:2rem;">Detalle de costos - Por implementar</p>';
    }
    if (seccion === 'utilidad') {
        document.getElementById('tablaUtilidad').innerHTML = 
            '<p style="color:var(--gray-700);padding:2rem;">Análisis de utilidad por OT - Por implementar</p>';
    }
}
window.mostrarModalCambiarPassword = mostrarModalCambiarPassword;
window.cerrarSesion = () => auth.logout();