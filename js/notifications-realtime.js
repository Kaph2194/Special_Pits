// js/notifications-realtime.js
import { supabase } from './supabase-config.js';
import { auth } from './auth-system.js';
import { formatearFechaHora } from './utils.js';

class NotificacionesRealtime {
    constructor() {
        this.canal = null;
        this.notificaciones = [];
        this.maxNotificaciones = 50;
        this.callbacks = [];
    }

    // Inicializar sistema de notificaciones
    async inicializar() {
        const usuario = auth.getUsuario();
        if (!usuario) return;

        // Crear contenedor de notificaciones si no existe
        this.crearContenedorNotificaciones();

        // Cargar notificaciones existentes
        await this.cargarNotificaciones();

        // Suscribirse a cambios en tiempo real
        this.suscribirCambios();
    }

    crearContenedorNotificaciones() {
        if (document.getElementById('notificaciones-container')) return;

        const container = document.createElement('div');
        container.id = 'notificaciones-container';
        container.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            width: 350px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(container);

        // Agregar estilos
        const style = document.createElement('style');
        style.textContent = `
            .notificacion-toast {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                padding: 15px;
                margin-bottom: 10px;
                pointer-events: all;
                animation: slideIn 0.3s ease-out;
                border-left: 4px solid #2563eb;
            }
            .notificacion-toast.success { border-left-color: #10b981; }
            .notificacion-toast.warning { border-left-color: #f59e0b; }
            .notificacion-toast.error { border-left-color: #ef4444; }
            .notificacion-toast.info { border-left-color: #3b82f6; }
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            .notificacion-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .notificacion-titulo {
                font-weight: 600;
                font-size: 14px;
                color: #1f2937;
            }
            .notificacion-tiempo {
                font-size: 11px;
                color: #6b7280;
            }
            .notificacion-mensaje {
                font-size: 13px;
                color: #4b5563;
                margin-bottom: 8px;
            }
            .notificacion-acciones {
                display: flex;
                gap: 8px;
            }
            .notificacion-btn {
                padding: 6px 12px;
                font-size: 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .notificacion-btn-primary {
                background: #2563eb;
                color: white;
            }
            .notificacion-btn-primary:hover {
                background: #1d4ed8;
            }
            .notificacion-btn-secondary {
                background: #e5e7eb;
                color: #374151;
            }
            .notificacion-btn-secondary:hover {
                background: #d1d5db;
            }
        `;
        document.head.appendChild(style);
    }

    async cargarNotificaciones() {
        const usuario = auth.getUsuario();
        
        const { data } = await supabase
            .from('notificaciones')
            .select('*')
            .eq('usuario_id', usuario.id)
            .eq('leida', false)
            .order('created_at', { ascending: false })
            .limit(this.maxNotificaciones);

        this.notificaciones = data || [];
    }

    suscribirCambios() {
        const usuario = auth.getUsuario();

        // Suscribirse a inserts en la tabla notificaciones
        this.canal = supabase
            .channel('notificaciones-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notificaciones',
                    filter: `usuario_id=eq.${usuario.id}`
                },
                (payload) => {
                    this.manejarNuevaNotificacion(payload.new);
                }
            )
            .subscribe();
    }

    manejarNuevaNotificacion(notificacion) {
        // Agregar a la lista
        this.notificaciones.unshift(notificacion);
        
        // Mostrar toast
        this.mostrarToast(notificacion);

        // Ejecutar callbacks registrados
        this.callbacks.forEach(cb => cb(notificacion));
    }

    mostrarToast(notificacion) {
        const container = document.getElementById('notificaciones-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `notificacion-toast ${notificacion.tipo || 'info'}`;
        toast.innerHTML = `
            <div class="notificacion-header">
                <span class="notificacion-titulo">${this.getIcono(notificacion.tipo)} ${notificacion.titulo}</span>
                <span class="notificacion-tiempo">${formatearFechaHora(notificacion.created_at)}</span>
            </div>
            <div class="notificacion-mensaje">${notificacion.mensaje}</div>
            ${notificacion.accion_url ? `
                <div class="notificacion-acciones">
                    <button class="notificacion-btn notificacion-btn-primary" 
                            onclick="window.location.href='${notificacion.accion_url}'">
                        Ver Detalle
                    </button>
                    <button class="notificacion-btn notificacion-btn-secondary" 
                            onclick="this.closest('.notificacion-toast').remove()">
                        Cerrar
                    </button>
                </div>
            ` : ''}
        `;

        container.insertBefore(toast, container.firstChild);

        // Auto-ocultar después de 10 segundos si no hay acción
        if (!notificacion.accion_url) {
            setTimeout(() => {
                toast.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => toast.remove(), 300);
            }, 10000);
        }

        // Marcar como leída automáticamente
        setTimeout(() => {
            this.marcarComoLeida(notificacion.id);
        }, 3000);
    }

    getIcono(tipo) {
        const iconos = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️',
            ot_completada: '🔧',
            solicitud_pendiente: '📝',
            factura_emitida: '💰'
        };
        return iconos[tipo] || '🔔';
    }

    async marcarComoLeida(notificacionId) {
        await supabase
            .from('notificaciones')
            .update({ leida: true })
            .eq('id', notificacionId);
    }

    // Registrar callback para eventos
    onNuevaNotificacion(callback) {
        this.callbacks.push(callback);
    }

    // Destruir suscripción
    destruir() {
        if (this.canal) {
            supabase.removeChannel(this.canal);
        }
    }

    // Crear notificación manualmente
    static async crear(usuarioId, datos) {
        const { error } = await supabase
            .from('notificaciones')
            .insert({
                usuario_id: usuarioId,
                titulo: datos.titulo,
                mensaje: datos.mensaje,
                tipo: datos.tipo || 'info',
                accion_url: datos.accion_url || null,
                leida: false
            });

        if (error) {
            console.error('Error creando notificación:', error);
        }
    }
}

// Instancia global
export const notificacionesRealtime = new NotificacionesRealtime();

// Auto-inicializar cuando se carga el módulo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        notificacionesRealtime.inicializar();
    });
} else {
    notificacionesRealtime.inicializar();
}