let otActualId = null;
let itemSeleccionadoId = null;

// 1. Cargar las tareas de la OT
async function cargarChecklist(otId) {
    otActualId = otId;
    const { data, error } = await supabaseClient
        .from('ot_checklist')
        .select('*')
        .eq('ot_id', otId)
        .order('orden', { ascending: true });

    if (error) return console.error(error);

    const contenedor = document.getElementById('listaTareas');
    contenedor.innerHTML = '';

    data.forEach(item => {
        const div = document.createElement('div');
        div.className = `tarea-card ${item.completado ? 'completada' : ''}`;
        div.innerHTML = `
            <div class="tarea-info">
                <strong>${item.descripcion}</strong>
                <span>Cantidad: ${item.cantidad_original}</span>
            </div>
            <div class="tarea-acciones">
                <input type="checkbox" ${item.completado ? 'checked' : ''} 
                       onchange="marcarTarea(${item.id}, this.checked)">
                <button class="btn-sm" onclick="abrirModalMod(${item.id}, '${item.descripcion}')">⚠️ Cambio</button>
            </div>
            ${item.requiere_modificacion ? '<p class="alerta">Pendiente de aprobación por Jefe</p>' : ''}
        `;
        contenedor.appendChild(div);
    });
}

// 2. Marcar tarea como completada
async function marcarTarea(itemId, estado) {
    const { error } = await supabaseClient
        .from('ot_checklist')
        .update({ 
            completado: estado,
            fecha_completado: estado ? new Date() : null 
        })
        .eq('id', itemId);

    if (error) alert("Error al actualizar tarea");
}

// 3. Enviar solicitud de modificación al Jefe de Taller
async function enviarSolicitudCambio() {
    const motivo = document.getElementById('motivoCambio').value;
    const cant = document.getElementById('nuevaCant').value;

    const { error } = await supabaseClient
        .from('ot_checklist')
        .update({
            requiere_modificacion: true,
            modificacion_descripcion: motivo,
            modificacion_cantidad: cant,
            modificacion_fecha_solicitud: new Date()
        })
        .eq('id', itemSeleccionadoId);

    if (!error) {
        alert("Solicitud enviada. El Jefe de Taller debe aprobarla.");
        cerrarModal();
        cargarChecklist(otActualId);
    }
}