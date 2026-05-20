/**
 * ui.js
 * Handles Antigravity Particle UI, animations, and accessibility toggles.
 */

class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 100;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initParticles();
        this.animate();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: Math.random() * 2 + 0.5,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                alpha: Math.random() * 0.5 + 0.1
            });
        }
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw connections (Antigravity web effect)
        this.ctx.strokeStyle = 'rgba(123, 47, 247, 0.15)'; // Purple connections
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < 150) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }
        
        // Update and draw particles
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            // Wrap around
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0, 245, 255, ${p.alpha})`; // Cyan particles
            this.ctx.fill();
            
            // Add slight glowing effect to particles
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = '#00F5FF';
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

// Global state to share across modules easily
window.appState = {
    isDrawing: false,
    mode: 'hand', // 'hand' or 'foot'
    presentationMode: false,
    mirror: true,
    simpleMode: false,
    a11yMode: false,
    twoHandMode: true,
    eraseMode: false
};

export function updateModeIndicator() {
    const indicator = document.getElementById('mode-indicator');
    if (!indicator) return;
    let modeText = window.appState.mode.toUpperCase();
    if (window.appState.presentationMode) {
        modeText += ' + PRESENT';
    }
    indicator.textContent = `MODE: ${modeText}`;
}

// UI Setup
export function setupUI() {
    // Initialize Particles
    new ParticleSystem('particles-canvas');
    
    // Hand / Foot Mode Toggle
    const modeBtn = document.getElementById('btn-hand-foot');
    if (modeBtn) {
        modeBtn.addEventListener('click', () => {
            window.appState.mode = window.appState.mode === 'hand' ? 'foot' : 'hand';
            modeBtn.textContent = window.appState.mode === 'hand' ? '🖐 Hand Mode' : '🦶 Foot Mode';
            modeBtn.classList.toggle('active', window.appState.mode === 'foot');
            updateModeIndicator();
            
            if (window.appState.a11yMode && 'speechSynthesis' in window) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${window.appState.mode} mode activated.`));
            }
        });
    }

    // Mirror Toggle
    const mirrorBtn = document.getElementById('btn-mirror');
    if (mirrorBtn) {
        mirrorBtn.addEventListener('click', () => {
            window.appState.mirror = !window.appState.mirror;
            mirrorBtn.textContent = window.appState.mirror ? '🪞 Mirror: ON' : '🪞 Mirror: OFF';
            mirrorBtn.classList.toggle('active', !window.appState.mirror);
        });
    }

    // Erase Mode Toggle
    const eraseBtn = document.getElementById('btn-erase');
    if (eraseBtn) {
        eraseBtn.addEventListener('click', () => {
            window.appState.eraseMode = !window.appState.eraseMode;
            eraseBtn.textContent = window.appState.eraseMode ? '🧽 Erase: ON' : '🧽 Erase: OFF';
            eraseBtn.classList.toggle('active', window.appState.eraseMode);
            
            if (window.appState.a11yMode && 'speechSynthesis' in window) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(`Erase mode ${window.appState.eraseMode ? 'activated' : 'deactivated'}.`));
            }
        });
    }

    // Simple Mode Toggle
    const simpleBtn = document.getElementById('btn-simple');
    if (simpleBtn) {
        simpleBtn.addEventListener('click', () => {
            window.appState.simpleMode = !window.appState.simpleMode;
            if (window.appState.simpleMode) {
                document.body.classList.add('simple-mode');
                simpleBtn.textContent = '👶 Normal UI';
                simpleBtn.classList.add('active');
                updateHintsForSimpleMode(true);
            } else {
                document.body.classList.remove('simple-mode');
                simpleBtn.textContent = '👶 Simple';
                simpleBtn.classList.remove('active');
                updateHintsForSimpleMode(false);
            }
        });
    }

    // Mental Accessibility Mode Toggle
    const a11yBtn = document.getElementById('btn-accessibility');
    if (a11yBtn) {
        a11yBtn.addEventListener('click', () => {
            window.appState.a11yMode = !window.appState.a11yMode;
            if (window.appState.a11yMode) {
                a11yBtn.textContent = '🧠 A11y: ON';
                a11yBtn.classList.add('active');
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("Mental accessibility mode enabled. I will guide you."));
                }
            } else {
                a11yBtn.textContent = '🧠 A11y: OFF';
                a11yBtn.classList.remove('active');
            }
        });
    }

    // Presentation Upload Button Hook
    const presentBtn = document.getElementById('btn-presentation');
    const fileUpload = document.getElementById('file-upload');
    if (presentBtn && fileUpload) {
        presentBtn.addEventListener('click', () => {
            fileUpload.click();
        });
    }

    // Modal logic
    const galleryModal = document.getElementById('gallery-modal');
    const closeBtn = document.getElementById('btn-close-modal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            galleryModal.classList.add('hidden');
        });
    }
    
    if (galleryModal) {
        galleryModal.addEventListener('click', (e) => {
            if (e.target === galleryModal) {
                galleryModal.classList.add('hidden');
            }
        });
    }
    
    updateModeIndicator();
}

function updateHintsForSimpleMode(isSimple) {
    const hintsContainer = document.querySelector('.gesture-hints');
    if (!hintsContainer) return;
    
    if (isSimple) {
        hintsContainer.innerHTML = `
            <div class="toolbar-item hint"><div class="icon-circle">☝️</div><span>Move finger to draw</span></div>
            <div class="toolbar-item hint"><div class="icon-circle">✊</div><span>Make a fist to stop</span></div>
            <div class="toolbar-item hint"><div class="icon-circle">🖐️</div><span>Open hand to clear</span></div>
        `;
    } else {
        hintsContainer.innerHTML = `
            <div class="toolbar-item hint"><div class="icon-circle">☝️</div><span>Draw</span></div>
            <div class="toolbar-item hint"><div class="icon-circle">✊</div><span>Stop / Erase</span></div>
            <div class="toolbar-item hint"><div class="icon-circle">✌️</div><span>Color</span></div>
            <div class="toolbar-item hint"><div class="icon-circle">🖐️</div><span>Clear</span></div>
        `;
    }
}

