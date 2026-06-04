/**
 * DataScript AI - Shared Sidebar Web Component
 * Standard Web Component for unified navigation and styles.
 */

// Función global unificada para cerrar sesión
if (!window.logoutSession) {
    window.logoutSession = async function() {
        try {
            if (window.supabaseClient && window.supabaseClient.auth) {
                await window.supabaseClient.auth.signOut();
            } else if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
                await supabaseClient.auth.signOut();
            }
        } catch (err) {
            console.error('Error al cerrar sesión en Supabase:', err);
        }
        sessionStorage.clear();
        window.location.replace('login.html');
    };
}

class AppSidebar extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        const activePage = this.getAttribute('active-page') || 'dashboard';
        const role = sessionStorage.getItem('ds_role') || 'usuario';
        
        let adminLink = '';
        if (role === 'admin') {
            adminLink = `
                <a href="usu_admin.html" class="menu-item ${activePage === 'admin' ? 'active' : ''}">
                    <svg class="menu-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect>
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    Panel Administrador
                </a>
                <a href="usu_usuarios.html" class="menu-item ${activePage === 'usuarios' ? 'active' : ''}">
                    <svg class="menu-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Gestión de Usuarios
                </a>
            `;
        }

        this.innerHTML = `
            <aside class="sidebar">
                <div class="logo-sidebar">DataScript AI</div>
                
                <a href="usu_panel.html" class="menu-item ${activePage === 'dashboard' ? 'active' : ''}">
                    <svg class="menu-icon-svg" width="20" height="20" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="7" height="9" rx="1"></rect>
                        <rect x="14" y="3" width="7" height="5" rx="1"></rect>
                        <rect x="14" y="12" width="7" height="9" rx="1"></rect>
                        <rect x="3" y="16" width="7" height="5" rx="1"></rect>
                    </svg>
                    Dashboard
                </a>
                
                <a href="usu_generar.html" class="menu-item ${activePage === 'generar' ? 'active' : ''}">
                    <svg class="menu-icon-svg" width="20" height="20" viewBox="0 0 24 24">
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
                        <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path>
                    </svg>
                    Generar documento
                </a>
                
                <a href="usu_guardados.html" class="menu-item ${activePage === 'guardados' ? 'active' : ''}">
                    <svg class="menu-icon-svg" width="20" height="20" viewBox="0 0 24 24">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Documentos guardados
                </a>

                <a href="usu_compartidos.html" class="menu-item ${activePage === 'compartidos' ? 'active' : ''}">
                    <svg class="menu-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Compartidos conmigo
                </a>
                
                ${adminLink}
                
                <div class="menu-item theme-toggle" id="themeToggleBtn">
                    <svg class="menu-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    <span id="themeToggleText">Modo Estelar</span>
                </div>

                <div class="menu-item logout" id="logoutBtn" onclick="logoutSession()">
                    <svg class="menu-icon-svg" width="20" height="20" viewBox="0 0 24 24">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Cerrar Sesión
                </div>
            </aside>
        `;

        // Theme management logic
        setTimeout(() => {
            const toggleBtn = this.querySelector('#themeToggleBtn');
            const toggleText = this.querySelector('#themeToggleText');
            
            function applyTheme(isStellar) {
                if (isStellar) {
                    document.body.classList.add('theme-space');
                    if (toggleText) toggleText.innerText = 'Modo Normal';
                    
                    if (!document.getElementById('particle-canvas')) {
                        const canvas = document.createElement('canvas');
                        canvas.id = 'particle-canvas';
                        canvas.className = 'bg-particles';
                        document.body.insertBefore(canvas, document.body.firstChild);
                        initSpaceParticles(canvas);
                    }
                    if (!document.querySelector('.bg-grid')) {
                        const gridDiv = document.createElement('div');
                        gridDiv.className = 'bg-grid';
                        document.body.insertBefore(gridDiv, document.body.firstChild);
                    }
                } else {
                    document.body.classList.remove('theme-space');
                    if (toggleText) toggleText.innerText = 'Modo Estelar';
                    
                    document.getElementById('particle-canvas')?.remove();
                    document.querySelector('.bg-grid')?.remove();
                    if (window.stopSpaceParticles) window.stopSpaceParticles();
                }
            }

            let isStellar = localStorage.getItem('theme-stellar') === 'true';
            applyTheme(isStellar);

            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    isStellar = !isStellar;
                    localStorage.setItem('theme-stellar', isStellar);
                    applyTheme(isStellar);
                    window.dispatchEvent(new CustomEvent('stellarThemeChanged', { detail: { isStellar } }));
                });
            }
        }, 0);
    }
}

