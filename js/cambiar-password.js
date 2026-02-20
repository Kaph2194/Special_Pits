// js/cambiar-password.js
import { supabase } from './supabase-config.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion } from './utils.js';

export function mostrarModalCambiarPassword() {
    const modal = `
        <div class="modal" style="display:flex;" id="modalCambiarPassword">
            <div class="modal-content" style="max-width:500px;">
                <h2>🔑 Cambiar Contraseña</h2>
                
                <form id="formCambiarPassword">
                    <div class="form-group">
                        <label>Contraseña Actual *</label>
                        <input type="password" id="passwordActual" class="form-control" 
                               required minlength="6">
                    </div>

                    <div class="form-group">
                        <label>Nueva Contraseña *</label>
                        <input type="password" id="passwordNueva" class="form-control" 
                               required minlength="6">
                        <small style="color:var(--gray-700);">Mínimo 6 caracteres</small>
                    </div>

                    <div class="form-group">
                        <label>Confirmar Nueva Contraseña *</label>
                        <input type="password" id="passwordConfirmar" class="form-control" 
                               required minlength="6">
                    </div>

                    <div style="display:flex;gap:1rem;margin-top:1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">
                            🔐 Cambiar Contraseña
                        </button>
                        <button type="button" onclick="cerrarModalPassword()" class="btn btn-secondary">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    document.getElementById('formCambiarPassword').addEventListener('submit', async (e) => {
        e.preventDefault();

        const actual = document.getElementById('passwordActual').value;
        const nueva = document.getElementById('passwordNueva').value;
        const confirmar = document.getElementById('passwordConfirmar').value;

        if (nueva !== confirmar) {
            mostrarNotificacion('⚠️ Las contraseñas no coinciden', 'warning');
            return;
        }

        if (nueva.length < 6) {
            mostrarNotificacion('⚠️ La contraseña debe tener al menos 6 caracteres', 'warning');
            return;
        }

        try {
            const usuario = auth.getUsuario();

            // TODO: Implementar con Supabase Auth cuando esté configurado
            // Por ahora, solo actualizar en la tabla usuarios
            await supabase
                .from('usuarios')
                .update({ 
                    password_temporal: false,
                    debe_cambiar_password: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', usuario.id);

            await auth.registrarAccion('cambiar_password', 'usuarios', usuario.id);
            
            mostrarNotificacion('✅ Contraseña actualizada correctamente', 'success');
            cerrarModalPassword();

        } catch (error) {
            console.error('Error:', error);
            mostrarNotificacion('❌ Error cambiando contraseña: ' + error.message, 'error');
        }
    });
}

window.cerrarModalPassword = () => {
    document.getElementById('modalCambiarPassword')?.remove();
}