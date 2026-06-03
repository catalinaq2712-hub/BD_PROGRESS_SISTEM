/**
 * DataScript AI - Interactive Landing Page
 * Mountains, Particles, Waves, Compare Sliders, Counters, Reveals.
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. Particle Network Canvas (Global, Fixed)
    // =========================================================================
    const particleCanvas = document.getElementById('particle-canvas');
    if (particleCanvas) {
        const ctx = particleCanvas.getContext('2d');
        let particles = [];
        let animId;

        function resizeParticles() {
            particleCanvas.width = window.innerWidth;
            particleCanvas.height = window.innerHeight;
        }
        resizeParticles();
        window.addEventListener('resize', resizeParticles);

        class Particle {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * particleCanvas.width;
                this.y = Math.random() * particleCanvas.height;
                this.vx = (Math.random() - 0.5) * 0.25;
                this.vy = (Math.random() - 0.5) * 0.25;
                this.size = Math.random() * 1.8 + 0.5;
                this.opacity = Math.random() * 0.4 + 0.15;
                this.color = Math.random() > 0.5 ? '94, 106, 210' : '167, 139, 250';
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0 || this.x > particleCanvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > particleCanvas.height) this.vy *= -1;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
                ctx.fill();
            }
        }

        function initParticles() {
            particles = [];
            const count = Math.min(Math.floor((particleCanvas.width * particleCanvas.height) / 12000), 90);
            for (let i = 0; i < count; i++) particles.push(new Particle());
        }

        function drawConnections() {
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
        }

        function animateParticles() {
            ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            drawConnections();
            animId = requestAnimationFrame(animateParticles);
        }

        initParticles();
        animateParticles();
    }

    // =========================================================================
    // 2. Mountain Wireframe Canvas (Hero Bottom)
    // =========================================================================
    const mountainCanvas = document.getElementById('mountain-canvas');
    if (mountainCanvas) {
        const ctx = mountainCanvas.getContext('2d');
        let time = 0;
        let animId;

        function resizeMountain() {
            mountainCanvas.width = mountainCanvas.offsetWidth;
            mountainCanvas.height = mountainCanvas.offsetHeight;
        }
        resizeMountain();
        window.addEventListener('resize', resizeMountain);

        function drawMountainLayer(yBase, amplitude, frequency, phase, color, lineWidth, contourCount, opacityMult) {
            const w = mountainCanvas.width;
            const h = mountainCanvas.height;
            const points = [];
            const step = 5;

            // Create sharper peaks using triangle wave approximation
            for (let x = 0; x <= w; x += step) {
                const y = yBase -
                    Math.pow(Math.abs(Math.sin(x * frequency + phase)), 0.6) * amplitude -
                    Math.pow(Math.abs(Math.sin(x * frequency * 1.8 + phase * 1.3)), 0.6) * (amplitude * 0.5) -
                    Math.pow(Math.abs(Math.sin(x * frequency * 0.6 + phase * 0.7)), 0.6) * (amplitude * 0.35);
                points.push({ x, y });
            }

            // Main ridge line
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 6 * opacityMult;
            ctx.shadowColor = color;

            for (let i = 0; i < points.length - 1; i++) {
                if (i === 0) ctx.moveTo(points[i].x, points[i].y);
                else ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Contour lines (horizontal slices) - topographic feel
            if (contourCount > 0) {
                for (let c = 1; c <= contourCount; c++) {
                    const contourY = yBase - (amplitude * (c / (contourCount + 1)));
                    ctx.beginPath();
                    ctx.strokeStyle = color.replace(')', `, ${0.12 * opacityMult})`).replace('rgb', 'rgba');
                    ctx.lineWidth = 0.5;

                    let drawing = false;
                    for (let i = 0; i < points.length; i++) {
                        const p = points[i];
                        if (p.y <= contourY) {
                            if (!drawing) {
                                ctx.moveTo(p.x, contourY);
                                drawing = true;
                            } else {
                                ctx.lineTo(p.x, contourY);
                            }
                        } else {
                            drawing = false;
                        }
                    }
                    ctx.stroke();
                }
            }

            // Side slope lines (wireframe feel)
            ctx.beginPath();
            ctx.strokeStyle = color.replace(')', `, ${0.06 * opacityMult})`).replace('rgb', 'rgba');
            ctx.lineWidth = 0.5;
            for (let i = 0; i < points.length; i += 20) {
                ctx.moveTo(points[i].x, points[i].y);
                ctx.lineTo(points[i].x, yBase);
            }
            ctx.stroke();

            return points;
        }

        function drawGlowingPath(points, color) {
            if (points.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
            ctx.lineCap = 'round';

            for (let i = 0; i < points.length - 2; i += 2) {
                const p1 = points[i];
                const p2 = points[i + 2];
                const midY = Math.max(p1.y, p2.y) + 10 + Math.sin(i * 0.1 + time * 0.5) * 2;
                if (i === 0) ctx.moveTo(p1.x, midY);
                else ctx.lineTo(p1.x, midY);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        function animateMountains() {
            const w = mountainCanvas.width;
            const h = mountainCanvas.height;
            ctx.clearRect(0, 0, w, h);
            time += 0.007;

            // Back layer (magenta/pink) - most subtle
            const backPoints = drawMountainLayer(
                h + 10,
                h * 0.45,
                0.003,
                time * 0.3,
                'rgb(232, 121, 249)',
                1.2,
                3,
                0.6
            );

            // Mid layer (purple blend)
            const midPoints = drawMountainLayer(
                h + 5,
                h * 0.35,
                0.004,
                time * 0.4 + 1.5,
                'rgb(167, 139, 250)',
                1,
                2,
                0.85
            );

            // Front layer (cyan) - most visible
            const frontPoints = drawMountainLayer(
                h + 2,
                h * 0.22,
                0.005,
                time * 0.5 + 3,
                'rgb(34, 211, 238)',
                1.3,
                2,
                1
            );

            // Glowing river/path at base
            if (midPoints && midPoints.length > 0) {
                drawGlowingPath(midPoints, 'rgba(167, 139, 250, 0.5)');
            }

            animId = requestAnimationFrame(animateMountains);
        }

        animateMountains();
    }

    // =========================================================================
    // 4. Before / After Compare Sliders
    // =========================================================================
    const containers = document.querySelectorAll('.compare-container');
    containers.forEach(container => {
        const afterPanel = container.querySelector('.compare-after');
        const handle = container.querySelector('.compare-handle');
        if (!afterPanel || !handle) return;

        function updateSplit(clientX) {
            const rect = container.getBoundingClientRect();
            let x = clientX - rect.left;
            if (x < 0) x = 0;
            if (x > rect.width) x = rect.width;
            const pct = (x / rect.width) * 100;
            afterPanel.style.width = `${100 - pct}%`;
            handle.style.left = `${pct}%`;
        }

        container.addEventListener('mousemove', (e) => updateSplit(e.clientX));
        container.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) updateSplit(e.touches[0].clientX);
        });
    });

    // =========================================================================
    // 5. Animated Number Counters (Hero Stats)
    // =========================================================================
    const statNumbers = document.querySelectorAll('.hero-stat-number');

    function animateCounter(el) {
        const target = parseInt(el.dataset.target, 10);
        const duration = 2200;
        const startTime = performance.now();

        function step(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out quad
            const eased = 1 - (1 - progress) * (1 - progress);
            const current = Math.floor(eased * target);
            el.textContent = current.toLocaleString('es-ES');
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }
        requestAnimationFrame(step);
    }

    if (statNumbers.length > 0) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        statNumbers.forEach(el => statsObserver.observe(el));
    }

    // =========================================================================
    // 6. Scroll Reveal Animations
    // =========================================================================
    const revealElements = document.querySelectorAll(
        '.showcase-card, .step-card, .demo-text, .demo-visual, .section-header, .trust-content, .testimonial-card'
    );

    revealElements.forEach(el => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // =========================================================================
    // 7. Smooth Scroll for Internal Links
    // =========================================================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});