function initSpaceParticles(canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    let shootingStars = [];
    let animId;

    let mouse = { x: null, y: null, active: false };
    const setMouse = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; };
    const leaveMouse = () => { mouse.active = false; };
    window.addEventListener('mousemove', setMouse);
    window.addEventListener('mouseleave', leaveMouse);

    function resizeParticles() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeParticles();
    window.addEventListener('resize', resizeParticles);

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.25;
            this.vy = (Math.random() - 0.5) * 0.25;
            this.size = Math.random() * 1.8 + 0.5;
            this.opacity = Math.random() * 0.4 + 0.15;
            this.color = Math.random() > 0.5 ? '94, 106, 210' : '167, 139, 250';
        }
        update() {
            // Apply slight attraction to mouse
            if (mouse.active) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    const force = (150 - dist) * 0.003;
                    this.x -= (dx / dist) * force;
                    this.y -= (dy / dist) * force;
                }
            }

            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
            ctx.fill();
        }
    }

    class ShootingStar {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width * 0.6;
            this.y = Math.random() * canvas.height * 0.4;
            this.length = Math.random() * 80 + 45;
            this.speed = Math.random() * 6 + 4;
            this.angle = Math.PI / 4; // Diagonal path
            this.opacity = 1;
            this.active = true;
        }
        update() {
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;
            this.opacity -= 0.015;
            if (this.opacity <= 0 || this.x > canvas.width || this.y > canvas.height) {
                this.active = false;
            }
        }
        draw() {
            ctx.beginPath();
            const grad = ctx.createLinearGradient(
                this.x, this.y, 
                this.x - Math.cos(this.angle) * this.length, 
                this.y - Math.sin(this.angle) * this.length
            );
            grad.addColorStop(0, `rgba(34, 211, 238, ${this.opacity})`);
            grad.addColorStop(0.5, `rgba(167, 139, 250, ${this.opacity * 0.4})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - Math.cos(this.angle) * this.length, this.y - Math.sin(this.angle) * this.length);
            ctx.stroke();
        }
    }

    const count = Math.min(Math.floor((canvas.width * canvas.height) / 12000), 90);
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }

    function animateParticles() {
        if (!document.getElementById('particle-canvas')) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        
        // Connect particles
        const maxDist = 130;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < maxDist) {
                    const opacity = (1 - dist / maxDist) * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(167, 139, 250, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }

        // Draw connections to mouse
        if (mouse.active) {
            particles.forEach(p => {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 130) {
                    const opacity = (1 - dist / 130) * 0.22;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.strokeStyle = `rgba(34, 211, 238, ${opacity})`;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
            });
        }

        // Handle Shooting Stars
        if (Math.random() < 0.007 && shootingStars.length < 2) {
            shootingStars.push(new ShootingStar());
        }
        shootingStars = shootingStars.filter(s => s.active);
        shootingStars.forEach(s => { s.update(); s.draw(); });

        animId = requestAnimationFrame(animateParticles);
    }

    animateParticles();
    
    window.stopSpaceParticles = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resizeParticles);
        window.removeEventListener('mousemove', setMouse);
        window.removeEventListener('mouseleave', leaveMouse);
    };
}

customElements.define('app-sidebar', AppSidebar);
