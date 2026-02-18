// js/admin-taller-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { formatearMoneda } from './utils.js';

const dash = new DashboardBase(['superadmin','cliente_admin_taller']);

(async () => {
    if (!await dash.inicializar()) return;
    await cargarKPIs();
    await cargarOperaciones();
    await cargarRepuestosUsados();
    await cargarProductividad();
})();

async function cargarKPIs() {
    try {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0,0,0,0);

        const { data: ots } = await supabase
            .from('ordenes_trabajo')
            .select('*')
            .gte('created_at', inicioMes.toISOString());

        const totalOTs = ots?.length || 0;
        const ingresos = ots?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;
        
        const vehiculosUnicos = [...new Set(ots?.map(o => o.vehiculo_id))].length;

        // Calcular tiempo promedio (OTs completadas)
        const otsCompletadas = ots?.filter(o => o.fecha_finalizacion) || [];
        let tiempoPromedio = 0;
        if (otsCompletadas.length > 0) {
            const tiempos = otsCompletadas.map(o => {
                const inicio = new Date(o.fecha_ingreso);
                const fin = new Date(o.fecha_finalizacion);
                return (fin - inicio) / (1000 * 60 * 60); // horas
            });
            tiempoPromedio = tiempos.reduce((s, t) => s + t, 0) / tiempos.length;
        }

        document.getElementById('otsMes').textContent = totalOTs;
        document.getElementById('ingresosMes').textContent = formatearMoneda(ingresos);
        document.getElementById('repuestosUsados').textContent = '0'; // TODO: Implementar
        document.getElementById('horasHombre').textContent = '0'; // TODO: Implementar
        document.getElementById('vehiculosAtendidos').textContent = vehiculosUnicos;
        document.getElementById('tiempoPromedio').textContent = Math.round(tiempoPromedio) + 'h';

        // Gráfico estados
        const estados = {};
        ots?.forEach(o => {
            estados[o.estado] = (estados[o.estado] || 0) + 1;
        });

        const htmlEstados = Object.entries(estados).map(([estado, count]) => `
            <div style="display:flex;justify-content:space-between;padding:.75rem;border-bottom:1px solid var(--gray-200);">
                <span>${estado}</span>
                <strong>${count}</strong>
            </div>
        `).join('');

        document.getElementById('chartEstados').innerHTML = htmlEstados || '<p style="color:var(--gray-700);">Sin datos</p>';

        // Top servicios (placeholder)
        document.getElementById('topServicios').innerHTML = 
            '<p style="color:var(--gray-700);padding:1rem;">Top servicios - Por implementar</p>';

    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarOperaciones() {
    const { data } = await supabase
        .from('v_dashboard_operativo')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(30);

    dash.renderTabla('tablaOperaciones', [
        { key: 'fecha', label: 'Fecha',
          render: r => new Date(r.fecha).toLocaleDateString('es-CO') },
        { key: 'estado', label: 'Estado' },
        { key: 'cantidad', label: 'Cantidad' },
        { key: 'mecanicos', label: 'Mecánicos' },
        { key: 'marcas_distintas', label: 'Marcas' },
        { key: 'valor_total', label: 'Valor', tipo: 'moneda' }
    ], data || []);
}

async function cargarRepuestosUsados() {
    // TODO: Implementar desde cotizacion_repuestos
    document.getElementById('tablaRepuestosUsados').innerHTML = 
        '<p style="color:var(--gray-700);padding:2rem;">Análisis de repuestos usados - Por implementar</p>';
}

async function cargarProductividad() {
    const { data } = await supabase
        .from('ordenes_trabajo')
        .select('mecanico_asignado_id, total, estado, usuarios!mecanico_asignado_id(nombre)')
        .not('mecanico_asignado_id', 'is', null);

    // Agrupar por mecánico
    const porMecanico = {};
    (data || []).forEach(ot => {
        const id = ot.mecanico_asignado_id;
        if (!porMecanico[id]) {
            porMecanico[id] = {
                nombre: ot.usuarios?.nombre || 'Desconocido',
                total_ots: 0,
                completadas: 0,
                ingresos: 0
            };
        }
        porMecanico[id].total_ots++;
        if (ot.estado === 'completada') {
            porMecanico[id].completadas++;
            porMecanico[id].ingresos += parseFloat(ot.total || 0);
        }
    });

    const mecanicos = Object.values(porMecanico);

    dash.renderTabla('tablaMecanicos', [
        { key: 'nombre', label: 'Mecánico' },
        { key: 'total_ots', label: 'OTs Asignadas' },
        { key: 'completadas', label: 'Completadas' },
        { key: 'ingresos', label: 'Ingresos Generados', tipo: 'moneda' },
        { key: 'id', label: 'Promedio',
          render: r => r.completadas > 0 
            ? formatearMoneda(r.ingresos / r.completadas)
            : '$0' }
    ], mecanicos);
}

window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(seccion).classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    if (seccion === 'vehiculos') {
        cargarVehiculos();
    } else if (seccion === 'tiempos') {
        document.getElementById('tablaTiempos').innerHTML = 
            '<p style="color:var(--gray-700);padding:2rem;">Análisis de tiempos - Por implementar</p>';
    }
}

async function cargarVehiculos() {
    const { data } = await supabase
        .from('ordenes_trabajo')
        .select('vehiculo_id, vehiculos(placa, marca, linea)')
        .not('vehiculo_id', 'is', null);

    // Contar por vehículo
    const porVehiculo = {};
    (data || []).forEach(ot => {
        const id = ot.vehiculo_id;
        if (!porVehiculo[id]) {
            porVehiculo[id] = {
                placa: ot.vehiculos?.placa || 'N/A',
                marca: ot.vehiculos?.marca || '',
                linea: ot.vehiculos?.linea || '',
                visitas: 0
            };
        }
        porVehiculo[id].visitas++;
    });

    const vehiculos = Object.values(porVehiculo).sort((a,b) => b.visitas - a.visitas);

    dash.renderTabla('tablaVehiculos', [
        { key: 'placa', label: 'Placa' },
        { key: 'marca', label: 'Marca' },
        { key: 'linea', label: 'Línea' },
        { key: 'visitas', label: 'Visitas' }
    ], vehiculos);
}

window.cerrarSesion = () => auth.logout();