// js/scanner.js

let cvLoaded = false;
let cvInitPromise = null;

let sourceImg = null;
let canvas, ctx;
let corners = [];
let draggingPoint = -1;
let currentFilter = 'original';
let currentRotation = 0; // 0, 90, 180, 270
let scanScale = 1;
let imgOffset = {x: 0, y: 0};

// Load OpenCV dynamically
function loadOpenCV() {
    if (cvLoaded) return Promise.resolve();
    if (cvInitPromise) return cvInitPromise;
    
    cvInitPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
        script.async = true;
        script.onload = () => {
            cv['onRuntimeInitialized'] = () => {
                cvLoaded = true;
                resolve();
            };
            // Fallback check
            const check = setInterval(() => {
                if (typeof cv !== 'undefined' && cv.Mat) {
                    clearInterval(check);
                    cvLoaded = true;
                    resolve();
                }
            }, 200);
        };
        script.onerror = () => reject(new Error('Gagal memuat OpenCV'));
        document.body.appendChild(script);
    });
    return cvInitPromise;
}

async function initScanner(file) {
    Modal.close('modalUpload');
    document.getElementById('modalScanner').classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('scannerLoading').style.display = 'flex';
    
    currentFilter = 'original';
    currentRotation = 0;
    document.querySelectorAll('#modalScanner .btn-sm').forEach(b => b.classList.remove('active'));
    document.getElementById('btnFilterOrg').classList.add('active');
    
    try {
        await loadOpenCV();
        
        const img = new Image();
        img.onload = () => {
            sourceImg = img;
            initEditor();
            document.getElementById('scannerLoading').style.display = 'none';
        };
        img.src = URL.createObjectURL(file);
    } catch(e) {
        alert(e.message);
        cancelScan();
    }
}

function cancelScan() {
    document.getElementById('modalScanner').classList.remove('active');
    document.body.style.overflow = '';
    if (selectedFile) {
        Modal.open('modalUpload');
    } else {
        clearFile(); // clear the selected file only if we didn't have one before
    }
}

function initEditor() {
    canvas = document.getElementById('scannerCanvas');
    ctx = canvas.getContext('2d');
    
    const wrapper = document.getElementById('canvasWrapper');
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    
    canvas.width = w;
    canvas.height = h;
    
    // Calculate scale to fit image in canvas
    let imgW = sourceImg.width;
    let imgH = sourceImg.height;
    
    if (currentRotation % 180 !== 0) {
        imgW = sourceImg.height;
        imgH = sourceImg.width;
    }
    
    scanScale = Math.min(w / imgW, h / imgH) * 0.9;
    imgOffset.x = (w - imgW * scanScale) / 2;
    imgOffset.y = (h - imgH * scanScale) / 2;
    
    // Default corners (full image inset by 10%)
    const insetW = imgW * scanScale * 0.1;
    const insetH = imgH * scanScale * 0.1;
    
    let defaultCorners = [
        {x: imgOffset.x + insetW, y: imgOffset.y + insetH}, // TL
        {x: imgOffset.x + imgW * scanScale - insetW, y: imgOffset.y + insetH}, // TR
        {x: imgOffset.x + imgW * scanScale - insetW, y: imgOffset.y + imgH * scanScale - insetH}, // BR
        {x: imgOffset.x + insetW, y: imgOffset.y + imgH * scanScale - insetH}  // BL
    ];
    
    // Attempt Auto Edge Detection
    try {
        let src = cv.imread(sourceImg);
        if (currentRotation === 90) cv.rotate(src, src, cv.ROTATE_90_CLOCKWISE);
        else if (currentRotation === 180) cv.rotate(src, src, cv.ROTATE_180);
        else if (currentRotation === 270) cv.rotate(src, src, cv.ROTATE_90_COUNTERCLOCKWISE);
        
        let detected = detectDocumentCorners(src);
        src.delete();

        if (detected) {
            corners = detected.map(p => ({
                x: imgOffset.x + (p.x * scanScale),
                y: imgOffset.y + (p.y * scanScale)
            }));
        } else {
            corners = defaultCorners;
        }
    } catch(err) {
        console.error("Auto detect failed", err);
        corners = defaultCorners;
    }
    
    setupEvents();
    drawEditor();
}

