let allTasks = {}; // store all task data

// load initial data
loadAllTasks();

// listen for updates from extension
window.addEventListener('message', function(event) {
    if (event.data.type === 'UPDATE_TASK_DATA') {
        updateTaskData(event.data.taskData);
    }
});

// listen for chrome extension messages
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.type === 'UPDATE_TASK_DATA') {
            updateTaskData(message.taskData);
        }
    });
}

async function loadAllTasks() {
    try {
        // load all task data from chrome storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(null, function(result) {
                // find all task data entries
                Object.keys(result).forEach(key => {
                    if (key.startsWith('task_data_')) {
                        const taskData = result[key];
                        allTasks[taskData.taskId] = taskData;
                    }
                });
                updateDisplay();
            });
        }
    } catch (error) {
        console.log('chrome storage not available'); // log error
    }
}

function updateTaskData(taskData) {
    if (!taskData || !taskData.taskId) return;
    
    // update task in memory
    allTasks[taskData.taskId] = taskData;
    
    // refresh display
    updateDisplay();
}

function updateDisplay() {
    const container = document.getElementById('tasksContainer');
    
    // get tasks sorted by start time (newest first)
    const taskList = Object.values(allTasks).sort((a, b) => 
        new Date(b.startTime) - new Date(a.startTime)
    );
    
    if (taskList.length === 0) {
        container.innerHTML = '<div class="no-tasks">No tasks executed yet...</div>';
        return;
    }
    
    // create html for all tasks
    container.innerHTML = taskList.map(taskData => `
        <div class="task-section">
            <div class="task-header">
                🕐 ${taskData.startTime} - Task: ${taskData.query}
            </div>
            
            <div class="query-section">
                <div class="query-label">User Query:</div>
                <div class="query-text">${taskData.query || 'No query provided'}</div>
            </div>
            
            <div class="stats">
                <span class="stats-item">📊 Total URLs Visited: ${taskData.urls ? taskData.urls.length : 0}</span>
                <span class="stats-item">⏰ Task Started: ${taskData.startTime || '-'}</span>
            </div>
            
            <div class="urls-section">
                <div class="urls-header">🌐 Visited URLs</div>
                <div class="urls-list">
                    ${taskData.urls && taskData.urls.length > 0 ? 
                        taskData.urls.map(urlData => `
                            <div class="url-entry">
                                <a href="${urlData.url}" target="_blank" class="url-link">${urlData.url}</a>
                                <span class="url-timestamp">${urlData.timestamp}</span>
                            </div>
                        `).join('') :
                        '<div class="no-urls">No URLs visited yet...</div>'
                    }
                </div>
            </div>
        </div>
    `).join('');
}

// expose function for extension to call
window.updateTaskData = updateTaskData;
