let allTasks = {}; // store all task data

// load initial data using chrome storage api
loadAllTasks();

// use chrome runtime messaging instead of window.addEventListener
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.type === 'UPDATE_TASK_DATA') { // handle task data updates
            updateTaskData(message.taskData); // update task data
            sendResponse({success: true}); // send response
        }
        return true; // keep message channel open
    });
}

// listen for storage changes to sync data across tabs
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local') { // check if local storage changed
            // reload task data when storage changes
            Object.keys(changes).forEach(key => {
                if (key.startsWith('task_data_')) { // check if task data changed
                    const change = changes[key]; // get change details
                    if (change.newValue) { // check if new value exists
                        allTasks[change.newValue.taskId] = change.newValue; // update task in memory
                    } else if (change.oldValue) { // check if task was deleted
                        delete allTasks[change.oldValue.taskId]; // remove from memory
                    }
                }
            });
            updateDisplay(); // refresh display
        }
    });
}

async function loadAllTasks() {
    try {
        // use chrome storage api with promises
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const result = await new Promise((resolve) => {
                chrome.storage.local.get(null, resolve); // get all storage data
            });
            
            // find all task data entries
            Object.keys(result).forEach(key => {
                if (key.startsWith('task_data_')) { // check if task data key
                    const taskData = result[key]; // get task data
                    allTasks[taskData.taskId] = taskData; // store in memory
                }
            });
            updateDisplay(); // update display
        }
    } catch (error) {
        console.log('chrome storage not available:', error.message); // log error
    }
}

function updateTaskData(taskData) {
    if (!taskData || !taskData.taskId) return; // validate input
    
    // update task in memory
    allTasks[taskData.taskId] = taskData; // store task data
    
    // persist to chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({[`task_data_${taskData.taskId}`]: taskData}); // save to storage
    }
    
    // refresh display
    updateDisplay(); // update ui
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
