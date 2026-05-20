/**
 * app.js
 * Main application entry point. Handles canvas drawing engine and state.
 */

import { setupUI } from './ui.js';
import { HandTracker } from './handTracking.js';
import { drawSmoothLine, PointSmoother, distance } from './utils.js';
import { initFirebase } from './firebase.js';
import { PresentationManager } from './presentation.js';

class DrawingEngine {
    constructor() {
        this.canvas = document.getElementById('output-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.bgCanvas = document.getElementById('bg-canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');
        
        this.strokes = []; // Array of finished strokes for Undo
        this.currentStroke = []; // Array of points in current stroke
        this.eraseStrokes = []; // Strokes that erase
        this.currentEraseStroke = []; 
        
        window.appState.isDrawing = false;
        window.appState.isErasing = false;
        
        this.currentSkeleton = null;
        this.currentSkeletonType = null;
        this.skeletonState = {};
        this.lastSkeletonUpdate = 0;
        
        // UI Controls
        this.colorPicker = document.getElementById('color-picker');
        this.brushSizeSlider = document.getElementById('brush-size');
        
        this.currentColor = this.colorPicker.value;
        this.currentSize = parseInt(this.brushSizeSlider.value);
        
        // Colors palette for gesture switching
        this.palette = ['#00F5FF', '#7B2FF7', '#ffff00', '#00ff00', '#ff0000', '#ffffff'];
        this.colorIndex = 0;
        
        // Pointer state
        this.pointer = { x: -100, y: -100 };
        this.smoother = new PointSmoother(0.4); // Adjust alpha for smoothness vs responsiveness
        
        this.init();
    }
    
    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // UI Listeners
        this.colorPicker.addEventListener('input', (e) => this.currentColor = e.target.value);
        this.brushSizeSlider.addEventListener('input', (e) => this.currentSize = parseInt(e.target.value));
        
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-clear').addEventListener('click', () => this.clearCanvas());
        
        // Start render loop
        this.animate();
        
        // Initialize Firebase
        // This will bind auth buttons and save/load logic
        initFirebase(this);
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.bgCanvas.width = window.innerWidth;
        this.bgCanvas.height = window.innerHeight;
        
        if (this.backgroundImage) {
            this.drawBackground();
        }
    }
    
    onDraw(x, y) {
        if (window.appState.isErasing) this.onStop();
        
        this._setAlpha();
        const smoothed = this.smoother.process({x, y});
        this._applyDeadzone(smoothed);
        
        if (!window.appState.isDrawing) {
            window.appState.isDrawing = true;
            this.currentStroke = [];
            this.currentStroke.push({ x: smoothed.x, y: smoothed.y });
        } else {
            const lastPoint = this.currentStroke[this.currentStroke.length - 1];
            if (distance(lastPoint, smoothed) > 2) {
                this.currentStroke.push({ x: smoothed.x, y: smoothed.y });
            }
        }
        
        this.pointer = { x: smoothed.x, y: smoothed.y };
    }
    
    onErase(x, y) {
        if (window.appState.isDrawing) this.onStop();
        
        this._setAlpha();
        const smoothed = this.smoother.process({x, y});
        this._applyDeadzone(smoothed);
        
        if (!window.appState.isErasing) {
            window.appState.isErasing = true;
            this.currentEraseStroke = [];
            this.currentEraseStroke.push({ x: smoothed.x, y: smoothed.y });
        } else {
            const lastPoint = this.currentEraseStroke[this.currentEraseStroke.length - 1];
            if (distance(lastPoint, smoothed) > 2) {
                this.currentEraseStroke.push({ x: smoothed.x, y: smoothed.y });
            }
        }
        
        this.pointer = { x: smoothed.x, y: smoothed.y };
    }
    
    onUpdateSkeleton(landmarks, type, state) {
        this.currentSkeleton = landmarks;
        this.currentSkeletonType = type;
        this.skeletonState = state || {};
        this.lastSkeletonUpdate = Date.now();
    }
    
    _setAlpha() {
        if (window.appState.mode === 'foot') {
            this.smoother.alpha = 0.05; // Heavy smoothing
        } else if (window.appState && window.appState.a11yMode) {
            this.smoother.alpha = 0.1; // Slower, more smoothed
        } else {
            this.smoother.alpha = 0.4; // Normal responsiveness
        }
    }
    
    _applyDeadzone(smoothed) {
        // Deadzone for foot
        if (window.appState.mode === 'foot' && this.pointer.x >= 0) {
            const dist = distance(this.pointer, smoothed);
            if (dist < 5) { // Ignore micro-movements
                smoothed.x = this.pointer.x;
                smoothed.y = this.pointer.y;
            }
        }
    }
    
