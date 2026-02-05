// State
let timeLeft = 0;
let totalTime = 0;
let timerInterval = null;
let isCooking = false;

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function beep(freq = 800, duration = 0.1, type = 'square') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
}

// --- Microwave Logic ---

function addTime(seconds) {
    if (isCooking) return;
    timeLeft += seconds;
    totalTime = timeLeft;
    updateDisplay();
    beep(600, 0.05);
}

function updateDisplay() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('display').innerText = `${m}:${s}`;
}

function startCooking() {
    if (isCooking || timeLeft <= 0) return;

    isCooking = true;
    document.getElementById('config-overlay').classList.add('hidden');
    document.getElementById('mw-window').classList.add('lit');
    document.getElementById('plate-icon').innerText = getIconForRecipe();
    document.getElementById('plate-icon').classList.add('spinning');
    document.getElementById('progress-bar').style.display = 'block';
    document.getElementById('status-text').innerText = "COMPILING...";

    beep(1000, 0.2);

    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();
        const pct = ((totalTime - timeLeft) / totalTime) * 100;
        document.getElementById('progress-fill').style.width = `${pct}%`;

        if (timeLeft <= 0) finishCooking();
    }, 1000);
}

function finishCooking() {
    clearInterval(timerInterval);
    isCooking = false;
    document.getElementById('mw-window').classList.remove('lit');
    document.getElementById('plate-icon').classList.remove('spinning');
    document.getElementById('progress-bar').style.display = 'none';
    document.getElementById('done-overlay').classList.remove('hidden');
    document.getElementById('display').innerText = "DONE";
    document.getElementById('status-text').innerText = "READY";
    beep(600, 0.5); setTimeout(() => beep(800, 0.5), 400);
}

function resetMicrowave() {
    clearInterval(timerInterval);
    isCooking = false;
    timeLeft = 0; totalTime = 0;
    document.getElementById('config-overlay').classList.remove('hidden');
    document.getElementById('done-overlay').classList.add('hidden');
    document.getElementById('mw-window').classList.remove('lit');
    document.getElementById('plate-icon').classList.remove('spinning');
    document.getElementById('progress-bar').style.display = 'none';
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('display').innerText = "00:00";
    document.getElementById('status-text').innerText = "READY";
}

function getIconForRecipe() {
    const r = document.getElementById('cfg-recipe').value;
    if(r === 'todo') return '📝';
    if(r === 'feed') return '📰';
    return 'ℹ️';
}

// --- APP GENERATOR ENGINE ---

function getConfig() {
    return {
        name: document.getElementById('cfg-name').value,
        recipe: document.getElementById('cfg-recipe').value,
        color: document.getElementById('cfg-color').value,
        data: document.getElementById('cfg-data').value,
        storage: document.getElementById('feat-storage').checked,
        pwa: document.getElementById('feat-pwa').checked
    };
}

function generateAppHTML(cfg) {
    const bodyContent = getBodyContent(cfg);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${cfg.name}</title>
    ${cfg.pwa ? '<link rel="manifest" href="manifest.json">' : ''}
    <style>
        body { font-family: sans-serif; background: #f4f4f9; padding: 20px; color: #333; }
        header { background: ${cfg.color}; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        h1 { margin: 0; }
        .card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 10px; }
        input[type="text"] { padding: 10px; width: 70%; border: 1px solid #ddd; border-radius: 4px; }
        button { padding: 10px 20px; background: ${cfg.color}; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .done { text-decoration: line-through; opacity: 0.6; }
    </style>
</head>
<body>
    <header><h1>${cfg.name}</h1></header>
    <div id="app">${bodyContent}</div>
    <script>
        ${generateJS(cfg)}
    <\/script>
</body>
</html>`;
}

function getBodyContent(cfg) {
    if (cfg.recipe === 'todo') {
        return `
            <div style="display:flex; gap:10px; margin-bottom:20px;">
                <input type="text" id="todoInput" placeholder="New task...">
                <button onclick="addTodo()">Add</button>
            </div>
            <ul id="todoList" style="list-style:none; padding:0;"></ul>
        `;
    } else if (cfg.recipe === 'feed') {
        return `<div id="feedList"></div>`;
    } else {
        return `<div class="card"><h3>Welcome</h3><p>This is a static information app.</p></div>`;
    }
}

function generateJS(cfg) {
    let code = '';
    
    if (cfg.recipe === 'todo') {
        code += `
            const list = document.getElementById('todoList');
            function loadTodos() {
                ${cfg.storage ? `list.innerHTML = localStorage.getItem('${cfg.name}_todos') || '';` : ''}
                renderList();
            }
            function addTodo() {
                const val = document.getElementById('todoInput').value;
                if(!val) return;
                const li = '<li class="card" onclick="this.classList.toggle(\\'done\\')">' + val + '</li>';
                list.insertAdjacentHTML('beforeend', li);
                ${cfg.storage ? `localStorage.setItem('${cfg.name}_todos', list.innerHTML);` : ''}
                document.getElementById('todoInput').value = '';
            }
            function renderList() { /* Logic to attach events if loaded from storage */ }
            loadTodos();
        `;
    } else if (cfg.recipe === 'feed') {
        // Safely inject user JSON data
        const safeData = cfg.data ? cfg.data.replace(/`/g, '\\`') : '[{"title":"No Data"}]';
        code += `
            const data = ${safeData};
            const container = document.getElementById('feedList');
            data.forEach(item => {
                container.innerHTML += '<div class="card"><strong>' + item.title + '</strong></div>';
            });
        `;
    }
    
    return code;
}

function generateManifest(cfg) {
    return JSON.stringify({
        "name": cfg.name,
        "short_name": cfg.name,
        "start_url": "./index.html",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": cfg.color,
        "icons": [{"src": "https://via.placeholder.com/192/000000/FFFFFF?text=APP", "sizes": "192x192", "type": "image/png"}]
    }, null, 2);
}

// --- Download Logic ---

async function downloadZip() {
    const cfg = getConfig();
    const zip = new JSZip();

    // 1. Add HTML
    zip.file("index.html", generateAppHTML(cfg));

    // 2. Add Manifest if PWA
    if (cfg.pwa) {
        zip.file("manifest.json", generateManifest(cfg));
    }

    // 3. Generate and save
    const content = await zip.generateAsync({type:"blob"});
    saveAs(content, `${cfg.name}.zip`);
}
