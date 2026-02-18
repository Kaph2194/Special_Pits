// js/historial-vehiculo.js
import { supabase } from './supabase-config.js';
import { formatearFechaHora, formatearMoneda } from './utils.js';

let vehiculoId = null;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    vehiculoId = params.get('vehiculo_id');
    
    if (vehiculoId) {
        cargarHistorial();
    }
});

async function cargarHistorial() {
    try {
        // Cargar vehículo
        const { data: vehiculo } = await supabase
            .from('vehiculos')
            .select('*, clientes(*)')
            .eq('id', vehiculoId)
            .single();
        
        // Cargar historial
        const { data: historial } = await supabase
            .from('v_historial_vehiculo_completo')
            .select('*')
            .eq('vehiculo_id', vehiculoId)
            .order('fecha_evento', { ascending: false });
        
        // Cargar estadísticas
        const stats = await cargarEstadisticas();
        
        renderizarInfoVehiculo(vehiculo);
        renderizarEstadisticas(stats);
        renderizarTimeline(historial);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderizarInfoVehiculo(vehiculo) {
    document.getElementById('infoVehiculo').innerHTML = `
        <h2>🚗 ${vehiculo.placa}</h2>
        <p><strong>Marca/Línea:</strong> ${vehiculo.marca} ${vehiculo.linea}</p>
        <p><strong>Modelo:</strong> ${vehiculo.modelo}</p>
        <p><strong>Propietario:</strong> ${vehiculo.clientes?.razon_social}</p>
        <p><strong>Kilometraje actual:</strong> ${vehiculo.kilometraje?.toLocaleString()} km</p>
    `;
}

async function cargarEstadisticas() {
    const { data: cotizaciones } = await supabase
        .from('cotizaciones')
        .select('*')
        .eq('vehiculo_id', vehiculoId);
    
    const { data: inspecciones } = await supabase
        .from('inspecciones')
        .select('*')
        .eq('vehiculo_id', vehiculoId);
    
    const { data: ots } = await supabase
        .from('ordenes_trabajo')
        .select('*')
        .eq('vehiculo_id', vehiculoId);
    
    const totalGastado = cotizaciones
        ?.filter(c => c.estado === 'aprobada')
        .reduce((sum, c) => sum + parseFloat(c.total || 0), 0) || 0;
    
    return {
        totalCotizaciones: cotizaciones?.length || 0,
        totalInspecciones: inspecciones?.length || 0,
        totalOTs: ots?.length || 0,
        totalGastado: totalGastado
    };
}

function renderizarEstadisticas(stats) {
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.totalCotizaciones}</div>
            <div class="stat-label">Cotizaciones</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.totalInspecciones}</div>
            <div class="stat-label">Inspecciones</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.totalOTs}</div>
            <div class="stat-label">Órdenes de Trabajo</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatearMoneda(stats.totalGastado)}</div>
            <div class="stat-label">Total Invertido</div>
        </div>
    `;
}

function renderizarTimeline(historial) {
    if (!historial || historial.length === 0) {
        document.getElementById('timeline').innerHTML = '<p>No hay historial disponible</p>';
        return;
    }
    
    const html = historial.map(evento => `
        <div class="timeline-item">
            <div class="timeline-icon ${evento.tipo_evento}">
                ${getIconoTipo(evento.tipo_evento)}
            </div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <div>
                        <div class="timeline-title">${evento.titulo}</div>
                        <div class="timeline-date">${formatearFechaHora(evento.fecha_evento)}</div>
                    </div>
                    <span class="badge badge-${getBadgeColor(evento.tipo_evento)}">
                        ${evento.tipo_evento}
                    </span>
                </div>
                <p style="color: var(--gray-700);">${evento.descripcion || ''}</p>
                ${evento.usuario_nombre ? `<small style="color: var(--gray-700);">Por: ${evento.usuario_nombre}</small>` : ''}
            </div>
        </div>
    `).join('');
    
    document.getElementById('timeline').innerHTML = html;
}

function getIconoTipo(tipo) {
    const iconos = {
        'cotizacion': '💰',
        'inspeccion': '📸',
        'ot': '🔧',
        'factura': '📄',
        'servicio': '⚙️'
    };
    return iconos[tipo] || '📋';
}

function getBadgeColor(tipo) {
    const colores = {
        'cotizacion': 'blue',
        'inspeccion': 'orange',
        'ot': 'green',
        'factura': 'blue',
        'servicio': 'green'
    };
    return colores[tipo] || 'blue';
}