    onStop() {
        if (window.appState.isDrawing) {
            window.appState.isDrawing = false;
            
            if (this.currentStroke.length > 0) {
                this.strokes.push({
                    points: [...this.currentStroke],
                    color: this.currentColor,
                    size: this.currentSize
                });
            }
            this.currentStroke = [];
            this.smoother.reset();
        }
        if (window.appState.isErasing) {
            window.appState.isErasing = false;
            if (this.currentEraseStroke.length > 0) {
                this.eraseStrokes.push({
                    points: [...this.currentEraseStroke],
                    size: this.currentSize * 3 // Eraser is bigger
                });
            }
            this.currentEraseStroke = [];
            this.smoother.reset();
        }
    }
    
    onClear() {
        this.clearCanvas();
    }
    
    onChangeColor() {
        this.colorIndex = (this.colorIndex + 1) % this.palette.length;
        this.currentColor = this.palette[this.colorIndex];
        this.colorPicker.value = this.currentColor;
    }
    
    onPointerMove(x, y) {
        // Just update cursor position if not drawing
        if (!window.appState.isDrawing) {
            if (window.appState.mode === 'foot') {
                this.smoother.alpha = 0.05;
            } else if (window.appState && window.appState.a11yMode) {
                this.smoother.alpha = 0.1;
            } else {
                this.smoother.alpha = 0.4;
            }
            const smoothed = this.smoother.process({x, y});
            
            if (window.appState.mode === 'foot' && this.pointer.x >= 0) {
                const dist = distance(this.pointer, smoothed);
                if (dist < 5) {
                    smoothed.x = this.pointer.x;
                    smoothed.y = this.pointer.y;
                }
            }
            this.pointer = { x: smoothed.x, y: smoothed.y };
        }
    }
    
    // Actions
    undo() {
        if (this.strokes.length > 0) {
            this.strokes.pop();
        }
    }
    
    clearCanvas() {
        this.strokes = [];
        this.currentStroke = [];
        this.eraseStrokes = [];
        this.currentEraseStroke = [];
    }
    
    // Render Loop
    animate() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw all saved strokes
        this.ctx.globalCompositeOperation = 'source-over';
        for (const stroke of this.strokes) {
            drawSmoothLine(this.ctx, stroke.points, stroke.color, stroke.size);
        }
        
        // Draw current stroke
        if (window.appState.isDrawing && this.currentStroke.length > 0) {
            drawSmoothLine(this.ctx, this.currentStroke, this.currentColor, this.currentSize);
        }
        
        // Handle erasing
        this.ctx.globalCompositeOperation = 'destination-out';
        for (const stroke of this.eraseStrokes) {
            drawSmoothLine(this.ctx, stroke.points, 'rgba(0,0,0,1)', stroke.size);
        }
        if (window.appState.isErasing && this.currentEraseStroke.length > 0) {
            drawSmoothLine(this.ctx, this.currentEraseStroke, 'rgba(0,0,0,1)', this.currentSize * 3);
        }
        
        // Reset composite for cursor
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Draw custom cursor (neon ring)
        if (this.pointer.x >= 0 && this.pointer.y >= 0) {
            this.ctx.beginPath();
            const isEraser = window.appState.eraseMode;
            const cursorSize = isEraser ? this.currentSize * 3 : ((window.appState.mode === 'foot' || window.appState.a11yMode) ? this.currentSize * 2 : this.currentSize);
            
            this.ctx.arc(this.pointer.x, this.pointer.y, cursorSize + 5, 0, Math.PI * 2);
            this.ctx.strokeStyle = isEraser ? '#ffffff' : this.currentColor;
            this.ctx.lineWidth = isEraser ? 3 : 2;
            
            if (window.appState.isDrawing) {
                this.ctx.fillStyle = this.currentColor;
                this.ctx.fill();
            } else if (window.appState.isErasing) {
                this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
                this.ctx.fill();
            } else {
                this.ctx.stroke();
            }
            
            this.ctx.shadowBlur = 25;
            this.ctx.shadowColor = isEraser ? '#ffffff' : this.currentColor;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        // Draw Skeleton Overlays
        if (this.currentSkeleton && (Date.now() - this.lastSkeletonUpdate < 300)) {
            if (this.currentSkeletonType === 'virtual_foot') {
                this.drawVirtualFootSkeleton();
            } else if (this.currentSkeletonType === 'hand') {
                // Hand rendering could go here if needed
            }
        } else {
            this.currentSkeleton = null;
        }
        
        requestAnimationFrame(() => this.animate());
    }
    
