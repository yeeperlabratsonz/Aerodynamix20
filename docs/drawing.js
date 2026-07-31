(function () {
    'use strict';

    const canvas = document.getElementById('drawing-canvas');
    const context = canvas.getContext('2d');
    const colorInput = document.getElementById('brush-color');
    const sizeInput = document.getElementById('brush-size');
    const sizeValue = document.getElementById('brush-size-value');
    const imageInput = document.getElementById('image-input');
    const brushTool = document.getElementById('brush-tool');
    const eraserTool = document.getElementById('eraser-tool');
    const undoButton = document.getElementById('undo-button');
    const redoButton = document.getElementById('redo-button');
    const clearButton = document.getElementById('clear-button');
    const blankButton = document.getElementById('blank-button');
    const downloadButton = document.getElementById('download-button');

    let drawing = false;
    let lastPoint = null;
    let erasing = false;
    let undoStack = [];
    let redoStack = [];
    const maxHistory = 30;
    const defaultCanvasSize = { width: 1200, height: 700 };

    function fillBlank() {
        context.save();
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.restore();
    }

    function resizeCanvas(width, height) {
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
    }

    function snapshot() {
        return {
            width: canvas.width,
            height: canvas.height,
            imageData: context.getImageData(0, 0, canvas.width, canvas.height)
        };
    }

    function restore(state) {
        if (canvas.width !== state.width || canvas.height !== state.height) {
            resizeCanvas(state.width, state.height);
        }
        context.putImageData(state.imageData, 0, 0);
    }

    function updateHistoryButtons() {
        undoButton.disabled = undoStack.length === 0;
        redoButton.disabled = redoStack.length === 0;
    }

    function saveHistory() {
        undoStack.push(snapshot());
        if (undoStack.length > maxHistory) undoStack.shift();
        redoStack = [];
        updateHistoryButtons();
    }

    function setTool(nextErasing) {
        erasing = nextErasing;
        brushTool.classList.toggle('active', !erasing);
        eraserTool.classList.toggle('active', erasing);
        canvas.style.cursor = erasing ? 'cell' : 'crosshair';
    }

    function pointFromEvent(event) {
        const bounds = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
            y: (event.clientY - bounds.top) * (canvas.height / bounds.height)
        };
    }

    function drawLine(from, to) {
        context.save();
        context.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
        context.strokeStyle = erasing ? 'rgba(0,0,0,1)' : colorInput.value;
        context.lineWidth = Number(sizeInput.value);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        context.restore();
    }

    function startDrawing(event) {
        event.preventDefault();
        saveHistory();
        drawing = true;
        lastPoint = pointFromEvent(event);
        canvas.setPointerCapture?.(event.pointerId);
        drawLine(lastPoint, { x: lastPoint.x + .01, y: lastPoint.y + .01 });
    }

    function continueDrawing(event) {
        if (!drawing) return;
        event.preventDefault();
        const point = pointFromEvent(event);
        drawLine(lastPoint, point);
        lastPoint = point;
    }

    function stopDrawing(event) {
        if (!drawing) return;
        drawing = false;
        lastPoint = null;
        if (event && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }

    function resetToBlank() {
        saveHistory();
        resizeCanvas(defaultCanvasSize.width, defaultCanvasSize.height);
        fillBlank();
    }

    function undo() {
        if (!undoStack.length) return;
        redoStack.push(snapshot());
        restore(undoStack.pop());
        updateHistoryButtons();
    }

    function redo() {
        if (!redoStack.length) return;
        undoStack.push(snapshot());
        restore(redoStack.pop());
        updateHistoryButtons();
    }

    function clearCanvas() {
        if (!window.confirm('Clear the canvas? This can be undone.')) return;
        saveHistory();
        fillBlank();
    }

    function loadImage(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                saveHistory();
                resizeCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
        imageInput.value = '';
    }

    function download() {
        const link = document.createElement('a');
        link.download = `aerodynamix-drawing-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', continueDrawing);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    canvas.addEventListener('pointerleave', stopDrawing);
    brushTool.addEventListener('click', () => setTool(false));
    eraserTool.addEventListener('click', () => setTool(true));
    sizeInput.addEventListener('input', () => { sizeValue.textContent = `${sizeInput.value}px`; });
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    clearButton.addEventListener('click', clearCanvas);
    blankButton.addEventListener('click', resetToBlank);
    downloadButton.addEventListener('click', download);
    imageInput.addEventListener('change', () => loadImage(imageInput.files[0]));
    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            event.shiftKey ? redo() : undo();
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            redo();
        }
    });

    fillBlank();
    updateHistoryButtons();
})();