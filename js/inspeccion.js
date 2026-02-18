// js/inspeccion.js
import { supabase } from './supabase-config.js';
import { mostrarNotificacion, formatearFechaHora } from './utils.js';

// ============================================
// VARIABLES GLOBALES
// ============================================
let pasoActual = 1;
let vehiculoActual = null;
let cotizacionId = null;
let otId = null;
let nivelCombustible = null;
let fotosCapturadas = {};
let videosCapturados = [];
let checklistData = {};
let anguloActual = null;
let streamActivo = null;

// Canvas para firmas
let canvasConductor = null;
let canvasInspector = null;
let ctxConductor = null;
let ctxInspector = null;
let dibujandoConductor = false;
let dibujandoInspector = false;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando módulo de inspección...');
    
    // Obtener parámetros de URL
    const params = new URLSearchParams(window.location.search);
    cotizacionId = params.get('cotizacion_id');
    otId = params.get('ot_id');
    
    inicializarFechaActual();
    cargarPlantillaChecklist();
    inicializarFirmas();
    
    if (cotizacionId || otId) {
        cargarDatosRelacionados();
    }
});

// ============================================
// INICIALIZAR FECHA ACTUAL
// ============================================
function inicializarFechaActual() {
    const ahora = new Date();
    const fechaLocal = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    document.getElementById('fechaInspeccion').value = fechaLocal;
}

// ============================================
// CARGAR DATOS RELACIONADOS
// ============================================
async function cargarDatosRelacionados() {
    try {
        if (cotizacionId) {
            const { data, error } = await supabase
                .from('v_cotizaciones_completas')
                .select('*')
                .eq('id', cotizacionId)
                .single();
            
            if (error) throw error;
            
            if (data) {
                document.getElementById('placaVehiculo').value = data.vehiculo_placa || '';
                document.getElementById('conductorNombre').value = data.cliente_nombre || '';
                mostrarNotificacion(`ℹ️ Datos cargados de cotización ${data.folio}`, 'info');
            }
        }
        
        if (otId) {
            const { data, error } = await supabase
                .from('v_ordenes_trabajo_completas')
                .select('*')
                .eq('id', otId)
                .single();
            
            if (error) throw error;
            
            if (data) {
                document.getElementById('placaVehiculo').value = data.vehiculo_placa || '';
                document.getElementById('kilometraje').value = data.kilometraje_ingreso || '';
                mostrarNotificacion(`ℹ️ Datos cargados de OT ${data.numero_ot}`, 'info');
            }
        }
    } catch (error) {
        console.error('Error cargando datos relacionados:', error);
    }
}

// ============================================
// SELECCIONAR NIVEL DE COMBUSTIBLE
// ============================================
window.seleccionarCombustible = function(nivel) {
    document.querySelectorAll('.fuel-option').forEach(el => {
        el.classList.remove('active');
    });
    event.target.closest('.fuel-option').classList.add('active');
    nivelCombustible = nivel;
}

// ============================================
// NAVEGACIÓN DE PASOS
// ============================================
window.siguientePaso = function() {
    // Validar paso actual antes de continuar
    if (!validarPasoActual()) {
        return;
    }
    
    if (pasoActual < 5) {
        pasoActual++;
        actualizarVistaPasos();
    }
}

window.anteriorPaso = function() {
    if (pasoActual > 1) {
        pasoActual--;
        actualizarVistaPasos();
    }
}

