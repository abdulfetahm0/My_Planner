// --- STATE MANAGEMENT ---
let currentDate = new Date();
let tasks = JSON.parse(localStorage.getItem('plannerTasks')) || {};
let serviceWorkerRegistration;
let geminiAPIKey = localStorage.getItem('geminiAPIKey');

// --- DOM ELEMENTS ---
const DOMElements = {
    splashScreen: document.getElementById('splash-screen'),
    appContainer: document.getElementById('app-container'),
    monthYear: document.getElementById('month-year'),
    calendarGrid: document.getElementById('calendar-grid'),
    prevMonthBtn: document.getElementById('prev-month'),
    nextMonthBtn: document.getElementById('next-month'),
    taskModal: document.getElementById('task-modal'),
    modalContent: document.getElementById('modal-content'),
    modalDate: document.getElementById('modal-date'),
    closeModalBtn: document.getElementById('close-modal'),
    taskList: document.getElementById('task-list'),
    taskInput: document.getElementById('task-input'),
    taskTime: document.getElementById('task-time'),
    taskSound: document.getElementById('task-sound'),
    addTaskBtn: document.getElementById('add-task-btn'),
    loadingSpinner: document.getElementById('loading-spinner'),
    geminiBreakdownBtn: document.getElementById('gemini-breakdown-btn'),
    geminiSuggestionsContainer: document.getElementById('gemini-suggestions-container'),
    geminiSummaryBtn: document.getElementById('gemini-summary-btn'),
    geminiSummaryOutput: document.getElementById('gemini-summary-output'),
};

// --- GEMINI API INTEGRATION ---
const getGeminiAPIKey = () => {
    if (!geminiAPIKey) {
        geminiAPIKey = prompt('Please enter your Google Gemini API Key. You can get a free one from Google AI Studio.');
        if (geminiAPIKey) {
            localStorage.setItem('geminiAPIKey', geminiAPIKey);
        }
    }
    return geminiAPIKey;
};

const callGeminiAPI = async (promptText) => {
    const apiKey = getGeminiAPIKey();
    if (!apiKey) {
        alert('Gemini API Key is required to use this feature.');
        return null;
    }

    DOMElements.loadingSpinner.classList.remove('hidden');
    
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        return JSON.parse(textResponse); 

    } catch (error) {
        console.error('Gemini API call failed:', error);
        alert(`An error occurred while contacting the AI: ${error.message}`);
        return null;
    } finally {
        DOMElements.loadingSpinner.classList.add('hidden');
    }
};

const handleSmartBreakdown = async () => {
    const taskText = DOMElements.taskInput.value.trim();
    if (taskText.length < 5) {
        alert("Please enter a more detailed task to break down.");
        return;
    }

    const prompt = `Break down this task into smaller, actionable steps: "${taskText}". Provide the steps as a JSON object with a single key "steps" which is an array of strings. For example: {"steps": ["First step", "Second step"]}.`;
    
    const result = await callGeminiAPI(prompt);
    if (result && result.steps) {
        displayGeminiSuggestions(result.steps);
    }
};

const displayGeminiSuggestions = (suggestions) => {
    DOMElements.geminiSuggestionsContainer.innerHTML = '';
    DOMElements.geminiSuggestionsContainer.classList.remove('hidden');

    suggestions.forEach(suggestionText => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        const text = document.createElement('span');
        text.textContent = suggestionText;
        item.appendChild(text);

        const addButton = document.createElement('button');
        addButton.innerHTML = '&#43;'; // Plus sign
        addButton.title = 'Add as a new task';
        addButton.onclick = () => {
            DOMElements.taskInput.value = suggestionText;
            DOMElements.taskTime.focus();
        };
        item.appendChild(addButton);
        
        DOMElements.geminiSuggestionsContainer.appendChild(item);
    });
};


