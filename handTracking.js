/**
 * handTracking.js
 * MediaPipe Hands integration for gesture recognition and drawing.
 * Includes approximation for Foot Mode using hand tracking.
 */

export class HandTracker {
    constructor(callbacks) {
        this.videoElement = document.getElementById('input-video');
        this.statusIndicator = document.getElementById('status-indicator');
        
        // Callbacks from app.js
        this.onDraw = callbacks.onDraw || (() => {});
        this.onErase = callbacks.onErase || (() => {});
        this.onStop = callbacks.onStop || (() => {});
        this.onClear = callbacks.onClear || (() => {});
        this.onChangeColor = callbacks.onChangeColor || (() => {});
        this.onUndo = callbacks.onUndo || (() => {});
        this.onPointerMove = callbacks.onPointerMove || (() => {});
        this.onSwipeLeft = callbacks.onSwipeLeft || (() => {});
        this.onSwipeRight = callbacks.onSwipeRight || (() => {});
        this.onPresentationExit = callbacks.onPresentationExit || (() => {});
        this.isPresentationActive = callbacks.isPresentationActive || (() => false);
        this.onUpdateSkeleton = callbacks.onUpdateSkeleton || (() => {});
        
        this.cooldowns = {
            clear: 0,
            color: 0,
            undo: 0,
            swipe: 0,
            exit: 0,
            pause: 0
        };

        this.history = [];
        
        this.init();
    }
    
