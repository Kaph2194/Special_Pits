// js/supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://pqsnpshtmtyzfrpdowoq.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxc25wc2h0bXR5emZycGRvd29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzExMzksImV4cCI6MjA4Njg0NzEzOX0.BOhTWspBwq-1XP-IiPAi2ve_IkYD8DGnIF84aIItG48'

// Singleton: evitar múltiples instancias
let _supabase = null

function getSupabase() {
    if (!_supabase) {
        _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        })
    }
    return _supabase
}

export const supabase = getSupabase()

export async function verificarConexion() {
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('id')
            .limit(1)
        if (error) throw error
        console.log('✅ Conexión exitosa')
        return true
    } catch (error) {
        console.error('❌ Error conexión:', error.message)
        return false
    }
}