function actualizarVistaPasos() {
    // Actualizar wizard steps
    document.querySelectorAll('.wizard-step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNum === pasoActual) {
            step.classList.add('active');
        } else if (stepNum < pasoActual) {
            step.classList.add('completed');
        }
    });
    
    // Actualizar contenido
    document.querySelectorAll('.step-content').forEach((content, index) => {
        const stepNum = index + 1;
        content.classList.remove('active');
        
        if (stepNum === pasoActual) {
            content.classList.add('active');
        }
    });
    
    // Scroll al tope
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validarPasoActual() {
    switch(pasoActual) {
        case 1:
            if (!document.getElementById('placaVehiculo').value.trim()) {
                mostrarNotificacion('⚠️ Debes ingresar la placa del vehículo', 'warning');
                return false;
            }
            if (!document.getElementById('kilometraje').value) {
                mostrarNotificacion('⚠️ Debes ingresar el kilometraje', 'warning');
                return false;
            }
            if (!nivelCombustible) {
                mostrarNotificacion('⚠️ Debes seleccionar el nivel de combustible', 'warning');
                return false;
            }
            if (!document.getElementById('conductorNombre').value.trim()) {
                mostrarNotificacion('⚠️ Debes ingresar el nombre del conductor', 'warning');
                return false;
            }
            if (!document.getElementById('conductorCedula').value.trim()) {
                mostrarNotificacion('⚠️ Debes ingresar la cédula del conductor', 'warning');
                return false;
            }
            if (!document.getElementById('conductorTelefono').value.trim()) {
                mostrarNotificacion('⚠️ Debes ingresar el teléfono del conductor', 'warning');
                return false;
            }
            break;
            
        case 2:
            const fotosObligatorias = ['frontal', 'trasero', 'lateral_izq', 'lateral_der', 'tablero'];
            const faltantes = fotosObligatorias.filter(angulo => !fotosCapturadas[angulo]);
            
            if (faltantes.length > 0) {
                mostrarNotificacion(`⚠️ Faltan fotos obligatorias: ${faltantes.join(', ')}`, 'warning');
                return false;
            }
            break;
            
        case 3:
            // Verificar que al menos se haya marcado algún elemento
            const elementosMarcados = Object.keys(checklistData).length;
            if (elementosMarcados === 0) {
                mostrarNotificacion('⚠️ Debes revisar al menos algunos elementos del checklist', 'warning');
                return false;
            }
            break;
    }
    
    return true;
}

// ============================================
// CARGAR PLANTILLA DE CHECKLIST
// ============================================
async function cargarPlantillaChecklist() {
    try {
        const { data, error } = await supabase
            .from('plantillas_inspeccion')
            .select('*')
            .eq('activo', true)
            .order('categoria, orden');
        
        if (error) throw error;
        
        const container = document.getElementById('checklistContainer');
        let categoriaActual = null;
        let html = '';
        
        data.forEach((item, index) => {
            if (item.categoria !== categoriaActual) {
                categoriaActual = item.categoria;
                html += `
                    <div class="checklist-category">
                        ${getCategoriaIcon(item.categoria)} ${item.categoria.toUpperCase()}
                    </div>
                `;
            }
            
            html += `
                <div class="checklist-item">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong>${item.elemento}</strong>
                        <small style="color: var(--gray-700);">${item.categoria}</small>
                    </div>
                    <div class="estado-buttons">
                        <button class="estado-btn bueno" onclick="marcarEstado(${index}, '${item.elemento}', '${item.categoria}', 'bueno')">
                            ✓ Bueno
                        </button>
                        <button class="estado-btn regular" onclick="marcarEstado(${index}, '${item.elemento}', '${item.categoria}', 'regular')">
                            ~ Regular
                        </button>
                        <button class="estado-btn malo" onclick="marcarEstado(${index}, '${item.elemento}', '${item.categoria}', 'malo')">
                            ✗ Malo
                        </button>
                    </div>
                    <div style="margin-top: 0.5rem;">
                        <input type="text" class="form-control" placeholder="Observaciones (opcional)"
                               id="obs_${index}" style="font-size: 0.875rem;">
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando checklist:', error);
        mostrarNotificacion('Error al cargar checklist', 'error');
    }
}

function getCategoriaIcon(categoria) {
    const iconos = {
        'exterior': '🚗',
        'interior': '🪑',
        'mecanico': '⚙️',
        'electrico': '💡',
        'neumaticos': '🛞'
    };
    return iconos[categoria.toLowerCase()] || '📋';
}

window.marcarEstado = function(index, elemento, categoria, estado) {
    // Actualizar UI
    const buttons = document.querySelectorAll(`#checklistContainer .checklist-item:nth-child(${index + 2}) .estado-btn`);
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Guardar en datos
    const observaciones = document.getElementById(`obs_${index}`)?.value || '';
    checklistData[elemento] = {
        categoria,
        estado,
        observaciones,
        requiere_atencion: estado === 'malo'
    };
}

// ============================================
// CAPTURA DE FOTOS
// ============================================
// REEMPLAZAR TODA LA SECCIÓN DE CAPTURA DE FOTOS EN js/inspeccion.js


// Detectar si es móvil
function esDispositivoMovil() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

window.tomarFoto = async function(angulo) {
    anguloActual = angulo;
    
    if (esDispositivoMovil()) {
        // En móvil: usar input file con capture
        usarInputFileMovil(angulo);
    } else {
        // En desktop: intentar getUserMedia
        try {
            const preview = document.getElementById('cameraPreview');
            const video = document.getElementById('cameraVideo');
            const canvas = document.getElementById('cameraCanvas');
            
            // Verificar si getUserMedia está disponible
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia no disponible');
            }
            
            streamActivo = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                } 
            });
            
            video.srcObject = streamActivo;
            await video.play();
            
            preview.classList.add('active');
            
        } catch (error) {
            console.error('Error accediendo a la cámara:', error);
            mostrarNotificacion('⚠️ No se pudo acceder a la cámara. Usando selector de archivos.', 'warning');
            usarInputFile(angulo);
        }
    }
}

