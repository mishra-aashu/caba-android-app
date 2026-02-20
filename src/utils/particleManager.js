/**
 * GPU-Accelerated Particle Manager (Telegram-Style Disintegration)
 * Uses a pooled particle system with Canvas 2D and synthesised hiss sound
 */

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.size = 0;
        this.color = '';
        this.alpha = 1;
        this.life = 0;
        this.active = false;
    }

    init(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.active = true;
        this.alpha = 1;
        this.life = 1.0;

        // Smoke-like physics: random drift + upward buoyancy
        const angle = Math.random() * Math.PI * 2;
        const force = Math.random() * 1.2 + 0.3;
        this.vx = Math.cos(angle) * force;
        this.vy = Math.sin(angle) * force - (Math.random() * 2 + 1.5); // Stronger upward drift

        this.size = Math.random() * 4 + 2;
        this.expansion = 0.08; // Expands more prominently
        this.friction = 0.95;
        this.gravity = -0.05; // Negative gravity = rising smoke
    }

    update() {
        if (!this.active) return;

        this.x += this.vx;
        this.y += this.vy;

        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity; // Rise over time
        this.size += this.expansion;

        this.life -= 0.012; // Slower fade for more visible smoke
        this.alpha = Math.max(0, this.life);

        if (this.life <= 0 || this.size > 25) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.globalAlpha = this.alpha * 0.5; // Soft transparency
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class ParticleManager {
    constructor() {
        this.particles = [];
        this.poolSize = 800; // Increased pool size for denser smoke
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.audioCtx = null;

        for (let i = 0; i < this.poolSize; i++) {
            this.particles.push(new Particle());
        }
    }

    setCanvas(canvas) {
        this.canvas = canvas;
        if (canvas) {
            this.ctx = canvas.getContext('2d', { alpha: true });
            this.start();
        } else {
            this.stop();
        }
    }

    // Synthesize "sss" sound using Web Audio API
    playHiss() {
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const duration = 0.4;
            const bufferSize = this.audioCtx.sampleRate * duration;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);

            // Generate white noise
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;

            // Soft high-pass filter for "hiss" quality
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 5000;

            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);

            noise.start();
            noise.stop(this.audioCtx.currentTime + duration);
        } catch (e) {
            console.warn('Audio synthesis failed:', e);
        }
    }

    spawn(x, y, color = '#6366f1', width = 0, height = 0) {
        this.playHiss();

        // Area-based spawning for disintegration
        if (width > 0 && height > 0) {
            const count = 120; // Much denser smoke
            let spawned = 0;
            // Adjust color to be more "smoky" (lighter/greyer)
            const smokeColor = color === '#555555' ? '#aaaaaa' : color;

            for (let i = 0; i < this.particles.length && spawned < count; i++) {
                if (!this.particles[i].active) {
                    const px = x + (Math.random() - 0.5) * width;
                    const py = y + (Math.random() - 0.5) * height;
                    this.particles[i].init(px, py, smokeColor);
                    spawned++;
                }
            }
        } else {
            const count = 40;
            let spawned = 0;
            for (let i = 0; i < this.particles.length && spawned < count; i++) {
                if (!this.particles[i].active) {
                    this.particles[i].init(x, y, color);
                    spawned++;
                }
            }
        }
    }

    start() {
        if (this.animationId) return;
        const animate = () => {
            this.update();
            this.draw();
            this.animationId = requestAnimationFrame(animate);
        };
        this.animationId = requestAnimationFrame(animate);
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    update() {
        for (const p of this.particles) {
            p.update();
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const p of this.particles) {
            p.draw(this.ctx);
        }
    }
}

export const particleManager = new ParticleManager();
export default particleManager;
