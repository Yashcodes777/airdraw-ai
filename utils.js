/**
 * utils.js
 * Utility functions for math, interpolation, and general helpers.
 */

// Calculate distance between two points
export function distance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Generate smooth points using quadratic bezier interpolation
export function getSmoothPoints(points) {
    if (points.length < 3) return points;
    
    const smoothPoints = [];
    smoothPoints.push(points[0]);
    
    for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        
        smoothPoints.push({
            cx: points[i].x,
            cy: points[i].y,
            x: xc,
            y: yc
        });
    }
    
    // Add the last point
    const last = points[points.length - 1];
    smoothPoints.push({
        cx: last.x,
        cy: last.y,
        x: last.x,
        y: last.y
    });
    
    return smoothPoints;
}

// Draw a smooth stroke on the canvas
export function drawSmoothLine(ctx, points, color, size) {
    if (points.length === 0) return;
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Neon glow effect
    ctx.shadowBlur = 25;
    ctx.shadowColor = color;

    ctx.moveTo(points[0].x, points[0].y);
    
    if (points.length < 3) {
        // Just draw a line or a dot
        for(let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        return;
    }
    
    const smoothed = getSmoothPoints(points);
    
    for (let i = 1; i < smoothed.length; i++) {
        if (smoothed[i].cx !== undefined) {
            ctx.quadraticCurveTo(smoothed[i].cx, smoothed[i].cy, smoothed[i].x, smoothed[i].y);
        } else {
            ctx.lineTo(smoothed[i].x, smoothed[i].y);
        }
    }
    
    ctx.stroke();
    
    // Reset shadow to avoid affecting other draws unnecessarily
    ctx.shadowBlur = 0;
}

// Exponential Moving Average (EMA) for smoothing raw points from MediaPipe
export class PointSmoother {
    constructor(alpha = 0.5) {
        this.alpha = alpha;
        this.smoothedPoint = null;
    }
    
    process(rawPoint) {
        if (!this.smoothedPoint) {
            this.smoothedPoint = { ...rawPoint };
            return this.smoothedPoint;
        }
        
        this.smoothedPoint.x = this.alpha * rawPoint.x + (1 - this.alpha) * this.smoothedPoint.x;
        this.smoothedPoint.y = this.alpha * rawPoint.y + (1 - this.alpha) * this.smoothedPoint.y;
        
        return { ...this.smoothedPoint };
    }
    
    reset() {
        this.smoothedPoint = null;
    }
}
