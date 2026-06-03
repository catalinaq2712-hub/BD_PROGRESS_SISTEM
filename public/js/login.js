// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Supabase
    const SUPABASE_URL = 'https://anzravhguhsdfnjfsjcm.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_sIB2jrePXiRBfBidFDFRjA_JeYe5cfP';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Elementos del DOM
    const loginDiv = document.getElementById('loginFormContainer');
    const registerDiv = document.getElementById('registerFormContainer');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const btnLogin = document.getElementById('btnLogin');
    const btnRegister = document.getElementById('btnRegister');

    // Verificar que los elementos existan
    if (!btnLogin || !btnRegister) {
        console.error('No se encontraron los botones de login/registro');
        return;
    }

    // Transición entre formularios
    function fadeTransition(showLogin) {
        if (showLogin) {
            loginDiv.style.display = 'block';
            registerDiv.style.display = 'none';
        } else {
            loginDiv.style.display = 'none';
            registerDiv.style.display = 'block';
        }
    }

    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); fadeTransition(false); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); fadeTransition(true); });

    // --- LOGIN ---
    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('loginUser').value.trim();
        const password = document.getElementById('loginPass').value.trim();
        if (!email || !password) {
            alert('Por favor ingresa correo y contraseña');
            return;
        }
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            sessionStorage.setItem('ds_logged', 'true');
            sessionStorage.setItem('ds_user', data.user.id);
            sessionStorage.setItem('ds_email', data.user.email);
            
            // Obtener el rol del usuario desde la tabla de perfiles
            const { data: perfil, error: perfilError } = await supabase
                .from('perfiles')
                .select('rol')
                .eq('id', data.user.id)
                .single();
                
            const rol = perfil && !perfilError ? perfil.rol : 'usuario';
            sessionStorage.setItem('ds_role', rol);

            // Registrar log de inicio de sesión
            try {
                await fetch('/api/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        usuarioId: data.user.id,
                        usuarioEmail: data.user.email,
                        accion: 'login',
                        detalles: { agent: navigator.userAgent }
                    })
                });
            } catch (logErr) {
                console.error('Error registrando log de login:', logErr);
            }

            window.location.href = 'usu_panel.html';

        } catch (err) {
            console.error(err);
            alert('Error al iniciar sesión: ' + err.message);
        }
    });

    // --- REGISTRO ---
    btnRegister.addEventListener('click', async () => {
        const nombres = document.getElementById('regNombres').value.trim();
        const apellidos = document.getElementById('regApellidos').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const tipoUso = document.getElementById('regTipoUso').value;
        const usuario = document.getElementById('regUsuario').value.trim();
        const pwd = document.getElementById('regPassword').value.trim();
        const confirm = document.getElementById('regConfirmPassword').value.trim();

        if (!nombres || !apellidos || !email || !usuario || !pwd) {
            alert('Todos los campos son obligatorios');
            return;
        }
        if (pwd !== confirm) {
            alert('Las contraseñas no coinciden');
            return;
        }

        try {
            // Registrar en Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email,
                password: pwd,
                options: { data: { usuario, nombres, apellidos, tipo_uso: tipoUso } }
            });
            if (error) throw error;

            if (data.user) {
                // Insertar perfil en la tabla 'perfiles'
                const { error: perfilError } = await supabase
                    .from('perfiles')
                    .insert([{ id: data.user.id, nombres, apellidos, tipo_uso: tipoUso }]);
                if (perfilError) console.error('Error guardando perfil:', perfilError);
                alert('¡Registro exitoso! Te hemos enviado un correo electrónico de confirmación. Por favor, revisa tu bandeja de entrada y verifica tu cuenta antes de iniciar sesión.');
                fadeTransition(true);
                document.getElementById('loginUser').value = email;
                // Limpiar formulario de registro
                document.getElementById('regNombres').value = '';
                document.getElementById('regApellidos').value = '';
                document.getElementById('regEmail').value = '';
                document.getElementById('regUsuario').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regConfirmPassword').value = '';
            }
        } catch (err) {
            console.error(err);
            alert('Error en registro: ' + err.message);
        }
    });
});