function setupEvents() {
    canvas.onmousedown = handleDown;
    canvas.onmousemove = handleMove;
    canvas.onmouseup = handleUp;
    canvas.onmouseleave = handleUp;
    
    canvas.ontouchstart = (e) => { e.preventDefault(); handleDown(e.touches[0]); };
    canvas.ontouchmove = (e) => { e.preventDefault(); handleMove(e.touches[0]); };
    canvas.ontouchend = (e) => { e.preventDefault(); handleUp(e); };
}

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function handleDown(e) {
    const pos = getPointerPos(e);
    // Find closest corner within 40px radius
    let minDist = 40;
    draggingPoint = -1;
    corners.forEach((p, i) => {
        const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (dist < minDist) {
            minDist = dist;
            draggingPoint = i;
        }
    });
}

function handleMove(e) {
    if (draggingPoint === -1) return;
    const pos = getPointerPos(e);
    corners[draggingPoint].x = pos.x;
    corners[draggingPoint].y = pos.y;
    drawEditor();
}

function handleUp() {
    draggingPoint = -1;
}

function rotateImage() {
    currentRotation = (currentRotation + 90) % 360;
    initEditor();
}

function drawEditor() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw rotated image
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.rotate(currentRotation * Math.PI / 180);
    const renderW = sourceImg.width * scanScale;
    const renderH = sourceImg.height * scanScale;
    ctx.drawImage(sourceImg, -renderW/2, -renderH/2, renderW, renderH);
    ctx.restore();
    
    // Draw dark overlay
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.rect(0,0,canvas.width, canvas.height);
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.fill("evenodd");
    
    // Draw border
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.stroke();
    
    // Draw corners
    ctx.fillStyle = "#fff";
    corners.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
    });
}

function setFilter(type) {
    currentFilter = type;
    document.querySelectorAll('#modalScanner .btn-sm').forEach(b => b.classList.remove('active'));
    if(type === 'original') document.getElementById('btnFilterOrg').classList.add('active');
    if(type === 'magic') document.getElementById('btnFilterMag').classList.add('active');
    if(type === 'grayscale') document.getElementById('btnFilterGray').classList.add('active');
    
    if (canvas) {
        if(type === 'original') canvas.style.filter = 'none';
        if(type === 'magic') canvas.style.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
        if(type === 'grayscale') canvas.style.filter = 'grayscale(100%)';
    }
}

async function applyScan() {
    document.getElementById('scannerLoadingText').textContent = 'Memproses Gambar...';
    document.getElementById('scannerLoading').style.display = 'flex';
    
    // Allow UI to update
    await new Promise(r => setTimeout(r, 50));
    
    try {
        const resultCanvas = document.createElement('canvas');
        processOpenCV(resultCanvas);
        
        // Export to WebP
        const webpDataUrl = resultCanvas.toDataURL('image/webp', 0.85);
        
        // Convert data URL back to File object to mimic standard upload
        const res = await fetch(webpDataUrl);
        const blob = await res.blob();
        
        const file = new File([blob], "SCAN_" + Date.now() + ".webp", { type: "image/webp" });
        
        // Hide scanner and show upload info
        document.getElementById('modalScanner').classList.remove('active');
        document.body.style.overflow = '';
        
        // Re-inject to modal upload
        Modal.open('modalUpload');
        selectedFile = file;
        document.getElementById('fileInfo').style.display = '';
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = Utils.formatFileSize(file.size);
        document.getElementById('btnUpload').disabled = false;
        
        const thumb = document.getElementById('filePreviewThumb');
        thumb.src = webpDataUrl;
        thumb.style.display = 'block';
        document.getElementById('fileIconFallback').style.display = 'none';
        
        // Auto-upload if in wizard mode to prevent stopping at the next step and losing the file
        if (typeof Wizard !== 'undefined' && Wizard.isActive) {
            if (typeof doUpload === 'function') doUpload();
        }
        
    } catch (e) {
        alert("Gagal memproses gambar: " + e.message);
    } finally {
        document.getElementById('scannerLoading').style.display = 'none';
    }
}

