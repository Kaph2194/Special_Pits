// js/estadisticas.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { formatearMoneda } from './utils.js';

const dash = new DashboardBase(['superadmin','cliente_gerencia','jefe_taller']);

(async () => {
    if (!await dash.inicializar()) return;
    await cargarEstadisticas();
})();

async function cargarEstadisticas() {
    // Obtener estadísticas generales
    const { data: stats } = await supabase
        .from('v_estadisticas_sistema')
        .select('*')
        .single();

    if (stats) {
        const kpisHTML = `
            <div class="metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem;">
                <div class="metric">
                    <div class="metric-value">${stats.total_clientes}</div>
                    <div class="metric-label">👥 Clientes Activos</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${stats.total_vehiculos}</div>
                    <div class="metric-label">🚗 Vehículos</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${stats.total_ots}</div>
                    <div class="metric-label">🔧 Total OTs</div>
                </div>
                <div class="metric success">
                    <div class="metric-value">${stats.ots_completadas}</div>
                    <div class="metric-label">✅ OTs Completadas</div>
                </div>
                <div class="metric warning">
                    <div class="metric-value">${stats.ots_en_proceso}</div>
                    <div class="metric-label">⏳ En Proceso</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${formatearMoneda(stats.total_facturado)}</div>
                    <div class="metric-label">💰 Total Facturado</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${formatearMoneda(stats.ticket_promedio_general)}</div>
                    <div class="metric-label">📊 Ticket Promedio</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${stats.cantidad_max_vehiculos}</div>
                    <div class="metric-label">🏆 Máx Vehículos/Cliente</div>
                    <small style="display:block;margin-top:.25rem;color:var(--gray-700);">${stats.cliente_mas_vehiculos}</small>
                </div>
            </div>
        `;

        document.getElementById('kpisGlobales').innerHTML = kpisHTML;
    }

    // Cargar productividad mensual
    const { data: productividad } = await supabase
        .from('v_productividad_general')
        .select('*')
        .order('mes', { ascending: false })
        .limit(12);

    if (productividad && productividad.length > 0) {
        dash.renderTabla('tablaProductividad', [
            { key: 'mes', label: 'Mes',
              render: r => new Date(r.mes).toLocaleDateString('es-CO', {year:'numeric',month:'long'}) },
            { key: 'total_ots', label: 'OTs' },
            { key: 'clientes_unicos', label: 'Clientes' },
            { key: 'vehiculos_atendidos', label: 'Vehículos' },
            { key: 'mecanicos_activos', label: 'Mecánicos' },
            { key: 'ots_por_mecanico', label: 'OTs/Mecánico' },
            { key: 'ingresos_totales', label: 'Ingresos', tipo: 'moneda' },
            { key: 'ticket_promedio', label: 'Ticket Prom.', tipo: 'moneda' }
        ], productividad);

        // Gráfico
        const labels = productividad.reverse().map(p => 
            new Date(p.mes).toLocaleDateString('es-CO', {month:'short', year:'2-digit'})
        );
        const data = productividad.map(p => p.total_ots);

        const ctx = document.getElementById('chartEvolucion').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'OTs por Mes',
                    data: data,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // Top clientes
    const { data: topClientes } = await supabase
        .from('v_resumen_clientes_completo')
        .select('razon_social, total_vehiculos, total_ots, total_gastado')
        .order('total_gastado', { ascending: false })
        .limit(10);

    if (topClientes && topClientes.length > 0) {
        const htmlTop = topClientes.map((c, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem;border-bottom:1px solid var(--gray-200);">
                <div style="display:flex;align-items:center;gap:.75rem;">
                    <div style="width:30px;height:30px;border-radius:50%;background:var(--primary);color:white;
                                display:flex;align-items:center;justify-content:center;font-weight:700;">
                        ${i + 1}
                    </div>
                    <div>
                        <strong>${c.razon_social}</strong><br>
                        <small style="color:var(--gray-700);">${c.total_vehiculos} vehículos | ${c.total_ots} OTs</small>
                    </div>
                </div>
                <strong style="color:var(--success);font-size:1.1rem;">
                    ${formatearMoneda(c.total_gastado)}
                </strong>
            </div>
        `).join('');

        document.getElementById('topClientes').innerHTML = htmlTop;
    }
}