window.capturarFoto = async function() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const preview = document.getElementById('cameraPreview');
    
    // Ajustar canvas al tamaño del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Capturar frame actual
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convertir a blob
    canvas.toBlob(async (blob) => {
        if (blob) {
            // Redimensionar si es muy grande
            const imagenRedimensionada = await redimensionarImagen(blob, 1920, 1080);
            
            fotosCapturadas[anguloActual] = {
                blob: imagenRedimensionada,
                angulo: anguloActual,
                timestamp: new Date().toISOString()
            };
            
            actualizarVistaFoto(anguloActual, URL.createObjectURL(imagenRedimensionada));
            mostrarNotificacion(`✅ Foto ${anguloActual} capturada`, 'success');
        }
        
        // Cerrar cámara
        cerrarCamara();
    }, 'image/jpeg', 0.9);
}

window.cerrarCamara = function() {
    if (streamActivo) {
        streamActivo.getTracks().forEach(track => track.stop());
        streamActivo = null;
    }
    
    const preview = document.getElementById('cameraPreview');
    const video = document.getElementById('cameraVideo');
    
    if (preview) preview.classList.remove('active');
    if (video) video.srcObject = null;
}

// Para desktop cuando no hay cámara
function usarInputFile(angulo) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const imagenRedimensionada = await redimensionarImagen(file, 1920, 1080);
            
            fotosCapturadas[angulo] = {
                blob: imagenRedimensionada,
                angulo: angulo,
                timestamp: new Date().toISOString()
            };
            
            actualizarVistaFoto(angulo, URL.createObjectURL(imagenRedimensionada));
            mostrarNotificacion(`✅ Foto ${angulo} capturada`, 'success');
        }
    };
    
    input.click();
}

// Para móviles
function usarInputFileMovil(angulo) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Activar cámara trasera
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const imagenRedimensionada = await redimensionarImagen(file, 1920, 1080);
            
            fotosCapturadas[angulo] = {
                blob: imagenRedimensionada,
                angulo: angulo,
                timestamp: new Date().toISOString()
            };
            
            actualizarVistaFoto(angulo, URL.createObjectURL(imagenRedimensionada));
            mostrarNotificacion(`✅ Foto ${angulo} capturada`, 'success');
        }
    };
    
    input.click();
}

// Redimensionar imagen (optimización)
async function redimensionarImagen(file, maxWidth, maxHeight) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                // Calcular nuevo tamaño manteniendo proporción
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.9);
            };
            img.src = e.target.result;
        };
        
        // Si es un File, leer como DataURL
        if (file instanceof File) {
            reader.readAsDataURL(file);
        } else {
            // Si ya es un Blob, convertir
            reader.readAsDataURL(file);
        }
    });
}

