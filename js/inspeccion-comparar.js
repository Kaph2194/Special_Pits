// js/inspeccion-comparar.js
import { supabase } from './supabase-config.js';
import { mostrarNotificacion } from './utils.js';

let inspeccionIngreso = null;
let inspeccionEntrega = null;
let otId = null;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    otId = params.get('ot_id');
    
    if (otId) {
        cargarInspecciones();
    }
});

async function cargarInspecciones() {
    try {
        // Buscar inspecciones de esta OT
        const { data: inspecciones, error } = await supabase
            .from('v_inspecciones_completas')
            .select('*')
            .eq('ot_id', otId)
            .order('fecha_hora');
        
        if (error) throw error;
        
        inspeccionIngreso = inspecciones.find(i => i.tipo === 'ingreso');
        inspeccionEntrega = inspecciones.find(i => i.tipo === 'entrega');
        
        if (!inspeccionIngreso || !inspeccionEntrega) {
            mostrarNotificacion('⚠️ No hay inspecciones completas para comparar', 'warning');
            return;
        }
        
        // Cargar detalles
        await cargarDetallesYComparar();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error al cargar inspecciones', 'error');
    }
}

async function cargarDetallesYComparar() {
    // Cargar detalles de ingreso
    const { data: detallesIngreso } = await supabase
        .from('inspecciones_detalles')
        .select('*')
        .eq('inspeccion_id', inspeccionIngreso.id);
    
    // Cargar detalles de entrega
    const { data: detallesEntrega } = await supabase
        .from('inspecciones_detalles')
        .select('*')
        .eq('inspeccion_id', inspeccionEntrega.id);
    
    // Renderizar
    renderizarDatos(inspeccionIngreso, 'datosIngreso');
    renderizarDatos(inspeccionEntrega, 'datosEntrega');
    
    // Comparar y mostrar diferencias
    compararInspecciones(detallesIngreso, detallesEntrega);
    
    // Comparar fotos
    await compararFotos();
}

function renderizarDatos(insp, containerId) {
    document.getElementById(containerId).innerHTML = `
        <p><strong>Fecha:</strong> ${new Date(insp.fecha_hora).toLocaleString('es-CO')}</p>
        <p><strong>Kilometraje:</strong> ${insp.kilometraje?.toLocaleString()} km</p>
        <p><strong>Combustible:</strong> ${insp.nivel_combustible}</p>
        <p><strong>Inspector:</strong> ${insp.inspector_nombre}</p>
    `;
}

function compararInspecciones(ingreso, entrega) {
    const diferencias = [];
    
    // Crear mapa de elementos de ingreso
    const mapaIngreso = {};
    ingreso.forEach(item => {
        mapaIngreso[item.elemento] = item;
    });
    
    // Comparar con entrega
    entrega.forEach(itemEntrega => {
        const itemIngreso = mapaIngreso[itemEntrega.elemento];
        
        if (itemIngreso && itemIngreso.estado !== itemEntrega.estado) {
            let tipo = 'cambio';
            if (itemIngreso.estado === 'bueno' && itemEntrega.estado !== 'bueno') {
                tipo = 'deterioro';
            } else if (itemIngreso.estado !== 'bueno' && itemEntrega.estado === 'bueno') {
                tipo = 'mejora';
            }
            
            diferencias.push({
                elemento: itemEntrega.elemento,
                estadoIngreso: itemIngreso.estado,
                estadoEntrega: itemEntrega.estado,
                tipo: tipo
            });
        }
    });
    
    if (diferencias.length > 0) {
        document.getElementById('seccionDiferencias').style.display = 'block';
        document.getElementById('alertasDiferencias').innerHTML = `
            <div class="alert alert-warning">
                ⚠️ Se encontraron ${diferencias.length} diferencia(s) entre las inspecciones
            </div>
        `;
        
        const html = diferencias.map(dif => `
            <div class="diferencia-item ${dif.tipo}">
                <strong>${dif.elemento}</strong><br>
                Ingreso: <span class="badge badge-${dif.estadoIngreso === 'bueno' ? 'green' : dif.estadoIngreso === 'regular' ? 'orange' : 'danger'}">
                    ${dif.estadoIngreso}
                </span>
                →
                Entrega: <span class="badge badge-${dif.estadoEntrega === 'bueno' ? 'green' : dif.estadoEntrega === 'regular' ? 'orange' : 'danger'}">
                    ${dif.estadoEntrega}
                </span>
                ${dif.tipo === 'deterioro' ? '<br><strong style="color: var(--danger);">⚠️ Posible daño durante servicio</strong>' : ''}
            </div>
        `).join('');
        
        document.getElementById('listaDiferencias').innerHTML = html;
    } else {
        document.getElementById('alertasDiferencias').innerHTML = `
            <div class="alert alert-success">
                ✅ No se encontraron diferencias. El vehículo está en las mismas condiciones.
            </div>
        `;
    }
}

async function compararFotos() {
    // Cargar fotos de ambas inspecciones
    const { data: fotosIngreso } = await supabase
        .from('inspecciones_multimedia')
        .select('*')
        .eq('inspeccion_id', inspeccionIngreso.id)
        .eq('tipo', 'foto');
    
    const { data: fotosEntrega } = await supabase
        .from('inspecciones_multimedia')
        .select('*')
        .eq('inspeccion_id', inspeccionEntrega.id)
        .eq('tipo', 'foto');
    
    const angulos = ['frontal', 'trasero', 'lateral_izq', 'lateral_der'];
    let html = '';
    
    angulos.forEach(angulo => {
        const fotoIng = fotosIngreso?.find(f => f.angulo === angulo);
        const fotoEnt = fotosEntrega?.find(f => f.angulo === angulo);
        
        if (fotoIng || fotoEnt) {
            html += `
                <div>
                    <h3>${angulo.replace('_', ' ').toUpperCase()}</h3>
                    <div class="foto-comparacion">
                        <div>
                            <p style="text-align: center; margin-bottom: 0.5rem;"><strong>Ingreso</strong></p>
                            ${fotoIng ? `<img src="${fotoIng.url}" alt="${angulo} ingreso">` : '<p>Sin foto</p>'}
                        </div>
                        <div>
                            <p style="text-align: center; margin-bottom: 0.5rem;"><strong>Entrega</strong></p>
                            ${fotoEnt ? `<img src="${fotoEnt.url}" alt="${angulo} entrega">` : '<p>Sin foto</p>'}
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    document.getElementById('comparacionFotos').innerHTML = html;
}

window.aprobarEntrega = async function() {
    if (!confirm('¿Confirmar que el vehículo está en condiciones aceptables para la entrega?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('inspecciones_comparativas')
            .insert({
                vehiculo_id: inspeccionIngreso.vehiculo_id,
                ot_id: otId,
                inspeccion_ingreso_id: inspeccionIngreso.id,
                inspeccion_entrega_id: inspeccionEntrega.id,
                aprobado_por_cliente: true,
                fecha_aprobacion: new Date().toISOString()
            });
        
        if (error) throw error;
        
        mostrarNotificacion('✅ Entrega aprobada', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error al aprobar', 'error');
    }
}

window.rechazarEntrega = function() {
    const motivo = prompt('Motivo del rechazo:');
    if (!motivo) return;
    
    mostrarNotificacion('Entrega rechazada. Se notificará al taller.', 'warning');
}