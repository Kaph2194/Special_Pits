// js/gerencia-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { formatearMoneda, formatearFecha } from './utils.js';
import { mostrarModalCambiarPassword } from './cambiar-password.js';
import { notificacionesRealtime, NotificacionesRealtime } from './notifications-realtime.js';

const dash = new DashboardBase(['superadmin','cliente_gerencia']);

(async () => {
    if (!await dash.inicializar()) return;
    await cargarResumenEjecutivo();
})();

async function cargarResumenEjecutivo() {
    try {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0,0,0,0);

        const inicioMesAnterior = new Date(inicioMes);
        inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);

        // 1. DATOS MES ACTUAL
        const { data: otsActual } = await supabase
            .from('ordenes_trabajo')
            .select('total, cliente_id, mecanico_asignado_id, vehiculo_id')
            .in('estado', ['completada', 'facturada'])
            .gte('fecha_finalizacion', inicioMes.toISOString());

        const ventasActual = otsActual?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;
        const clientesActual = [...new Set(otsActual?.map(o => o.cliente_id))].length;

        // 2. DATOS MES ANTERIOR
        const { data: otsAnterior } = await supabase
            .from('ordenes_trabajo')
            .select('total')
            .in('estado', ['completada', 'facturada'])
            .gte('fecha_finalizacion', inicioMesAnterior.toISOString())
            .lt('fecha_finalizacion', inicioMes.toISOString());

        const ventasAnterior = otsAnterior?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;

        // 3. COSTOS Y UTILIDAD
        const costosEstimados = ventasActual * 0.4;
        const utilidad = ventasActual - costosEstimados;
        const margen = ventasActual > 0 ? (utilidad / ventasActual * 100) : 0;

        // 4. CRECIMIENTO
        const crecimiento = ventasAnterior > 0 
            ? ((ventasActual - ventasAnterior) / ventasAnterior * 100)
            : 0;

        // 5. PRODUCTIVIDAD
        const mecanicos = [...new Set(otsActual?.map(o => o.mecanico_asignado_id).filter(Boolean))].length;
        const productividad = mecanicos > 0 
            ? Math.round((otsActual?.length || 0) / mecanicos)
            : 0;

        // 6. CAPACIDAD UTILIZADA
            const capacidadUtilizada = otsActual?.length || 0;

        // ACTUALIZAR UI - RESUMEN EJECUTIVO
        document.getElementById('ventasMes').textContent = formatearMoneda(ventasActual);
        document.getElementById('utilidadMes').textContent = formatearMoneda(utilidad);
        document.getElementById('margenMes').textContent = margen.toFixed(1) + '%';
        document.getElementById('clientesMes').textContent = clientesActual;

        // KPIs
        document.getElementById('crecimiento').textContent = crecimiento.toFixed(1) + '%';
        document.getElementById('capacidad').textContent = capacidadUtilizada;
        document.getElementById('satisfaccion').textContent = 'N/A';
        document.getElementById('productividad').textContent = productividad;

        // Tendencias
        const elCrecimiento = document.getElementById('trendCrecimiento');
        elCrecimiento.textContent = `${crecimiento >= 0 ? '↗' : '↘'} ${Math.abs(crecimiento).toFixed(1)}% vs mes anterior`;
        elCrecimiento.className = `trend ${crecimiento >= 0 ? 'up' : 'down'}`;

        const elCapacidad = document.getElementById('trendCapacidad');
        elCapacidad.textContent = `${otsActual?.length || 0} órdenes de trabajo completadas`;

        const elProductividad = document.getElementById('trendProductividad');
        elProductividad.textContent = `${productividad} OTs/Mecánico/Mes`;

        // OBJETIVOS
        const objetivos = [
            { nombre: 'Ventas Mensuales', objetivo: 50000000, actual: ventasActual },
            { nombre: 'Margen de Utilidad', objetivo: 35, actual: margen },
            { nombre: 'Clientes Atendidos', objetivo: 50, actual: clientesActual },
        ];

        const htmlObjetivos = objetivos.map(obj => {
            const progreso = Math.min(100, (obj.actual / obj.objetivo * 100));
            const color = progreso >= 80 ? 'green' : progreso >= 50 ? 'orange' : 'danger';
            
            return `
                <div style="margin-bottom:1.5rem;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:.5rem;">
                        <strong>${obj.nombre}</strong>
                        <span style="color:var(--${color});">${progreso.toFixed(1)}%</span>
                    </div>
                    <div style="background:var(--gray-200);height:8px;border-radius:4px;overflow:hidden;">
                        <div style="background:var(--${color});height:100%;width:${progreso}%;transition:width .3s;"></div>
                    </div>
                    <small style="color:var(--gray-700);">
                        ${obj.nombre.includes('Ventas') || obj.nombre.includes('Margen') 
                            ? obj.nombre.includes('Ventas') 
                                ? formatearMoneda(obj.actual) + ' / ' + formatearMoneda(obj.objetivo)
                                : obj.actual.toFixed(1) + '% / ' + obj.objetivo + '%'
                            : Math.round(obj.actual) + ' / ' + obj.objetivo}
                    </small>
                </div>
            `;
        }).join('');

        document.getElementById('objetivos').innerHTML = htmlObjetivos;

        // Evolución mensual
        document.getElementById('chartEvolucion').innerHTML = 
            '<p style="color:var(--gray-700);text-align:center;padding:2rem;">Gráfico de evolución mensual - Implementar con Chart.js</p>';

    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarDatosCuentasPorPagar() {
    try {
        const { data: cxp } = await supabase
            .from('v_cuentas_por_pagar_completas')
            .select('*')
            .order('fecha_vencimiento');

        const totalPagar = (cxp || [])
            .filter(c => c.estado !== 'pagada')
            .reduce((s, c) => s + parseFloat(c.saldo_pendiente || 0), 0);

        const vencidas = (cxp || []).filter(c => c.estado === 'vencida').length;

        const { data: proveedores } = await supabase
            .from('v_resumen_proveedores')
            .select('*')
            .gt('deuda_pendiente', 0);

        document.getElementById('gerencia_total_pagar').textContent = formatearMoneda(totalPagar);
        document.getElementById('gerencia_vencidas').textContent = vencidas;
        document.getElementById('gerencia_proveedores').textContent = proveedores?.length || 0;
        document.getElementById('gerencia_promedio_dias').textContent = '30d';

        // Últimas CxP
        const ultimas = (cxp || []).slice(0, 5);
        const htmlCxp = ultimas.map(c => `
            <div style="display:flex;justify-content:space-between;padding:.75rem;
                        border-bottom:1px solid var(--gray-200);">
                <div>
                    <strong>${c.numero_factura}</strong><br>
                    <small style="color:var(--gray-700);">${c.proveedor_nombre}</small>
                </div>
                <div style="text-align:right;">
                    <strong>${formatearMoneda(c.saldo_pendiente)}</strong><br>
                    <small style="color:var(--gray-700);">${formatearFecha(c.fecha_vencimiento)}</small>
                </div>
            </div>
        `).join('') || '<p style="color:var(--gray-700);">Sin cuentas por pagar</p>';

        document.getElementById('gerencia_ultimas_cxp').innerHTML = htmlCxp;

        // Top proveedores
        const topProvs = (proveedores || [])
            .sort((a, b) => b.deuda_pendiente - a.deuda_pendiente)
            .slice(0, 5);

        const htmlProvs = topProvs.map(p => `
            <div style="display:flex;justify-content:space-between;padding:.75rem;
                        border-bottom:1px solid var(--gray-200);">
                <div>
                    <strong>${p.razon_social}</strong><br>
                    <small style="color:var(--gray-700);">${p.total_facturas} facturas</small>
                </div>
                <div style="text-align:right;font-weight:700;">
                    ${formatearMoneda(p.deuda_pendiente)}
                </div>
            </div>
        `).join('') || '<p style="color:var(--gray-700);">Sin proveedores</p>';

        document.getElementById('gerencia_top_proveedores').innerHTML = htmlProvs;

    } catch (error) {
        console.error('Error:', error);
    }
}