function actualizarVistaFoto(angulo, url) {
    const container = document.querySelector(`[data-angulo="${angulo}"]`);
    if (!container) return;
    
    const existingImg = container.querySelector('img');
    if (existingImg) {
        existingImg.src = url;
    } else {
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:.5rem;';
        container.innerHTML = '';
        container.appendChild(img);
    }
    
    // Cambiar texto del botón
    const btn = container.parentElement?.querySelector('button');
    if (btn) {
        btn.textContent = '📸 Retomar Foto';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-warning');
    }
}

// ============================================
// CAPTURA DE VIDEO
// ============================================
// REEMPLAZAR LA FUNCIÓN tomarVideo EN js/inspeccion.js
window.tomarVideo = async function() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        });
        
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8,opus',
            videoBitsPerSecond: 2500000 // 2.5 Mbps
        });
        
        const chunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            
            // Limitar tamaño de video (máx 50MB)
            if (blob.size > 50 * 1024 * 1024) {
                mostrarNotificacion('⚠️ Video demasiado grande (máx 50MB)', 'warning');
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            
            videosCapturados.push({
                blob: blob,
                timestamp: new Date().toISOString(),
                duracion: Date.now() - tiempoInicio
            });
            
            stream.getTracks().forEach(track => track.stop());
            
            const duracionSeg = Math.round((Date.now() - tiempoInicio) / 1000);
            mostrarNotificacion(`✅ Video grabado (${duracionSeg}s, ${(blob.size / 1024 / 1024).toFixed(1)}MB)`, 'success');
            
            // Limpiar interfaz
            const btnDetener = document.getElementById('btnDetenerVideo');
            if (btnDetener) btnDetener.remove();
        };
        
        // Botón para detener grabación
        const btnDetener = document.createElement('button');
        btnDetener.id = 'btnDetenerVideo';
        btnDetener.className = 'btn btn-danger';
        btnDetener.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10001;';
        btnDetener.innerHTML = '⏹️ Detener Grabación';
        btnDetener.onclick = () => mediaRecorder.stop();
        document.body.appendChild(btnDetener);
        
        // Iniciar grabación
        const tiempoInicio = Date.now();
        mediaRecorder.start();
        mostrarNotificacion('🎥 Grabando video... Click en "Detener" cuando termines', 'info');
        
        // Detener automáticamente después de 2 minutos
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                mostrarNotificacion('⏱️ Video detenido automáticamente (máx 2min)', 'warning');
            }
        }, 120000);
        
    } catch (error) {
        console.error('Error grabando video:', error);
        mostrarNotificacion('❌ Error al grabar video: ' + error.message, 'error');
    }
}

// ============================================
// FIRMAS DIGITALES
// ============================================
// REEMPLAZAR LA FUNCIÓN inicializarFirmas EN js/inspeccion.js
function inicializarFirmas() {
    canvasConductor = document.getElementById('firmaConductor');
    canvasInspector = document.getElementById('firmaInspector');
    
    if (!canvasConductor || !canvasInspector) {
        console.warn('Canvas de firmas no encontrados');
        return;
    }
    
    // Establecer tamaño del canvas
    canvasConductor.width = 400;
    canvasConductor.height = 200;
    canvasInspector.width = 400;
    canvasInspector.height = 200;
    
    ctxConductor = canvasConductor.getContext('2d');
    ctxInspector = canvasInspector.getContext('2d');
    
    configurarCanvas(canvasConductor, ctxConductor);
    configurarCanvas(canvasInspector, ctxInspector);
    
    // Mouse events - Conductor
    canvasConductor.addEventListener('mousedown', (e) => iniciarDibujo(e, 'conductor'));
    canvasConductor.addEventListener('mousemove', (e) => dibujar(e, 'conductor'));
    canvasConductor.addEventListener('mouseup', () => detenerDibujo('conductor'));
    canvasConductor.addEventListener('mouseleave', () => detenerDibujo('conductor'));
    
    // Touch events - Conductor
    canvasConductor.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvasConductor.dispatchEvent(mouseEvent);
    });
    
    canvasConductor.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvasConductor.dispatchEvent(mouseEvent);
    });
    
    canvasConductor.addEventListener('touchend', (e) => {
        e.preventDefault();
        detenerDibujo('conductor');
    });
    
    // Mouse events - Inspector
    canvasInspector.addEventListener('mousedown', (e) => iniciarDibujo(e, 'inspector'));
    canvasInspector.addEventListener('mousemove', (e) => dibujar(e, 'inspector'));
    canvasInspector.addEventListener('mouseup', () => detenerDibujo('inspector'));
    canvasInspector.addEventListener('mouseleave', () => detenerDibujo('inspector'));
    
    // Touch events - Inspector
    canvasInspector.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvasInspector.dispatchEvent(mouseEvent);
    });
    
    canvasInspector.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvasInspector.dispatchEvent(mouseEvent);
    });
    
    canvasInspector.addEventListener('touchend', (e) => {
        e.preventDefault();
        detenerDibujo('inspector');
    });
    
    console.log('✅ Firmas digitales inicializadas');
}