const handleDailySummary = async () => {
    const dayTasks = tasks[currentModalDateKey] || [];
    if (dayTasks.length === 0) {
        alert("There are no tasks for this day to summarize.");
        return;
    }

    const taskListText = dayTasks.map(t => `- ${t.text}`).join('\n');
    const prompt = `Here are my tasks for today:\n${taskListText}\n\nBased on these tasks, provide a brief (2-3 sentences) motivational summary to help me get started. Return it as a JSON object with a single key "summary". For example: {"summary": "Your summary here."}`;

    const result = await callGeminiAPI(prompt);
    if (result && result.summary) {
        DOMElements.geminiSummaryOutput.textContent = result.summary;
        DOMElements.geminiSummaryOutput.classList.remove('hidden');
    }
};


// --- CORE FUNCTIONS (UNCHANGED) ---
const saveTasks = () => {
    localStorage.setItem('plannerTasks', JSON.stringify(tasks));
};

const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    DOMElements.monthYear.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;
    DOMElements.calendarGrid.innerHTML = '';
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
        DOMElements.calendarGrid.innerHTML += `<div class="p-2"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${month + 1}-${day}`;
        const today = new Date();
        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const dayEl = document.createElement('div');
        dayEl.className = `calendar-day relative p-2 md:p-4 border border-gray-200 rounded-lg cursor-pointer text-center bg-white ${isToday ? 'bg-indigo-100 text-indigo-700 font-bold' : ''}`;
        dayEl.textContent = day;
        dayEl.dataset.date = dateKey;
        if (tasks[dateKey] && tasks[dateKey].length > 0) {
            dayEl.classList.add('has-task');
        }
        dayEl.addEventListener('click', () => openTaskModal(dateKey));
        DOMElements.calendarGrid.appendChild(dayEl);
    }
};

// --- TASK MODAL & MANAGEMENT (UPDATED) ---
let currentModalDateKey = '';

const openTaskModal = (dateKey) => {
    currentModalDateKey = dateKey;
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    DOMElements.modalDate.textContent = date.toLocaleString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    renderTasksForDay(dateKey);

    // Reset Gemini elements
    DOMElements.geminiSuggestionsContainer.classList.add('hidden');
    DOMElements.geminiSummaryOutput.classList.add('hidden');
    DOMElements.geminiBreakdownBtn.classList.add('hidden');

    DOMElements.taskModal.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-4');
    DOMElements.modalContent.classList.remove('scale-95');
};

const closeModal = () => {
    DOMElements.taskModal.classList.add('opacity-0', '-translate-y-4');
    DOMElements.modalContent.classList.add('scale-95');
    setTimeout(() => {
        DOMElements.taskModal.classList.add('pointer-events-none');
    }, 300);
};

const renderTasksForDay = (dateKey) => {
    DOMElements.taskList.innerHTML = '';
    const dayTasks = tasks[dateKey] || [];
    if (dayTasks.length === 0) {
        DOMElements.taskList.innerHTML = `<p class="text-gray-500 text-center py-4">No tasks for this day.</p>`;
        return;
    }
    dayTasks.sort((a,b) => a.dateTime.localeCompare(b.dateTime));
    dayTasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.className = 'task-item flex items-center justify-between p-3 border-b border-gray-100';
        const time = new Date(task.dateTime).toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' });
        taskEl.innerHTML = `
            <div>
                <p class="font-semibold">${task.text}</p>
                <p class="text-sm text-gray-500">${time} - Sound: ${task.sound}</p>
            </div>
            <button data-task-id="${task.id}" class="delete-task-btn p-2 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors">
                <span class="material-icons text-lg">delete_outline</span>
            </button>
        `;
        DOMElements.taskList.appendChild(taskEl);
    });
    document.querySelectorAll('.delete-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteTask(currentModalDateKey, e.currentTarget.dataset.taskId));
    });
};