window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(seccion).classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    if (seccion === 'cuentas_pagar') {
        cargarDatosCuentasPorPagar();
    } else if (seccion === 'financiero') {
        cargarVistaFinanciera();
    } else if (seccion === 'operativo') {
        cargarVistaOperativa();
    } else if (seccion === 'clientes') {
        cargarVistaClientes();
    } else if (seccion === 'recursos') {
        cargarVistaRecursos();
    }
}

async function cargarVistaFinanciera() {
    const contenido = `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">💰 Ingresos Totales (12 meses)</div>
                <div class="kpi-value" id="fin_ingresos_ano">Cargando...</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">💹 Utilidad Acumulada</div>
                <div class="kpi-value" id="fin_utilidad_ano">Cargando...</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">📊 Margen Promedio</div>
                <div class="kpi-value" id="fin_margen_promedio">Cargando...</div>
            </div>
        </div>
        <div class="card">
            <h3>📈 Evolución Financiera</h3>
            <div id="tablaEvolucionFinanciera"></div>
        </div>
    `;
    
    document.getElementById('vistaFinanciera').innerHTML = contenido;

    // Cargar datos
    const { data } = await supabase
        .from('v_dashboard_financiero')
        .select('*')
        .order('mes', { ascending: false })
        .limit(12);

    const ingresosAno = data?.reduce((s, m) => s + parseFloat(m.ingresos_brutos || 0), 0) || 0;
    const utilidadAno = ingresosAno * 0.6; // 60% utilidad estimada
    const margenPromedio = 60;

    document.getElementById('fin_ingresos_ano').textContent = formatearMoneda(ingresosAno);
    document.getElementById('fin_utilidad_ano').textContent = formatearMoneda(utilidadAno);
    document.getElementById('fin_margen_promedio').textContent = margenPromedio + '%';

    dash.renderTabla('tablaEvolucionFinanciera', [
        { key: 'mes', label: 'Mes',
          render: r => new Date(r.mes).toLocaleDateString('es-CO', {year:'numeric',month:'long'}) },
        { key: 'ingresos_brutos', label: 'Ingresos', tipo: 'moneda' },
        { key: 'total_ots', label: 'OTs' },
        { key: 'ticket_promedio', label: 'Ticket Prom.', tipo: 'moneda' }
    ], data || []);
}

