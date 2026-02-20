// js/configuracion.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion } from './utils.js';

const dash = new DashboardBase(['superadmin']);

(async () => {
    if (!await dash.inicializar()) return;
    await cargarConfiguracion();
})();

async function cargarConfiguracion() {
    try {
        // Cargar configuración desde tabla config (crear si no existe)
        const { data } = await supabase
            .from('configuracion_sistema')
            .select('*')
            .single();

        if (data) {
            // Llenar formularios con datos guardados
            document.getElementById('empresaNombre').value = data.empresa_nombre || 'Special Car';
            document.getElementById('empresaNit').value = data.empresa_nit || '';
            document.getElementById('empresaTelefono').value = data.empresa_telefono || '';
            document.getElementById('empresaEmail').value = data.empresa_email || '';
            document.getElementById('empresaDireccion').value = data.empresa_direccion || '';
            document.getElementById('empresaCiudad').value = data.empresa_ciudad || '';
            document.getElementById('empresaSitioWeb').value = data.empresa_sitio_web || '';

            document.getElementById('ivaDefecto').value = data.iva_defecto || 19;
            document.getElementById('retefuenteDefecto').value = data.retefuente_defecto || 0;
            document.getElementById('margenDefecto').value = data.margen_defecto || 30;
            document.getElementById('diasCreditoDefecto').value = data.dias_credito_defecto || 30;
            document.getElementById('facturacionElectronica').checked = data.facturacion_electronica || false;

            document.getElementById('notificacionesEmail').checked = data.notificaciones_email !== false;
            document.getElementById('notificacionesWhatsApp').checked = data.notificaciones_whatsapp !== false;
            document.getElementById('backupAutomatico').checked = data.backup_automatico || false;
            document.getElementById('modoMantenimiento').checked = data.modo_mantenimiento || false;
        }
    } catch (error) {
        console.error('Error cargando configuración:', error);
    }
}

document.getElementById('formEmpresa').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const datos = {
        empresa_nombre: document.getElementById('empresaNombre').value,
        empresa_nit: document.getElementById('empresaNit').value,
        empresa_telefono: document.getElementById('empresaTelefono').value,
        empresa_email: document.getElementById('empresaEmail').value,
        empresa_direccion: document.getElementById('empresaDireccion').value,
        empresa_ciudad: document.getElementById('empresaCiudad').value,
        empresa_sitio_web: document.getElementById('empresaSitioWeb').value
    };

    try {
        await guardarConfiguracion(datos);
        mostrarNotificacion('✅ Información de empresa guardada', 'success');
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

document.getElementById('formFacturacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const datos = {
        iva_defecto: parseFloat(document.getElementById('ivaDefecto').value),
        retefuente_defecto: parseFloat(document.getElementById('retefuenteDefecto').value),
        margen_defecto: parseFloat(document.getElementById('margenDefecto').value),
        dias_credito_defecto: parseInt(document.getElementById('diasCreditoDefecto').value),
        facturacion_electronica: document.getElementById('facturacionElectronica').checked
    };

    try {
        await guardarConfiguracion(datos);
        mostrarNotificacion('✅ Configuración de facturación guardada', 'success');
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

document.getElementById('formPreferencias').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const datos = {
        notificaciones_email: document.getElementById('notificacionesEmail').checked,
        notificaciones_whatsapp: document.getElementById('notificacionesWhatsApp').checked,
        backup_automatico: document.getElementById('backupAutomatico').checked,
        modo_mantenimiento: document.getElementById('modoMantenimiento').checked
    };

    try {
        await guardarConfiguracion(datos);
        mostrarNotificacion('✅ Preferencias guardadas', 'success');
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

async function guardarConfiguracion(datos) {
    // Intentar actualizar, si no existe, insertar
    const { error: updateError } = await supabase
        .from('configuracion_sistema')
        .update(datos)
        .eq('id', 1);

    if (updateError) {
        // Si falla update, intentar insert
        await supabase
            .from('configuracion_sistema')
            .insert({ id: 1, ...datos });
    }

    await auth.registrarAccion('actualizar_configuracion', 'configuracion_sistema', 1);
}

window.guardarIntegraciones = async function() {
    const datos = {
        whatsapp_phone_id: document.getElementById('whatsappPhoneId').value,
        whatsapp_token: document.getElementById('whatsappToken').value,
        siigo_username: document.getElementById('siigoUsername').value,
        siigo_access_key: document.getElementById('siigoAccessKey').value
    };

    try {
        await guardarConfiguracion(datos);
        mostrarNotificacion('✅ Integraciones guardadas (usar Supabase Edge Functions para seguridad)', 'success');
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.probarWhatsApp = () => {
    mostrarNotificacion('ℹ️ Prueba de WhatsApp - Implementar con credenciales reales', 'info');
}

window.probarSIIGO = () => {
    mostrarNotificacion('ℹ️ Prueba de SIIGO - Implementar con credenciales reales', 'info');
}