    drawVirtualFootSkeleton() {
        const skeleton = this.currentSkeleton;
        const state = this.skeletonState;
        
        this.ctx.globalCompositeOperation = 'source-over';
        
        const getPt = (ptObj) => {
            if (!ptObj) return {x: 0, y: 0};
            const mirrorX = window.appState.mirror ? (1 - ptObj.x) : ptObj.x;
            return {
                x: mirrorX * this.canvas.width,
                y: ptObj.y * this.canvas.height
            };
        };

        const drawLine = (pt1, pt2, color, width) => {
            const p1 = getPt(pt1);
            const p2 = getPt(pt2);
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = width;
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
        };

        const drawJoint = (ptObj, radius, color) => {
            const p = getPt(ptObj);
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        };

        // Red connecting lines
        const lineColor = state.isClosed ? '#ff0000' : '#e63946';
        
        // 1. Heel to Mid-foot
        drawLine(skeleton.heel, skeleton.m1, lineColor, 3);
        drawLine(skeleton.heel, skeleton.m2, lineColor, 3);
        drawLine(skeleton.heel, skeleton.m3, lineColor, 3);
        drawLine(skeleton.heel, skeleton.m4, lineColor, 3);

        // 2. Mid-foot transverse line
        drawLine(skeleton.m1, skeleton.m2, lineColor, 3);
        drawLine(skeleton.m2, skeleton.m3, lineColor, 3);
        drawLine(skeleton.m3, skeleton.m4, lineColor, 3);

        // 3. Toe Chains
        const toes = [skeleton.big, skeleton.index, skeleton.mid, skeleton.ring, skeleton.pinky];
        toes.forEach(toe => {
            drawLine(toe[0], toe[1], lineColor, 2);
            drawLine(toe[1], toe[2], lineColor, 2);
        });

        // Highlight lines for active state
        if (state.isPinching) {
            drawLine(skeleton.big[2], skeleton.index[2], '#00ffff', 4);
        }

        // White joints
        const jointColor = '#ffffff';
        drawJoint(skeleton.heel, 6, jointColor);
        drawJoint(skeleton.m1, 4, jointColor);
        drawJoint(skeleton.m2, 4, jointColor);
        drawJoint(skeleton.m3, 4, jointColor);
        drawJoint(skeleton.m4, 4, jointColor);

        toes.forEach((toe, idx) => {
            drawJoint(toe[1], 4, jointColor); // mid
            // Highlight Big Toe tip
            if (idx === 0) {
                drawJoint(toe[2], 8, '#00ffff'); // Big toe cursor
            } else {
                drawJoint(toe[2], 4, jointColor); // Other tips
            }
        });

        // Dynamic Glows
        if (window.appState.isDrawing) {
            const bt = getPt(skeleton.big[2]);
            this.ctx.beginPath();
            this.ctx.arc(bt.x, bt.y, 25, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
            this.ctx.fill();
        }

        if (state.isPinching) {
            const bt = getPt(skeleton.big[2]);
            const it = getPt(skeleton.index[2]);
            this.ctx.beginPath();
            this.ctx.arc((bt.x + it.x)/2, (bt.y + it.y)/2, 35, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
            this.ctx.fill();
        }
        
        if (state.isClosed) {
            const bt = getPt(skeleton.big[2]);
            this.ctx.beginPath();
            this.ctx.arc(bt.x, bt.y, 40, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            this.ctx.fill();
        }
    }
    
    // Get Image Data for saving
    getImageData() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw background image if any
        if (this.backgroundImage) {
            tempCtx.drawImage(this.backgroundImage, 0, 0, tempCanvas.width, tempCanvas.height);
        } else {
            tempCtx.fillStyle = '#000000';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
        
        // Draw content
        tempCtx.drawImage(this.canvas, 0, 0);
        return tempCanvas.toDataURL('image/png');
    }
    
    // Load Image Data (Background)
    loadImageData(dataUrl) {
        const img = new Image();
        img.onload = () => {
            this.backgroundImage = img;
            this.drawBackground();
        };
        img.src = dataUrl;
    }
    
    drawBackground() {
        this.bgCtx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
        
        // Calculate aspect ratio to fit image nicely
        const imgAspect = this.backgroundImage.width / this.backgroundImage.height;
        const canvasAspect = this.bgCanvas.width / this.bgCanvas.height;
        
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
        
        if (imgAspect > canvasAspect) {
            drawWidth = this.bgCanvas.width;
            drawHeight = drawWidth / imgAspect;
            offsetY = (this.bgCanvas.height - drawHeight) / 2;
        } else {
            drawHeight = this.bgCanvas.height;
            drawWidth = drawHeight * imgAspect;
            offsetX = (this.bgCanvas.width - drawWidth) / 2;
        }
        
        this.bgCtx.drawImage(this.backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
    }
}


// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    setupUI();
    
    const engine = new DrawingEngine();
    const presentation = new PresentationManager();
    
    // Start Hand Tracking
    const tracker = new HandTracker({
        onDraw: engine.onDraw.bind(engine),
        onErase: engine.onErase.bind(engine),
        onStop: engine.onStop.bind(engine),
        onClear: engine.onClear.bind(engine),
        onUndo: engine.undo.bind(engine),
        onChangeColor: engine.onChangeColor.bind(engine),
        onPointerMove: engine.onPointerMove.bind(engine),
        onUpdateSkeleton: engine.onUpdateSkeleton.bind(engine),
        onSwipeLeft: () => presentation.nextSlide(),
        onSwipeRight: () => presentation.prevSlide(),
        onPresentationExit: () => presentation.stopPresentation(),
        isPresentationActive: () => presentation.isActive
    });
});