    async init() {
        // Initialize Hands
        this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        
        this.hands.setOptions({
            maxNumHands: 2, // Enable two hands
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });
        
        this.hands.onResults(this.onHandsResults.bind(this));
        
        // Initialize Pose (for Foot mode)
        this.pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });
        
        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });
        
        this.pose.onResults(this.onPoseResults.bind(this));
        
        // Initialize camera with mobile optimization (prefer rear camera)
        const isMobile = window.innerWidth < 768;
        const cameraOptions = {
            onFrame: async () => {
                if (window.appState.mode === 'foot') {
                    await this.pose.send({image: this.videoElement});
                } else {
                    await this.hands.send({image: this.videoElement});
                }
            },
            width: 1280,
            height: 720
        };
        
        if (isMobile) {
            cameraOptions.facingMode = 'environment';
        }

        const camera = new Camera(this.videoElement, cameraOptions);
        
        camera.start().then(() => {
            this.statusIndicator.classList.add('hidden');
        }).catch(err => {
            console.error("Camera error:", err);
            this.statusIndicator.innerHTML = "Camera access denied or unavailable.";
        });
    }

    onHandsResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            let rightHand = null;
            let leftHand = null;

            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const hand = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i].label; // "Left" or "Right"
                
                // Because camera is front-facing, MediaPipe's "Left" is usually user's right hand.
                if (handedness === 'Left') {
                    rightHand = hand; // User's physical right hand
                } else {
                    leftHand = hand; // User's physical left hand
                }
            }

            // Fallback: Smooth switching if only one hand present
            if (results.multiHandLandmarks.length === 1) {
                const singleHand = results.multiHandLandmarks[0];
                
                if (this.isPresentationActive()) {
                    this.handlePresentationGestures(singleHand);
                }

                const isIndexUp = singleHand[8].y < singleHand[6].y;
                const isMiddleUp = singleHand[12].y < singleHand[10].y;
                const isRingUp = singleHand[16].y < singleHand[14].y;
                const isPinkyUp = singleHand[20].y < singleHand[18].y;
                const fingersUpCount = [isIndexUp, isMiddleUp, isRingUp, isPinkyUp].filter(Boolean).length;

                // If drawing gesture (only index), treat as drawing
                if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                    this.handleDrawingHand(singleHand);
                    this.onUpdateSkeleton(singleHand, 'hand', {});
                } else {
                    // Try control gestures
                    this.handleControlHand(singleHand);
                    this.handleDrawingHand(singleHand); // Will trigger onStop inside
                    this.onUpdateSkeleton(singleHand, 'hand', {});
                }
            } else {
                // Two Hands detected
                if (this.isPresentationActive()) {
                    this.handlePresentationGestures(rightHand || leftHand);
                }

                if (leftHand) {
                    this.handleControlHand(leftHand);
                }

                if (rightHand) {
                    this.handleDrawingHand(rightHand);
                    this.onUpdateSkeleton(rightHand, 'hand', {});
                } else {
                    this.onStop();
                    this.onUpdateSkeleton(null, 'hand', {});
                }
            }
        } else {
            // No hand detected
            this.onStop();
            this.history = [];
            this.onUpdateSkeleton(null, 'none', {});
        }
    }

    handlePresentationGestures(hand) {
        const wrist = hand[0];
        
        // Open palm check
        const isIndexUp = hand[8].y < hand[6].y;
        const isMiddleUp = hand[12].y < hand[10].y;
        const isRingUp = hand[16].y < hand[14].y;
        const isPinkyUp = hand[20].y < hand[18].y;
        const fingersUpCount = [isIndexUp, isMiddleUp, isRingUp, isPinkyUp].filter(Boolean).length;

        const now = Date.now();

        // 1. Open palm to exit
        if (fingersUpCount >= 4) {
            if (now - this.cooldowns.exit > 2000) {
                this.onPresentationExit();
                this.cooldowns.exit = now;
            }
            return;
        }

        // Do not swipe if doing a drawing gesture
        const useWrist = window.appState.mode === 'foot';
        const isDrawingGesture = useWrist ? (fingersUpCount <= 1) : (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp);
        if (isDrawingGesture) {
            this.history = []; // Clear history to prevent jump swipes
            return;
        }

        // SWIPE DETECTION LOGIC
        this.history.push({ x: wrist.x, time: now });
        if (this.history.length > 15) {
            this.history.shift(); // Keep last 15 frames
        }

        if (this.history.length >= 10 && now - this.cooldowns.swipe > 1500) {
            const first = this.history[0];
            const last = this.history[this.history.length - 1];
            const deltaX = last.x - first.x;
            const timeDelta = last.time - first.time;
            
            // X is normalized [0, 1]. A delta of 0.10 is significant movement.
            // threshold: minimum distance 0.10, time span > 0 and < 600ms
            if (Math.abs(deltaX) > 0.10 && timeDelta > 0 && timeDelta < 600) {
                const speed = Math.abs(deltaX) / timeDelta;
                if (speed > 0.0002) { // Minimum speed to ignore slow jitter
                    if (deltaX > 0) { // Swiped right
                        if (window.appState.mirror) this.onSwipeLeft();
                        else this.onSwipeRight();
                    } else { // Swiped left
                        if (window.appState.mirror) this.onSwipeRight();
                        else this.onSwipeLeft();
                    }
                    this.cooldowns.swipe = now;
                    this.history = []; // reset after a successful swipe
                }
            }
        }
    }

    handleControlHand(hand) {
        const isIndexUp = hand[8].y < hand[6].y;
        const isMiddleUp = hand[12].y < hand[10].y;
        const isRingUp = hand[16].y < hand[14].y;
        const isPinkyUp = hand[20].y < hand[18].y;

        const fingersUpCount = [isIndexUp, isMiddleUp, isRingUp, isPinkyUp].filter(Boolean).length;
        const now = Date.now();

        // Left Hand Gestures:
        // Open palm -> Clear (Only if eraseMode is off)
        // Two fingers -> Change color
        // Fist -> Undo (if needed, but usually we don't want accidental undo)

        if (fingersUpCount >= 4) {
            if (!window.appState.eraseMode && now - this.cooldowns.clear > 2000) {
                this.onClear();
                this.cooldowns.clear = now;
            }
        } else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
            if (now - this.cooldowns.color > 1000) {
                this.onChangeColor();
                this.cooldowns.color = now;
            }
        }
    }

    handleDrawingHand(hand) {
        const targetPoint = hand[8]; // Use index tip for hand
        
        const isIndexUp = hand[8].y < hand[6].y;
        const isMiddleUp = hand[12].y < hand[10].y;
        const isRingUp = hand[16].y < hand[14].y;
        const isPinkyUp = hand[20].y < hand[18].y;

        const fingersUpCount = [isIndexUp, isMiddleUp, isRingUp, isPinkyUp].filter(Boolean).length;

        const canvasWidth = window.innerWidth;
        const canvasHeight = window.innerHeight;

        // Exact Drawing Direction (NO Mirror Inversion)
        // Mediapipe is mirrored because it's a front-facing camera.
        // To make it follow real-world motion, we do NOT flip it back unless mirror mode is explicitly ON.
        // If mirror mode is ON, we flip it so it acts like a mirror. If OFF, we flip it so it maps directly.
        // Actually, user wants NO mirror inversion. So hand moves right -> cursor moves right.
        // In a front-facing camera, moving hand to your right makes it go to the left of the image (x decreases).
        // Therefore, to make cursor move right when hand moves right, we MUST use (1 - x).
        const mirrorX = window.appState.mirror ? targetPoint.x : (1 - targetPoint.x);
        const screenX = mirrorX * canvasWidth;
        const screenY = targetPoint.y * canvasHeight;

        this.onPointerMove(screenX, screenY);

        if (window.appState.eraseMode) {
            if (fingersUpCount === 0) {
                // Fist -> Erase
                this.onErase(screenX, screenY);
                return;
            }
        } else {
            // Hand Mode: One Finger (Draw) -> Only Index up
            if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                this.onDraw(screenX, screenY);
                return;
            }
        }

        // Default: Stop
        this.onStop();
    }
    
    // Pose handler for Leg/Foot mode
    onPoseResults(results) {
        if (results.poseLandmarks && window.appState.mode === 'foot') {
            const isRight = results.poseLandmarks[32].visibility > results.poseLandmarks[31].visibility;
            const heel = isRight ? results.poseLandmarks[30] : results.poseLandmarks[29];
            const footIndex = isRight ? results.poseLandmarks[32] : results.poseLandmarks[31];
            const ankle = isRight ? results.poseLandmarks[28] : results.poseLandmarks[27];
            
            if (heel.visibility > 0.5 && footIndex.visibility > 0.5) {
                this.handleVirtualFootGestures(heel, footIndex, ankle, isRight);
            } else {
                this.onStop();
                this.onUpdateSkeleton(null, 'none', {});
            }
        } else {
            this.onStop();
            this.onUpdateSkeleton(null, 'none', {});
        }
    }

    handleVirtualFootGestures(heel, footIndex, ankle, isRight) {
        const canvasWidth = window.innerWidth;
        const canvasHeight = window.innerHeight;

        // Generate the virtual skeletal points based on Heel and Foot Index
        const dx = footIndex.x - heel.x;
        const dy = footIndex.y - heel.y;
        const dist2D = Math.sqrt(dx*dx + dy*dy);
        const u_f = { x: dx/dist2D, y: dy/dist2D }; // Forward vector

        // Perpendicular vector for width spread
        let u_s = isRight ? { x: -u_f.y, y: u_f.x } : { x: u_f.y, y: -u_f.x };

        // Dynamic base width
        let W = dist2D * 0.4;
        
        // Simulate pinching and compression based on 3D depth changes (ankle/heel twist)
        const dz = footIndex.z - heel.z;
        const compressFactor = Math.max(0, Math.min(1, Math.abs(dz) * 3)); // Shrinks spread if foot points to/away from camera
        const ankleTwist = ((ankle.x - heel.x) * u_s.x + (ankle.y - heel.y) * u_s.y) / dist2D;
        const pinchFactor = Math.max(0, Math.min(1, Math.abs(ankleTwist) * 2.5));

        const midY = 0.55; 
        const m_base = { x: heel.x + u_f.x * dist2D * midY, y: heel.y + u_f.y * dist2D * midY };
        
        // Mid-foot joints (M1=pinky side, M4=big toe side)
        const m4 = { x: m_base.x - u_s.x * W * 0.1, y: m_base.y - u_s.y * W * 0.1 };
        const m3 = { x: m_base.x + u_s.x * W * 0.2, y: m_base.y + u_s.y * W * 0.2 };
        const m2 = { x: m_base.x + u_s.x * W * 0.5, y: m_base.y + u_s.y * W * 0.5 };
        const m1 = { x: m_base.x + u_s.x * W * 0.8, y: m_base.y + u_s.y * W * 0.8 };

        // Big Toe (Tip is exact footIndex)
        const bigTip = footIndex;
        const bigMid = { x: heel.x + u_f.x * dist2D * 0.8, y: heel.y + u_f.y * dist2D * 0.8 };

        // Index Toe
        const idxSpread = W * 0.2 * (1 - pinchFactor * 0.9) * (1 - compressFactor * 0.5);
        const idxTipDist = dist2D * 0.95;
        const indexMid = { x: m4.x + u_f.x * dist2D * 0.2 + u_s.x * idxSpread, y: m4.y + u_f.y * dist2D * 0.2 + u_s.y * idxSpread };
        const indexTip = { x: heel.x + u_f.x * idxTipDist + u_s.x * idxSpread, y: heel.y + u_f.y * idxTipDist + u_s.y * idxSpread };

        // Middle Toe
        const midSpread = W * 0.45 * (1 - compressFactor * 0.7);
        const midTipDist = dist2D * 0.9;
        const midMid = { x: m3.x + u_f.x * dist2D * 0.15 + u_s.x * midSpread, y: m3.y + u_f.y * dist2D * 0.15 + u_s.y * midSpread };
        const midTip = { x: heel.x + u_f.x * midTipDist + u_s.x * midSpread, y: heel.y + u_f.y * midTipDist + u_s.y * midSpread };

        // Ring Toe
        const ringSpread = W * 0.7 * (1 - compressFactor * 0.8);
        const ringTipDist = dist2D * 0.85;
        const ringMid = { x: m2.x + u_f.x * dist2D * 0.12 + u_s.x * ringSpread, y: m2.y + u_f.y * dist2D * 0.12 + u_s.y * ringSpread };
        const ringTip = { x: heel.x + u_f.x * ringTipDist + u_s.x * ringSpread, y: heel.y + u_f.y * ringTipDist + u_s.y * ringSpread };

        // Pinky Toe
        const pinkySpread = W * 0.95 * (1 - compressFactor * 0.9);
        const pinkyTipDist = dist2D * 0.8;
        const pinkyMid = { x: m1.x + u_f.x * dist2D * 0.1 + u_s.x * pinkySpread, y: m1.y + u_f.y * dist2D * 0.1 + u_s.y * pinkySpread };
        const pinkyTip = { x: heel.x + u_f.x * pinkyTipDist + u_s.x * pinkySpread, y: heel.y + u_f.y * pinkyTipDist + u_s.y * pinkySpread };

        const skeleton = {
            heel: heel,
            m1: m1, m2: m2, m3: m3, m4: m4,
            big: [m4, bigMid, bigTip],
            index: [m4, indexMid, indexTip],
            mid: [m3, midMid, midTip],
            ring: [m2, ringMid, ringTip],
            pinky: [m1, pinkyMid, pinkyTip]
        };

        // Primary Logic: Big Toe Drawing Cursor (Top-most point)
        const mirrorX = window.appState.mirror ? (1 - bigTip.x) : bigTip.x;
        const screenX = mirrorX * canvasWidth;
        const screenY = bigTip.y * canvasHeight;

        this.onPointerMove(screenX, screenY);

        // Distances for Interactions
        const pinchDistance = Math.sqrt(Math.pow(bigTip.x - indexTip.x, 2) + Math.pow(bigTip.y - indexTip.y, 2));
        const compressDistance = Math.sqrt(Math.pow(bigTip.x - pinkyTip.x, 2) + Math.pow(bigTip.y - pinkyTip.y, 2));

        let state = { isPinching: false, isClosed: false };
        const now = Date.now();

        // Erase Mode (Full Toe Compression)
        // If the spread between big toe and pinky is very small
        if (compressDistance < W * 0.3) {
            state.isClosed = true;
            this.onErase(screenX, screenY);
        }
        // Color Change (Dual Toe Interaction)
        else if (pinchDistance < W * 0.15) {
            state.isPinching = true;
            this.onStop();
            if (now - this.cooldowns.color > 700) {
                this.onChangeColor();
                this.cooldowns.color = now;
            }
        } 
        else {
            // Drawing: Big toe extended and stable
            // Stability check
            if (!this.lastFootPos) this.lastFootPos = {x: screenX, y: screenY};
            const movement = Math.sqrt(Math.pow(screenX - this.lastFootPos.x, 2) + Math.pow(screenY - this.lastFootPos.y, 2));
            this.lastFootPos = {x: screenX, y: screenY};

            if (dist2D > 0.1 && movement < 50) {
                this.onDraw(screenX, screenY);
            } else {
                this.onStop();
            }
        }

        this.onUpdateSkeleton(skeleton, 'virtual_foot', state);
    }
}