function processOpenCV(outCanvas) {
    // 1. Create source Mat
    let src = cv.imread(sourceImg);
    
    // 2. Rotate if needed
    if (currentRotation === 90) cv.rotate(src, src, cv.ROTATE_90_CLOCKWISE);
    else if (currentRotation === 180) cv.rotate(src, src, cv.ROTATE_180);
    else if (currentRotation === 270) cv.rotate(src, src, cv.ROTATE_90_COUNTERCLOCKWISE);
    
    // 3. Map corners back to original image coordinates
    const scale = scanScale;
    let imgW = src.cols;
    let imgH = src.rows;
    
    let pts = corners.map(p => ({
        x: (p.x - imgOffset.x) / scale,
        y: (p.y - imgOffset.y) / scale
    }));
    
    // Clamp points to image boundaries
    pts = pts.map(p => ({
        x: Math.max(0, Math.min(imgW, p.x)),
        y: Math.max(0, Math.min(imgH, p.y))
    }));
    
    // 4. Calculate output dimensions based on crop width/height
    const w1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const w2 = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
    const outW = Math.max(w1, w2);
    
    const h1 = Math.hypot(pts[1].x - pts[2].x, pts[1].y - pts[2].y);
    const h2 = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
    const outH = Math.max(h1, h2);
    
    // Max constraint to avoid blowing up memory (A4 size approx 1200x1700)
    let finalW = outW;
    let finalH = outH;
    const maxDim = 1500;
    if (finalW > maxDim || finalH > maxDim) {
        const ratio = Math.min(maxDim/finalW, maxDim/finalH);
        finalW *= ratio;
        finalH *= ratio;
    }
    
    // 5. Perspective Warp
    let dst = new cv.Mat();
    let dsize = new cv.Size(finalW, finalH);
    
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        pts[0].x, pts[0].y,
        pts[1].x, pts[1].y,
        pts[2].x, pts[2].y,
        pts[3].x, pts[3].y
    ]);
    
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        finalW, 0,
        finalW, finalH,
        0, finalH
    ]);
    
    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    
    // 6. Apply Filters
    if (currentFilter === 'grayscale' || currentFilter === 'magic') {
        cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
        if (currentFilter === 'magic') {
            // Adaptive threshold for crisp text
            cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);
        }
    }
    
    cv.imshow(outCanvas, dst);
    
    // Cleanup
    src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
}

function detectDocumentCorners(src) {
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    
    let blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    
    let edged = new cv.Mat();
    cv.Canny(blurred, edged, 75, 200);

    // Morphological closing to help connect broken edges of the document
    let kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.dilate(edged, edged, kernel, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    cv.erode(edged, edged, kernel, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    kernel.delete();

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let bestPoly = null;
    const minArea = (src.cols * src.rows) * 0.1; // at least 10% of image

    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > minArea) {
            let peri = cv.arcLength(cnt, true);
            let poly = new cv.Mat();
            cv.approxPolyDP(cnt, poly, 0.02 * peri, true);
            
            if (poly.rows === 4 && area > maxArea) {
                maxArea = area;
                if (bestPoly) bestPoly.delete();
                bestPoly = poly.clone();
            }
            poly.delete();
        }
    }

    gray.delete(); blurred.delete(); edged.delete(); contours.delete(); hierarchy.delete();

    if (bestPoly) {
        let pts = [];
        for (let i = 0; i < 4; i++) {
            pts.push({
                x: bestPoly.data32S[i*2],
                y: bestPoly.data32S[i*2 + 1]
            });
        }
        bestPoly.delete();
        return orderPoints(pts);
    }
    return null;
}

function orderPoints(pts) {
    // Sort by x
    pts.sort((a,b) => a.x - b.x);
    // Leftmost two are TL and BL
    let left = pts.slice(0, 2).sort((a,b) => a.y - b.y);
    let right = pts.slice(2, 4).sort((a,b) => a.y - b.y);
    // [TL, TR, BR, BL]
    return [left[0], right[0], right[1], left[1]];
}