function configurarCanvas(canvas, ctx) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
// ============================================
// GUARDAR INSPECCIÓN COMPLETA
// ============================================
window.guardarInspeccion = async function() {
    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="loading"></span> Guardando...';
    
    try {
        // Validar firmas
        if (!validarFirma(canvasConductor)) {
            mostrarNotificacion('⚠️ Se requiere la firma del conductor', 'warning');
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '💾 Guardar Inspección Completa';
            return;
        }
        
        if (!validarFirma(canvasInspector)) {
            mostrarNotificacion('⚠️ Se requiere la firma del inspector', 'warning');
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '💾 Guardar Inspección Completa';
            return;
        }
        
        // 1. Buscar o crear vehículo
        const placa = document.getElementById('placaVehiculo').value.trim().toUpperCase();
        let vehiculo = await buscarVehiculo(placa);
        
        if (!vehiculo) {
            vehiculo = await crearVehiculoBasico(placa);
        }
        
        // 2. Crear registro de inspección
        const inspeccionData = {
            vehiculo_id: vehiculo.id,
            cotizacion_id: cotizacionId,
            ot_id: otId,
            tipo: document.getElementById('tipoInspeccion').value,
            fecha_hora: document.getElementById('fechaInspeccion').value,
            kilometraje: parseInt(document.getElementById('kilometraje').value),
            nivel_combustible: nivelCombustible,
            
            conductor_nombre: document.getElementById('conductorNombre').value.trim(),
            conductor_cedula: document.getElementById('conductorCedula').value.trim(),
            conductor_telefono: document.getElementById('conductorTelefono').value.trim(),
            conductor_email: document.getElementById('conductorEmail').value.trim() || null,
            
            inspector_id: 1, // TODO: Obtener del usuario logueado
            inspector_nombre: 'Inspector Actual', // TODO: Obtener del usuario logueado
            
            firma_conductor: canvasConductor.toDataURL(),
            firma_inspector: canvasInspector.toDataURL(),
            
            observaciones_generales: document.getElementById('observacionesGenerales').value.trim(),
            
            // Inventario
            tiene_gato: document.getElementById('inv_gato').checked,
            tiene_llanta_repuesto: document.getElementById('inv_llanta').checked,
            tiene_herramientas: document.getElementById('inv_herramientas').checked,
            tiene_triangulos: document.getElementById('inv_triangulos').checked,
            tiene_botiquin: document.getElementById('inv_botiquin').checked,
            tiene_extintor: document.getElementById('inv_extintor').checked,
            tiene_documentos: document.getElementById('inv_documentos').checked,
            tiene_radio: document.getElementById('inv_radio').checked,
            tiene_antena: document.getElementById('inv_antena').checked,
            tiene_tapetes: document.getElementById('inv_tapetes').checked,
            tiene_emblemas: document.getElementById('inv_emblemas').checked,
            inventario_otros: document.getElementById('inventarioOtros').value.trim() || null
        };
        
        const { data: inspeccion, error: errorInsp } = await supabase
            .from('inspecciones')
            .insert(inspeccionData)
            .select()
            .single();
        
        if (errorInsp) throw errorInsp;
        
        console.log('✅ Inspección creada:', inspeccion);
        
        // 3. Guardar detalles del checklist
        const detalles = Object.keys(checklistData).map((elemento, index) => ({
            inspeccion_id: inspeccion.id,
            categoria: checklistData[elemento].categoria,
            elemento: elemento,
            estado: checklistData[elemento].estado,
            observaciones: checklistData[elemento].observaciones,
            requiere_atencion: checklistData[elemento].requiere_atencion,
            orden: index
        }));
        
        if (detalles.length > 0) {
            const { error: errorDet } = await supabase
                .from('inspecciones_detalles')
                .insert(detalles);
            
            if (errorDet) throw errorDet;
        }
        
        // 4. Subir fotos a Supabase Storage
        await subirFotos(inspeccion.id);
        
        // 5. Subir videos
        await subirVideos(inspeccion.id);
        
        mostrarNotificacion('✅ Inspección guardada exitosamente', 'success');
        
        setTimeout(() => {
            window.location.href = `inspeccion-resumen.html?id=${inspeccion.id}`;
        }, 2000);
        
    } catch (error) {
        console.error('Error guardando inspección:', error);
        mostrarNotificacion('❌ Error al guardar: ' + error.message, 'error');
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '💾 Guardar Inspección Completa';
    }
}

