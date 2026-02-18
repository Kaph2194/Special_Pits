// js/inspeccion-resumen.js
import { supabase } from './supabase-config.js';
import { formatearFechaHora, mostrarNotificacion } from './utils.js';

let inspeccionActual = null;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const inspeccionId = params.get('id');
    
    if (inspeccionId) {
        cargarInspeccion(inspeccionId);
    } else {
        mostrarNotificacion('❌ No se especificó una inspección', 'error');
    }
});

async function cargarInspeccion(id) {
    try {
        // Cargar inspección completa
        const { data: inspeccion, error } = await supabase
            .from('v_inspecciones_completas')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        inspeccionActual = inspeccion;
        
        // Cargar detalles
        const { data: detalles } = await supabase
            .from('inspecciones_detalles')
            .select('*')
            .eq('inspeccion_id', id)
            .order('categoria, orden');
        
        // Cargar multimedia
        const { data: multimedia } = await supabase
            .from('inspecciones_multimedia')
            .select('*')
            .eq('inspeccion_id', id)
            .order('orden');
        
        // Renderizar
        renderizarInformacionGeneral(inspeccion);
        renderizarInventario(inspeccion);
        renderizarMultimedia(multimedia);
        renderizarChecklist(detalles);
        renderizarFirmas(inspeccion);
        
    } catch (error) {
        console.error('Error cargando inspección:', error);
        mostrarNotificacion('Error al cargar inspección', 'error');
    }
}

function renderizarInformacionGeneral(insp) {
    document.getElementById('infoGeneral').innerHTML = `
        <div class="info-row">
            <span class="info-label">Tipo:</span>
            <span class="info-value">${insp.tipo === 'ingreso' ? '📥 Ingreso' : '📤 Entrega'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Fecha:</span>
            <span class="info-value">${formatearFechaHora(insp.fecha_hora)}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Inspector:</span>
            <span class="info-value">${insp.inspector_nombre || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Fotos:</span>
            <span class="info-value">${insp.total_fotos || 0}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Videos:</span>
            <span class="info-value">${insp.total_videos || 0}</span>
        </div>
    `;
    
    document.getElementById('infoVehiculo').innerHTML = `
        <div class="info-row">
            <span class="info-label">Placa:</span>
            <span class="info-value">${insp.placa || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Marca:</span>
            <span class="info-value">${insp.marca || ''} ${insp.linea || ''}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Modelo:</span>
            <span class="info-value">${insp.modelo || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Kilometraje:</span>
            <span class="info-value">${insp.kilometraje?.toLocaleString() || 'N/A'} km</span>
        </div>
        <div class="info-row">
            <span class="info-label">Combustible:</span>
            <span class="info-value">⛽ ${insp.nivel_combustible || 'N/A'}</span>
        </div>
    `;
    
    document.getElementById('infoConductor').innerHTML = `
        <div class="info-row">
            <span class="info-label">Nombre:</span>
            <span class="info-value">${insp.conductor_nombre || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Cédula:</span>
            <span class="info-value">${insp.conductor_cedula || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Teléfono:</span>
            <span class="info-value">${insp.conductor_telefono || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${insp.conductor_email || 'N/A'}</span>
        </div>
    `;
}