async function cargarVistaOperativa() {
    const contenido = `
        <div class="card">
            <h3>🔧 Indicadores Operativos</h3>
            <div id="tablaOperativa"></div>
        </div>
    `;
    
    document.getElementById('vistaOperativa').innerHTML = contenido;

    const { data } = await supabase
        .from('v_dashboard_operativo')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(30);

    dash.renderTabla('tablaOperativa', [
        { key: 'fecha', label: 'Fecha',
          render: r => formatearFecha(r.fecha) },
        { key: 'estado', label: 'Estado' },
        { key: 'cantidad', label: 'Cantidad' },
        { key: 'mecanicos', label: 'Mecánicos' },
        { key: 'valor_total', label: 'Valor', tipo: 'moneda' }
    ], data || []);
}

async function cargarVistaClientes() {
    const contenido = `
        <div class="card">
            <h3>👥 Análisis de Clientes</h3>
            <div id="tablaClientes"></div>
        </div>
    `;
    
    document.getElementById('vistaClientes').innerHTML = contenido;

    // Obtener clientes con su historial
    const { data } = await supabase
        .from('clientes')
        .select('*, ordenes_trabajo(id, total)')
        .eq('activo', true)
        .limit(50);

    const clientesConData = (data || []).map(c => ({
        ...c,
        total_ots: c.ordenes_trabajo?.length || 0,
        total_gastado: c.ordenes_trabajo?.reduce((s, ot) => s + parseFloat(ot.total || 0), 0) || 0
    })).sort((a, b) => b.total_gastado - a.total_gastado);

    dash.renderTabla('tablaClientes', [
        { key: 'razon_social', label: 'Cliente' },
        { key: 'nit', label: 'NIT' },
        { key: 'total_ots', label: 'OTs' },
        { key: 'total_gastado', label: 'Total Gastado', tipo: 'moneda' },
        { key: 'telefono', label: 'Teléfono' }
    ], clientesConData);
}

async function cargarVistaRecursos() {
    const contenido = `
        <div class="card">
            <h3>👷 Equipo de Trabajo</h3>
            <div id="tablaRecursos"></div>
        </div>
    `;
    
    document.getElementById('vistaRecursos').innerHTML = contenido;

    const { data } = await supabase
        .from('usuarios')
        .select('id, nombre, rol, telefono, email, activo, ordenes_trabajo(id, total)')
        .eq('activo', true)
        .in('rol', ['mecanico', 'jefe_taller', 'jefe_almacen', 'cajero']);

    const usuariosConData = (data || []).map(u => ({
        ...u,
        total_trabajos: u.ordenes_trabajo?.length || 0,
        ingresos_generados: u.ordenes_trabajo?.reduce((s, ot) => s + parseFloat(ot.total || 0), 0) || 0
    }));

    dash.renderTabla('tablaRecursos', [
        { key: 'nombre', label: 'Nombre' },
        { key: 'rol', label: 'Rol' },
        { key: 'total_trabajos', label: 'Trabajos' },
        { key: 'ingresos_generados', label: 'Ingresos Gen.', tipo: 'moneda' },
        { key: 'telefono', label: 'Teléfono' }
    ], usuariosConData);
}
window.mostrarModalCambiarPassword = mostrarModalCambiarPassword;
window.cerrarSesion = () => auth.logout();