/**
 * presentation.js
 * Handles file uploads (PDF, images) and rendering them as a presentation.
 */

import { updateModeIndicator } from './ui.js';

export class PresentationManager {
    constructor() {
        this.container = document.getElementById('presentation-container');
        this.fileInput = document.getElementById('file-upload');
        this.pages = []; // Can be image URLs or PDF pages
        this.currentPageIndex = 0;
        this.isActive = false;

        this.init();
    }

    init() {
        if (!this.fileInput) return;
        
        this.fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            this.pages = [];
            this.currentPageIndex = 0;
            
            if (file.type === 'application/pdf') {
                await this.loadPDF(file);
            } else if (file.type.startsWith('image/')) {
                await this.loadImage(file);
            }
            
            if (this.pages.length > 0) {
                this.startPresentation();
            }
        });
    }

    async loadPDF(file) {
        const fileReader = new FileReader();
        return new Promise((resolve, reject) => {
            fileReader.onload = async function() {
                const typedarray = new Uint8Array(this.result);
                const loadingTask = pdfjsLib.getDocument(typedarray);
                
                try {
                    const pdf = await loadingTask.promise;
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        this.pages.push({ type: 'pdf', page });
                    }
                    resolve();
                } catch(err) {
                    console.error('Error loading PDF:', err);
                    reject(err);
                }
            }.bind(this);
            fileReader.readAsArrayBuffer(file);
        });
    }

    async loadImage(file) {
        return new Promise((resolve) => {
            const fileReader = new FileReader();
            fileReader.onload = (e) => {
                this.pages.push({ type: 'image', src: e.target.result });
                resolve();
            };
            fileReader.readAsDataURL(file);
        });
    }

    startPresentation() {
        this.isActive = true;
        this.initializedDOM = false;
        if (window.appState) {
            window.appState.presentationMode = true;
            updateModeIndicator();
        }
        this.container.classList.add('active');
        const ui = document.getElementById('presentation-ui');
        if (ui) ui.classList.remove('hidden');
        this.renderCurrentPage();
        
        if (window.appState && window.appState.a11yVoice && 'speechSynthesis' in window) {
            window.speechSynthesis.speak(new SpeechSynthesisUtterance("Presentation started. Swipe left and right to navigate."));
        }
    }

    stopPresentation() {
        this.isActive = false;
        if (window.appState) {
            window.appState.presentationMode = false;
            updateModeIndicator();
        }
        this.container.classList.remove('active');
        this.container.innerHTML = '';
        this.initializedDOM = false;
        const ui = document.getElementById('presentation-ui');
        if (ui) ui.classList.add('hidden');
        this.pages = [];
        this.fileInput.value = '';
        
        if (window.appState && window.appState.a11yVoice && 'speechSynthesis' in window) {
            window.speechSynthesis.speak(new SpeechSynthesisUtterance("Presentation ended."));
        }
    }

    async renderCurrentPage() {
        if (this.pages.length === 0) return;
        
        const counter = document.getElementById('slide-counter');
        if (counter) counter.textContent = `${this.currentPageIndex + 1} / ${this.pages.length}`;
        
        if (!this.initializedDOM) {
            this.container.innerHTML = '';
            this.domPages = [];
            for (let i = 0; i < this.pages.length; i++) {
                const pageObj = this.pages[i];
                let elem;
                if (pageObj.type === 'image') {
                    elem = document.createElement('img');
                    elem.src = pageObj.src;
                } else if (pageObj.type === 'pdf') {
                    elem = document.createElement('canvas');
                    const viewport = pageObj.page.getViewport({ scale: 1.5 });
                    elem.height = viewport.height;
                    elem.width = viewport.width;
                    elem.dataset.rendered = "false";
                }
                elem.style.position = 'absolute';
                elem.style.opacity = '0';
                elem.style.transition = 'opacity 0.3s ease-in-out';
                elem.style.maxWidth = '100%';
                elem.style.maxHeight = '100%';
                elem.style.objectFit = 'contain';
                
                this.container.appendChild(elem);
                this.domPages.push(elem);
            }
            this.initializedDOM = true;
        }
        
        // Preload logic: render current, prev, next
        const indicesToRender = [
            this.currentPageIndex - 1, 
            this.currentPageIndex, 
            this.currentPageIndex + 1
        ];
        
        for (let idx of indicesToRender) {
            if (idx >= 0 && idx < this.pages.length) {
                const pageObj = this.pages[idx];
                const elem = this.domPages[idx];
                if (pageObj.type === 'pdf' && elem.dataset.rendered === "false") {
                    elem.dataset.rendered = "true";
                    const context = elem.getContext('2d');
                    const viewport = pageObj.page.getViewport({ scale: 1.5 });
                    pageObj.page.render({ canvasContext: context, viewport: viewport });
                }
            }
        }
        
        this.domPages.forEach((elem, idx) => {
            if (idx === this.currentPageIndex) {
                elem.style.opacity = '1';
                elem.style.zIndex = '2';
            } else {
                elem.style.opacity = '0';
                elem.style.zIndex = '1';
            }
        });
    }

    showSwipeFeedback(direction) {
        const arrowId = direction === 'left' ? 'swipe-feedback-left' : 'swipe-feedback-right';
        const glowId = direction === 'left' ? 'glow-left' : 'glow-right';
        
        const arrow = document.getElementById(arrowId);
        const glow = document.getElementById(glowId);
        
        if (arrow) {
            arrow.classList.add('active');
            setTimeout(() => arrow.classList.remove('active'), 500);
        }
        if (glow) {
            glow.classList.add('active');
            setTimeout(() => glow.classList.remove('active'), 500);
        }
    }

    nextSlide() {
        if (!this.isActive) return;
        this.showSwipeFeedback('right');
        if (this.currentPageIndex < this.pages.length - 1) {
            this.currentPageIndex++;
            this.renderCurrentPage();
        }
    }

    prevSlide() {
        if (!this.isActive) return;
        this.showSwipeFeedback('left');
        if (this.currentPageIndex > 0) {
            this.currentPageIndex--;
            this.renderCurrentPage();
        }
    }
}