function renderizarInventario(insp) {
    const inventario = [
        { key: 'tiene_gato', label: '🔧 Gato' },
        { key: 'tiene_llanta_repuesto', label: '🛞 Llanta de Repuesto' },
        { key: 'tiene_herramientas', label: '🔨 Herramientas' },
        { key: 'tiene_triangulos', label: '⚠️ Triángulos' },
        { key: 'tiene_botiquin', label: '🩹 Botiquín' },
        { key: 'tiene_extintor', label: '🧯 Extintor' },
        { key: 'tiene_documentos', label: '📄 Documentos' },
        { key: 'tiene_radio', label: '📻 Radio' },
        { key: 'tiene_antena', label: '📡 Antena' },
        { key: 'tiene_tapetes', label: '🧽 Tapetes' },
        { key: 'tiene_emblemas', label: '✨ Emblemas' }
    ];
    
    let html = '';
    inventario.forEach(item => {
        const tiene = insp[item.key];
        html += `
            <div class="inventory-item" style="background: ${tiene ? '#d1fae5' : '#fee2e2'};">
                <input type="checkbox" ${tiene ? 'checked' : ''} disabled>
                <label>${item.label}</label>
            </div>
        `;
    });
    
    if (insp.inventario_otros) {
        html += `
            <div class="inventory-item" style="grid-column: 1/-1; background: #dbeafe;">
                <strong>Otros:</strong> ${insp.inventario_otros}
            </div>
        `;
    }
    
    document.getElementById('inventarioResumen').innerHTML = html;
}

function renderizarMultimedia(multimedia) {
    if (!multimedia || multimedia.length === 0) {
        document.getElementById('galeriaFotos').innerHTML = '<p style="color: var(--gray-700);">No hay fotos disponibles</p>';
        return;
    }
    
    const fotos = multimedia.filter(m => m.tipo === 'foto');
    const videos = multimedia.filter(m => m.tipo === 'video');
    
    // Renderizar fotos
    if (fotos.length > 0) {
        document.getElementById('galeriaFotos').innerHTML = fotos.map(foto => `
            <img src="${foto.url}" alt="${foto.angulo}" onclick="abrirLightbox('${foto.url}')">
        `).join('');
    }
    
    // Renderizar videos
    if (videos.length > 0) {
        document.getElementById('seccionVideos').style.display = 'block';
        document.getElementById('listaVideos').innerHTML = videos.map(video => `
            <video controls style="max-width: 100%; margin-bottom: 1rem;">
                <source src="${video.url}" type="video/webm">
                Tu navegador no soporta el elemento de video.
            </video>
        `).join('');
    }
}

function renderizarChecklist(detalles) {
    if (!detalles || detalles.length === 0) {
        document.getElementById('checklistResumen').innerHTML = '<p style="color: var(--gray-700);">No hay checklist disponible</p>';
        return;
    }
    
    const html = detalles.map(detalle => `
        <div class="checklist-item-resumen ${detalle.estado}">
            <div>
                <strong>${detalle.elemento}</strong>
                ${detalle.observaciones ? `<br><small style="color: var(--gray-700);">${detalle.observaciones}</small>` : ''}
            </div>
            <span class="badge badge-${detalle.estado === 'bueno' ? 'green' : detalle.estado === 'regular' ? 'orange' : 'danger'}">
                ${detalle.estado === 'bueno' ? '✓ Bueno' : detalle.estado === 'regular' ? '~ Regular' : '✗ Malo'}
            </span>
        </div>
    `).join('');
    
    document.getElementById('checklistResumen').innerHTML = html;
}

function renderizarFirmas(insp) {
    if (insp.firma_conductor) {
        document.getElementById('firmaConductorImg').innerHTML = `
            <img src="${insp.firma_conductor}" alt="Firma Conductor">
            <p style="margin-top: 0.5rem; text-align: center; color: var(--gray-700);">
                ${insp.conductor_nombre}
            </p>
        `;
    }
    
    if (insp.firma_inspector) {
        document.getElementById('firmaInspectorImg').innerHTML = `
            <img src="${insp.firma_inspector}" alt="Firma Inspector">
            <p style="margin-top: 0.5rem; text-align: center; color: var(--gray-700);">
                ${insp.inspector_nombre || 'Inspector'}
            </p>
        `;
    }
}

window.abrirLightbox = function(url) {
    document.getElementById('lightboxImg').src = url;
    document.getElementById('lightbox').classList.add('active');
}

window.cerrarLightbox = function() {
    document.getElementById('lightbox').classList.remove('active');
}

window.imprimirInspeccion = function() {
    window.print();
}

window.descargarPDF = function() {
    mostrarNotificacion('ℹ️ Generación de PDF - Por implementar', 'info');
}