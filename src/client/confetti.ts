import { onAction } from "./events";

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#a855f7", "#ec4899", "#facc15"];
const GRAVITY = 0.28;
const DRAG = 0.985;

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    round: boolean;
    rotation: number;
    spin: number;
    tilt: number;
    tiltSpeed: number;
    life: number;
}

const canvas = document.createElement("canvas");
canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

let width = 0;
let height = 0;

function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);

let particles: Particle[] = [];
let rafId: number | null = null;
let lastTime = 0;
let rainUntil = 0;

function spawn(x: number, y: number, angle: number, speed: number, spread: number) {
    const a = angle + (Math.random() - 0.5) * spread;
    const s = speed * (0.5 + Math.random() * 0.7);
    particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: 6 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        round: Math.random() < 0.25,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.3,
        tilt: Math.random() * Math.PI * 2,
        tiltSpeed: 0.1 + Math.random() * 0.2,
        life: 180 + Math.random() * 80,
    });
}

function draw(p: Particle) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 40);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.scale(1, Math.cos(p.tilt));
    ctx.fillStyle = p.color;
    if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    ctx.restore();
}

function frame(now: number) {
    const dt = Math.min((now - lastTime) / 16.67, 3);
    lastTime = now;

    // Confetti rain from the top while the rain window is open
    if (now < rainUntil) {
        for (let i = 0; i < 3; i++) {
            spawn(Math.random() * width, -20, Math.PI / 2, 3, 0.6);
        }
    }

    ctx.clearRect(0, 0, width, height);

    particles = particles.filter((p) => {
        p.vy += GRAVITY * dt;
        p.vx *= Math.pow(DRAG, dt);
        p.vy *= Math.pow(DRAG, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        p.tilt += p.tiltSpeed * dt;
        p.life -= dt;

        if (p.life <= 0 || p.y > height + 30) return false;

        draw(p);
        return true;
    });

    if (particles.length > 0 || now < rainUntil) {
        rafId = requestAnimationFrame(frame);
    } else {
        rafId = null;
        ctx.clearRect(0, 0, width, height);
    }
}

export function launchConfetti() {
    // Two cannons from the bottom corners, aimed up and inward
    for (let i = 0; i < 90; i++) {
        spawn(0, height, -Math.PI / 2 + 0.55, 22, 0.6);
        spawn(width, height, -Math.PI / 2 - 0.55, 22, 0.6);
    }
    // Centre burst
    for (let i = 0; i < 50; i++) {
        spawn(width / 2, height * 0.6, -Math.PI / 2, 18, 1.6);
    }
    rainUntil = performance.now() + 1500;
    if (rafId === null) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(frame);
    }
}

onAction("confetti", launchConfetti);

// Handy for testing from the console: launchConfetti();
window.launchConfetti = launchConfetti;
