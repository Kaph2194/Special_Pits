// js/auth-system.js
import { supabase } from './supabase-config.js';

class AuthSystem {
    constructor() {
        this.usuarioActual = null;
        this.permisos = [];
    }

    async inicializar() {
        // Primero intentar desde localStorage
        const usuarioGuardado = localStorage.getItem('sc_usuario');
        
        if (usuarioGuardado) {
            try {
                this.usuarioActual = JSON.parse(usuarioGuardado);
                await this.cargarPermisos();
                return true;
            } catch(e) {
                localStorage.removeItem('sc_usuario');
            }
        }
        return false;
    }

    async login(email, password) {
        try {
            // Para desarrollo: buscar usuario directamente en la tabla
            // (sin usar Supabase Auth para evitar el problema de múltiples instancias)
            const { data: usuario, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', email.trim().toLowerCase())
                .eq('activo', true)
                .single();

            if (error || !usuario) {
                throw new Error('Usuario no encontrado o inactivo');
            }

            // TODO: En producción verificar password con Supabase Auth
            // Por ahora aceptamos cualquier password para desarrollo
            // (agregar campo password_hash a la tabla cuando se implemente Auth completo)

            this.usuarioActual = usuario;
            localStorage.setItem('sc_usuario', JSON.stringify(usuario));
            await this.cargarPermisos();

            // Actualizar último acceso
            await supabase
                .from('usuarios')
                .update({ ultimo_acceso: new Date().toISOString() })
                .eq('id', usuario.id);

            return { success: true, usuario };

        } catch (error) {
            console.error('Error login:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        localStorage.removeItem('sc_usuario');
        this.usuarioActual = null;
        this.permisos = [];
        window.location.href = 'login.html';
    }

    async cargarPermisos() {
        if (!this.usuarioActual) return;
        try {
            const { data, error } = await supabase
                .from('rol_permisos')
                .select('permisos(modulo, accion)')
                .eq('rol', this.usuarioActual.rol);

            if (error) throw error;

            this.permisos = (data || []).map(rp => ({
                modulo: rp.permisos?.modulo,
                accion: rp.permisos?.accion
            })).filter(p => p.modulo);

            console.log(`✅ ${this.permisos.length} permisos cargados para ${this.usuarioActual.rol}`);
        } catch (error) {
            console.error('Error cargando permisos:', error);
        }
    }

    tienePermiso(modulo, accion) {
        if (this.usuarioActual?.rol === 'superadmin') return true;
        return this.permisos.some(p => p.modulo === modulo && p.accion === accion);
    }

    tieneAlgunPermiso(permisos) {
        if (this.usuarioActual?.rol === 'superadmin') return true;
        return permisos.some(p => this.tienePermiso(p.modulo, p.accion));
    }

    getUsuario() { return this.usuarioActual; }
    estaAutenticado() { return this.usuarioActual !== null; }
    esRol(rol) { return this.usuarioActual?.rol === rol; }

    async registrarAccion(accion, modulo, registroId = null, detalles = null) {
        if (!this.usuarioActual) return;
        try {
            await supabase.from('auditoria_acciones').insert({
                usuario_id:  this.usuarioActual.id,
                rol:         this.usuarioActual.rol,
                accion,
                modulo,
                registro_id: registroId,
                detalles
            });
        } catch(e) {
            console.warn('Auditoría no guardada:', e.message);
        }
    }

    redirigirSegunRol() {
        if (!this.usuarioActual) {
            window.location.href = 'login.html';
            return;
        }
        const rutas = {
            'superadmin':           'admin-dashboard.html',
            'jefe_taller':          'taller-dashboard.html',
            'jefe_almacen':         'almacen-dashboard.html',
            'mecanico':             'mecanico-dashboard.html',
            'cajero':               'caja-dashboard.html',
            'cliente_final':        'cliente-dashboard.html',
            'cliente_financiero':   'financiero-dashboard.html',
            'cliente_admin_taller': 'admin-taller-dashboard.html',
            'cliente_gerencia':     'gerencia-dashboard.html'
        };
        window.location.href = rutas[this.usuarioActual.rol] || 'index.html';
    }
}

export const auth = new AuthSystem();

export async function protegerRuta(permisosRequeridos = []) {
    const ok = await auth.inicializar();
    if (!ok) {
        window.location.href = 'login.html';
        return false;
    }
    if (permisosRequeridos.length > 0 && !auth.tieneAlgunPermiso(permisosRequeridos)) {
        alert('No tienes permisos para esta página');
        auth.redirigirSegunRol();
        return false;
    }
    return true;
}

export function aplicarPermisos() {
    document.querySelectorAll('[data-permiso]').forEach(el => {
        const [modulo, accion] = el.getAttribute('data-permiso').split(':');
        if (!auth.tienePermiso(modulo, accion)) {
            el.style.display = 'none';
        }
    });
    document.querySelectorAll('[data-rol]').forEach(el => {
        const roles = el.getAttribute('data-rol').split(',');
        if (!roles.includes(auth.getUsuario()?.rol)) {
            el.style.display = 'none';
        }
    });
}