const addTask = () => {
    const text = DOMElements.taskInput.value.trim();
    const time = DOMElements.taskTime.value;
    const sound = DOMElements.taskSound.value;
    if (!text || !time) {
        alert('Please enter a task and select a time.');
        return;
    }
    const [year, month, day] = currentModalDateKey.split('-').map(Number);
    const [hours, minutes] = time.split(':');
    const dateTime = new Date(year, month - 1, day, hours, minutes).toISOString();
    const newTask = { id: Date.now().toString(), text, dateTime, sound, completed: false };
    if (!tasks[currentModalDateKey]) tasks[currentModalDateKey] = [];
    tasks[currentModalDateKey].push(newTask);
    saveTasks();
    renderTasksForDay(currentModalDateKey);
    renderCalendar();
    DOMElements.taskInput.value = '';
    DOMElements.taskTime.value = '';
    DOMElements.geminiSuggestionsContainer.classList.add('hidden');
    scheduleAlarm(newTask);
};

const deleteTask = (dateKey, taskId) => {
    if (!tasks[dateKey]) return;
    const taskToDelete = tasks[dateKey].find(t => t.id === taskId);
    if(taskToDelete) cancelAlarm(taskToDelete);
    tasks[dateKey] = tasks[dateKey].filter(task => task.id !== taskId);
    if (tasks[dateKey].length === 0) delete tasks[dateKey];
    saveTasks();
    renderTasksForDay(dateKey);
    renderCalendar();
};

// --- BACKGROUND & SOUND (UNCHANGED) ---
const registerServiceWorker = async () => { if ('serviceWorker' in navigator) { try { serviceWorkerRegistration = await navigator.serviceWorker.register('sw.js'); console.log('Service Worker registered successfully.'); if (Notification.permission === 'default') await Notification.requestPermission(); } catch (error) { console.error('Service Worker registration failed:', error); } } };
const scheduleAlarm = (task) => { if (!serviceWorkerRegistration || !serviceWorkerRegistration.active) return; if(Notification.permission !== 'granted') return; serviceWorkerRegistration.active.postMessage({ type: 'SCHEDULE_ALARM', task }); };
const cancelAlarm = (task) => { if (!serviceWorkerRegistration || !serviceWorkerRegistration.active) return; serviceWorkerRegistration.active.postMessage({ type: 'CANCEL_ALARM', task }); };
const synth = new Tone.Synth().toDestination();
const fmSynth = new Tone.FMSynth().toDestination();
const playSound = (soundType) => { if (Tone.context.state !== 'running') Tone.start(); switch(soundType) { case 'beep': synth.triggerAttackRelease("C5", "8n"); break; case 'synth': fmSynth.triggerAttackRelease("G4", "4n"); break; case 'chime': const chimeSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 1 }, }).toDestination(); chimeSynth.triggerAttackRelease(["C5", "E5", "G5"], "1n"); break; } };
if ('serviceWorker' in navigator) { navigator.serviceWorker.addEventListener('message', event => { if (event.data && event.data.type === 'PLAY_SOUND') playSound(event.data.sound); }); }

// --- EVENT LISTENERS (UPDATED) ---
const setupEventListeners = () => {
    DOMElements.prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    DOMElements.nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
    DOMElements.closeModalBtn.addEventListener('click', closeModal);
    DOMElements.addTaskBtn.addEventListener('click', addTask);
    DOMElements.taskModal.addEventListener('click', (e) => { if(e.target === DOMElements.taskModal) closeModal(); });

    // Gemini Event Listeners
    DOMElements.geminiBreakdownBtn.addEventListener('click', handleSmartBreakdown);
    DOMElements.geminiSummaryBtn.addEventListener('click', handleDailySummary);
    DOMElements.taskInput.addEventListener('input', () => {
        if (DOMElements.taskInput.value.trim().length > 4) {
            DOMElements.geminiBreakdownBtn.classList.remove('hidden');
        } else {
            DOMElements.geminiBreakdownBtn.classList.add('hidden');
        }
    });
};

// --- INITIALIZATION ---
const init = () => {
    setTimeout(() => {
        DOMElements.splashScreen.style.opacity = '0';
        DOMElements.appContainer.style.opacity = '1';
        setTimeout(() => {
            DOMElements.splashScreen.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 500);
    }, 1500);
    
    renderCalendar();
    setupEventListeners();
    registerServiceWorker();
};

init();