function validarFirma(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Verificar si hay píxeles que no sean blancos
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 255 || data[i+1] !== 255 || data[i+2] !== 255) {
            return true; // Hay firma
        }
    }
    
    return false; // Canvas vacío
}

async function buscarVehiculo(placa) {
    const { data, error } = await supabase
        .from('vehiculos')
        .select('*')
        .eq('placa', placa)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        throw error;
    }
    
    return data;
}

async function crearVehiculoBasico(placa) {
    const { data, error } = await supabase
        .from('vehiculos')
        .insert({
            placa: placa,
            cliente_id: 1, // TODO: Asociar con cliente real
            activo: true
        })
        .select()
        .single();
    
    if (error) throw error;
    
    return data;
}

async function subirFotos(inspeccionId) {
    const uploadPromises = Object.keys(fotosCapturadas).map(async (angulo) => {
        const foto = fotosCapturadas[angulo];
        const nombreArchivo = `inspeccion_${inspeccionId}_${angulo}_${Date.now()}.jpg`;
        
        // Subir a Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from('inspecciones')
            .upload(nombreArchivo, foto.blob, {
                contentType: 'image/jpeg',
                cacheControl: '3600'
            });
        
        if (storageError) {
            console.error('Error subiendo foto:', storageError);
            return null;
        }
        
        // Obtener URL pública
        const { data: urlData } = supabase.storage
            .from('inspecciones')
            .getPublicUrl(nombreArchivo);
        
        // Guardar referencia en BD
        const { error: dbError } = await supabase
            .from('inspecciones_multimedia')
            .insert({
                inspeccion_id: inspeccionId,
                tipo: 'foto',
                categoria: 'inspeccion',
                angulo: angulo,
                url: urlData.publicUrl,
                nombre_archivo: nombreArchivo,
                tamanio_bytes: foto.blob.size
            });
        
        if (dbError) {
            console.error('Error guardando referencia de foto:', dbError);
        }
        
        return urlData.publicUrl;
    });
    
    await Promise.all(uploadPromises);
}

async function subirVideos(inspeccionId) {
    const uploadPromises = videosCapturados.map(async (video, index) => {
        const nombreArchivo = `inspeccion_${inspeccionId}_video_${index}_${Date.now()}.webm`;
        
        const { data: storageData, error: storageError } = await supabase.storage
            .from('inspecciones')
            .upload(nombreArchivo, video.blob, {
                contentType: 'video/webm',
                cacheControl: '3600'
            });
        
        if (storageError) {
            console.error('Error subiendo video:', storageError);
            return null;
        }
        
        const { data: urlData } = supabase.storage
            .from('inspecciones')
            .getPublicUrl(nombreArchivo);
        
        const { error: dbError } = await supabase
            .from('inspecciones_multimedia')
            .insert({
                inspeccion_id: inspeccionId,
                tipo: 'video',
                categoria: 'general',
                url: urlData.publicUrl,
                nombre_archivo: nombreArchivo,
                tamanio_bytes: video.blob.size
            });
        
        if (dbError) {
            console.error('Error guardando referencia de video:', dbError);
        }
        
        return urlData.publicUrl;
    });
    
    await Promise.all(uploadPromises);
}