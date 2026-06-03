// DataScript AI - Gestión de Usuarios Logic
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si es administrador
    const adminId = sessionStorage.getItem('ds_user');
    const adminRole = sessionStorage.getItem('ds_role');
    
    if (!adminId || adminRole !== 'admin') {
        window.location.replace('login.html');
        return;
    }

    // Elementos del DOM
    const usersGrid = document.getElementById('usersGrid');
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    const userModalBackdrop = document.getElementById('userModalBackdrop');
    const userForm = document.getElementById('userForm');
    const modalTitle = document.getElementById('modalTitle');
    const userIdField = document.getElementById('userIdField');
    const nombreField = document.getElementById('nombreField');
    const apellidoField = document.getElementById('apellidoField');
    const emailField = document.getElementById('emailField');
    const passwordField = document.getElementById('passwordField');
    const passwordLabel = document.getElementById('passwordLabel');
    const roleField = document.getElementById('roleField');
    const statusField = document.getElementById('statusField');
    const usoField = document.getElementById('usoField');
    
    const photoFile = document.getElementById('photoFile');
    const photoPreview = document.getElementById('photoPreview');
    const photoInitials = document.getElementById('photoInitials');
    
    const openCreateModalBtn = document.getElementById('openCreateModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');

    // Variables de Estado
    let allUsers = [];
    let base64Photo = null;

    // Cargar Usuarios desde Backend
    async function loadUsers() {
        usersGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #9ca3af;">
                <svg class="loading-spinner" style="margin: 0 auto 16px; width: 40px; height: 40px; animation: spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10"></path>
                </svg>
                Cargando lista de usuarios de forma segura...
            </div>
        `;
        
        try {
            const response = await fetch('/api/admin/users', {
                method: 'GET',
                headers: {
                    'x-admin-id': adminId
                }
            });
            
            const result = await response.json();
            if (response.ok && result.success) {
                allUsers = result.users || [];
                renderUsers(allUsers);
            } else {
                usersGrid.innerHTML = `<div class="empty-state">Error cargando usuarios: ${result.error || 'Acceso denegado'}</div>`;
            }
        } catch (err) {
            console.error('Error cargando usuarios:', err);
            usersGrid.innerHTML = `<div class="empty-state">Error de conexión al servidor: ${err.message}</div>`;
        }
    }

    // Renderizar Usuarios
    function renderUsers(users) {
        usersGrid.innerHTML = '';
        
        if (users.length === 0) {
            usersGrid.innerHTML = `<div class="empty-state">No se encontraron usuarios registrados matching con los filtros.</div>`;
            return;
        }

        users.forEach(user => {
            const card = document.createElement('div');
            card.className = `user-card role-${user.rol}`;
            
            // Iniciales o Foto de Perfil
            let avatarHTML = '';
            if (user.foto_url && user.foto_url.startsWith('data:image')) {
                avatarHTML = `<img src="${user.foto_url}" class="user-avatar-img" alt="${user.nombres}">`;
            } else {
                const initials = ((user.nombres ? user.nombres[0] : '') + (user.apellidos ? user.apellidos[0] : '')).toUpperCase() || '?';
                avatarHTML = `<div class="user-avatar-initials">${initials}</div>`;
            }

            const docsCount = user.documentosCount || 0;
            const rolLabel = user.rol === 'admin' ? 'Administrador' : (user.rol === 'premium' ? 'Premium' : 'Estándar');
            const estadoLabel = user.estado === 'suspendido' ? 'Suspendido' : 'Activo';

            card.innerHTML = `
                <div class="user-avatar-container">
                    ${avatarHTML}
                </div>
                <div class="user-name">${user.nombres} ${user.apellidos}</div>
                <div class="user-email">${user.email || 'Sin correo'}</div>
                
                <div class="badges-row">
                    <span class="badge-role ${user.rol}">${rolLabel}</span>
                    <span class="badge-status ${user.estado}">${estadoLabel}</span>
                </div>
                
                <div class="user-stats">
                    <div class="user-stat-item">
                        <span class="user-stat-val">${docsCount}</span>
                        <span class="user-stat-lbl">Docs</span>
                    </div>
                    <div class="user-stat-item">
                        <span class="user-stat-val" style="text-transform: capitalize; font-size: 0.95rem;">${user.tipo_uso || 'Personal'}</span>
                        <span class="user-stat-lbl">Uso</span>
                    </div>
                </div>
                
                <div class="user-actions">
                    <button class="card-btn edit" data-id="${user.id}">Editar</button>
                    ${user.id !== adminId ? `<button class="card-btn delete" data-id="${user.id}">Eliminar</button>` : ''}
                </div>
            `;

            // Listeners de los botones
            card.querySelector('.edit').addEventListener('click', () => openEditModal(user));
            const deleteBtn = card.querySelector('.delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => deleteUser(user.id, `${user.nombres} ${user.apellidos}`));
            }

            usersGrid.appendChild(card);
        });
    }

    // Filtrado en tiempo real
    function filterUsers() {
        const query = searchInput.value.toLowerCase().trim();
        const role = roleFilter.value;
        const status = statusFilter.value;

        const filtered = allUsers.filter(u => {
            const matchesQuery = 
                (u.nombres || '').toLowerCase().includes(query) || 
                (u.apellidos || '').toLowerCase().includes(query) || 
                (u.email || '').toLowerCase().includes(query);
            
            const matchesRole = role === 'todos' || u.rol === role;
            const matchesStatus = status === 'todos' || u.estado === status;

            return matchesQuery && matchesRole && matchesStatus;
        });

        renderUsers(filtered);
    }

    searchInput.addEventListener('input', filterUsers);
    roleFilter.addEventListener('change', filterUsers);
    statusFilter.addEventListener('change', filterUsers);

    // Modales de control
    function openCreateModal() {
        userForm.reset();
        userIdField.value = '';
        modalTitle.textContent = 'Crear Nuevo Usuario';
        passwordField.required = true;
        passwordLabel.textContent = 'Contraseña';
        
        // Reset Foto
        base64Photo = null;
        photoPreview.style.display = 'none';
        photoInitials.style.display = 'block';
        photoInitials.textContent = '?';
        
        userModalBackdrop.classList.add('active');
    }

    function openEditModal(user) {
        userIdField.value = user.id;
        modalTitle.textContent = `Editar Usuario: ${user.nombres}`;
        nombreField.value = user.nombres || '';
        apellidoField.value = user.apellidos || '';
        emailField.value = user.email || '';
        
        passwordField.required = false;
        passwordLabel.textContent = 'Cambiar Contraseña (Opcional)';
        passwordField.value = '';

        roleField.value = user.rol || 'usuario';
        statusField.value = user.estado || 'activo';
        usoField.value = (user.tipo_uso || 'Personal').toLowerCase();

        // Renderizar Foto
        if (user.foto_url && user.foto_url.startsWith('data:image')) {
            base64Photo = user.foto_url;
            photoPreview.src = user.foto_url;
            photoPreview.style.display = 'block';
            photoInitials.style.display = 'none';
        } else {
            base64Photo = null;
            photoPreview.style.display = 'none';
            photoInitials.style.display = 'block';
            photoInitials.textContent = ((user.nombres ? user.nombres[0] : '') + (user.apellidos ? user.apellidos[0] : '')).toUpperCase() || '?';
        }

        userModalBackdrop.classList.add('active');
    }

    function closeModal() {
        userModalBackdrop.classList.remove('active');
    }

    openCreateModalBtn.addEventListener('click', openCreateModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);

    // Procesar Carga de Imagen
    photoFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validar tamaño máximo de 2MB
        if (file.size > 2 * 1024 * 1024) {
            alert('La imagen de perfil debe ser menor a 2MB para almacenamiento optimizado.');
            photoFile.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            // Generar una versión comprimida usando Canvas para no llenar la base de datos
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 150;
                const MAX_HEIGHT = 150;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a JPEG comprimido Base64
                base64Photo = canvas.toDataURL('image/jpeg', 0.7);
                photoPreview.src = base64Photo;
                photoPreview.style.display = 'block';
                photoInitials.style.display = 'none';
            };
        };
        reader.readAsDataURL(file);
    });

    // Guardar / Crear Usuario Submit
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const uId = userIdField.value;
        const nombres = nombreField.value;
        const apellidos = apellidoField.value;
        const email = emailField.value;
        const password = passwordField.value;
        const rol = roleField.value;
        const estado = statusField.value;
        const tipo_uso = usoField.value;

        const payload = {
            nombres,
            apellidos,
            email,
            rol,
            estado,
            tipo_uso,
            foto_url: base64Photo
        };
        if (password) payload.password = password;

        const url = uId ? `/api/admin/users/${uId}` : '/api/admin/users';
        const method = uId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-id': adminId
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (response.ok && result.success) {
                alert(uId ? 'Usuario actualizado con éxito.' : 'Usuario creado con éxito.');
                closeModal();
                loadUsers();
            } else {
                alert('Error al guardar: ' + (result.error || 'Error desconocido'));
            }
        } catch (err) {
            console.error('Error enviando formulario:', err);
            alert('Error de conexión al servidor: ' + err.message);
        }
    });

    // Eliminar Usuario
    async function deleteUser(id, userName) {
        if (!confirm(`¿Está seguro de que desea eliminar permanentemente a ${userName}? Esta acción no se puede deshacer y borrará todos sus documentos.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE',
                headers: {
                    'x-admin-id': adminId
                }
            });

            const result = await response.json();
            if (response.ok && result.success) {
                alert('Usuario eliminado con éxito.');
                loadUsers();
            } else {
                alert('No se pudo eliminar el usuario: ' + (result.error || 'Error desconocido'));
            }
        } catch (err) {
            console.error('Error eliminando usuario:', err);
            alert('Error de conexión al servidor: ' + err.message);
        }
    }

    // Inicializar
    loadUsers();
});
