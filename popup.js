document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey'); // get api key input element
  const saveApiKeyBtn = document.getElementById('saveApiKey'); // get save button element
  const clearApiKeyBtn = document.getElementById('clearApiKey'); // get clear button element
  const apiKeyStatus = document.getElementById('apiKeyStatus'); // get status display element
  const status = document.getElementById('status'); // get general status element
  const apiKeyLink = document.getElementById('apiKeyLink'); // get api key link element
  const apiKeySection = document.getElementById('apiKeySection'); // get api key section element
  const mainInterface = document.getElementById('mainInterface'); // get main interface element
  const instructionInput = document.getElementById('instructionInput'); // get instruction input element
  const submitBtn = document.getElementById('submitInstruction'); // get submit button element
  const taskStatus = document.getElementById('taskStatus'); // get task status element
  const logsSection = document.getElementById('logsSection'); // get logs section element
  const logsToggle = document.getElementById('logsToggle'); // get logs toggle element
  const logsContainer = document.getElementById('logsContainer'); // get logs container element
  const logsContent = document.getElementById('logsContent'); // get logs content element
  const clearLogsBtn = document.getElementById('clearLogs'); // get clear logs button element
  const pauseBtn = document.getElementById('pauseExecution'); // get pause button element

  let isPaused = false; // track pause state
  let currentActions = []; // store current actions for resume
  let currentActionIndex = 0; // track current action index

  // load existing api key on popup open
  loadApiKey();
  
  // ensure logs toggle has correct initial text and debug element selection
  console.log('logsToggle element:', logsToggle); // debug log
  console.log('logsContainer element:', logsContainer); // debug log
  console.log('logsSection element:', logsSection); // debug log
  console.log('logsSection hidden:', logsSection ? logsSection.classList.contains('hidden') : 'element not found'); // debug log
  if (logsContainer && logsContainer.classList.contains('hidden')) { // check if logs are hidden
    logsToggle.textContent = 'Show Logs'; // set correct initial text
  } else {
    logsToggle.textContent = 'Hide Logs'; // set correct initial text
  }

  // listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TASK_STARTED') { // handle task start
      addLog('system', `task started: ${message.data.instruction}`); // log task start
    } else if (message.type === 'ACTION_EXECUTING') { // handle action execution
      const actionDescription = getActionDescription(message.data.action); // get description
      showTaskStatus(`executing step ${message.data.index + 1}/${message.data.total}: ${actionDescription}`, 'working'); // show status
      addLog('action', `executing (${message.data.index + 1}/${message.data.total}): ${JSON.stringify(message.data.action)}`); // log action
    } else if (message.type === 'ACTION_SUCCESS') { // handle action success
      addLog('action', message.data.result); // log success
    } else if (message.type === 'ACTION_ERROR') { // handle action error
      addLog('error', `action failed: ${message.data.error}`); // log error
    } else if (message.type === 'TASK_COMPLETED') { // handle task completion
      showTaskStatus('Task completed successfully', 'completed'); // show completion
      addLog('system', 'task completed - ready for next instruction'); // log completion
      submitBtn.disabled = false; // re-enable submit button
      pauseBtn.classList.remove('show'); // hide pause button
    } else if (message.type === 'TASK_FAILED') { // handle task failure
      showTaskStatus('Task failed - check logs for details', 'error'); // show failure
      addLog('error', `task failed: ${message.data.error}`); // log failure
      submitBtn.disabled = false; // re-enable submit button
      pauseBtn.classList.remove('show'); // hide pause button
    } else if (message.type === 'TASK_ERROR') { // handle task error
      showTaskStatus(`Task error: ${message.data.error}`, 'error'); // show error
      addLog('error', message.data.error); // log error
      submitBtn.disabled = false; // re-enable submit button
      pauseBtn.classList.remove('show'); // hide pause button
    } else if (message.type === 'TASK_PAUSED') { // handle task pause
      showTaskStatus('Task paused - click resume to continue', 'working'); // show pause status
    }
  });

  // toggle api key section visibility when link is clicked
  apiKeyLink.addEventListener('click', function() {
    apiKeySection.classList.toggle('hidden'); // toggle hidden class
  });

  // toggle logs visibility when toggle is clicked
  if (logsToggle && logsContainer) { // check if elements exist
    logsToggle.addEventListener('click', function() {
      console.log('logs toggle clicked'); // debug log
      logsContainer.classList.toggle('hidden'); // toggle logs container visibility
      logsToggle.textContent = logsContainer.classList.contains('hidden') ? 'Show Logs' : 'Hide Logs'; // update toggle text
      console.log('logs container hidden:', logsContainer.classList.contains('hidden')); // debug log
    });
  } else {
    console.error('logs toggle or container element not found'); // error log
  }

  // clear logs when button is clicked
  clearLogsBtn.addEventListener('click', async function() {
    await clearPersistentLogs(); // clear persistent logs
  });

  // handle pause/resume button
  pauseBtn.addEventListener('click', async function() {
    if (isPaused) { // check if currently paused
      // send resume message to background
      const response = await chrome.runtime.sendMessage({type: 'RESUME_TASK'}); // resume task
      if (response && response.success) { // check if resumed
        isPaused = false; // update local state
        pauseBtn.textContent = 'Pause Execution'; // update button text
        pauseBtn.style.background = '#dc3545'; // reset button color
        addLog('action', 'execution resumed'); // log resume
        showTaskStatus('Task resumed in background', 'working'); // show resume status
      }
    } else {
      // send pause message to background
      const response = await chrome.runtime.sendMessage({type: 'PAUSE_TASK'}); // pause task
      if (response && response.success) { // check if paused
        isPaused = true; // update local state
        pauseBtn.textContent = 'Resume Execution'; // update button text
        pauseBtn.style.background = '#28a745'; // change to green
        addLog('action', 'execution paused'); // log pause
        showTaskStatus('Execution paused by user', 'working'); // show pause status
      }
    }
  });

  // handle task submission
  submitBtn.addEventListener('click', function() {
    const instruction = instructionInput.value.trim(); // get instruction text

    if (!instruction) { // check if instruction is empty
      showStatus('Please enter an instruction', 'error'); // show error message
      return;
    }

    executeTask(instruction); // execute the task
  });

  saveApiKeyBtn.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim(); // get api key input value

    if (!apiKey) { // check if api key is empty
      showStatus('Please enter an API key', 'error'); // show error message
      return;
    }

    if (!apiKey.startsWith('sk-')) { // basic validation for openai api key format
      showStatus('Invalid API key format. OpenAI keys start with "sk-"', 'error'); // show error message
      return;
    }

    // save api key to chrome storage
    chrome.storage.local.set({ 'openai_api_key': apiKey }, function() {
      if (chrome.runtime.lastError) { // check for storage errors
        showStatus('Error saving API key: ' + chrome.runtime.lastError.message, 'error'); // show error message
      } else {
        showStatus('API key saved successfully!', 'success'); // show success message
        updateApiKeyStatus(true); // update status display
        updateMainInterface(true); // show main interface
        apiKeyInput.value = ''; // clear input field
      }
    });
  });

  clearApiKeyBtn.addEventListener('click', function() {
    // remove api key from chrome storage
    chrome.storage.local.remove('openai_api_key', function() {
      if (chrome.runtime.lastError) { // check for storage errors
        showStatus('Error clearing API key: ' + chrome.runtime.lastError.message, 'error'); // show error message
      } else {
        showStatus('API key cleared successfully!', 'success'); // show success message
        updateApiKeyStatus(false); // update status display
        updateMainInterface(false); // hide main interface
        apiKeyInput.value = ''; // clear input field
      }
    });
  });

  async function loadApiKey() {
    // load api key from chrome storage
    chrome.storage.local.get(['openai_api_key'], async function(result) {
      if (chrome.runtime.lastError) { // check for storage errors
        console.error('error loading api key:', chrome.runtime.lastError); // log error
        updateApiKeyStatus(false); // update status display
        updateMainInterface(false); // hide main interface
      } else if (result.openai_api_key) { // check if api key exists
        updateApiKeyStatus(true); // update status display
        updateMainInterface(true); // show main interface
      } else {
        updateApiKeyStatus(false); // update status display
        updateMainInterface(false); // hide main interface
      }

      // load persistent logs when popup opens
      await loadPersistentLogs(); // load saved logs
    });
  }

  function updateApiKeyStatus(hasKey) {
    if (hasKey) { // check if api key is stored
      apiKeyStatus.textContent = '✓ API key is stored'; // show stored message
      apiKeyStatus.style.display = 'block'; // show status element
    } else {
      apiKeyStatus.textContent = ''; // clear status message
      apiKeyStatus.style.display = 'none'; // hide status element
    }
  }

  function updateMainInterface(show) {
    if (show) { // check if should show main interface
      mainInterface.classList.remove('hidden'); // show main interface
      apiKeyLink.classList.remove('hidden'); // show api key link
      apiKeySection.classList.add('hidden'); // hide api key section
    } else {
      mainInterface.classList.add('hidden'); // hide main interface
      apiKeyLink.classList.add('hidden'); // hide api key link
      apiKeySection.classList.remove('hidden'); // show api key section for setup
    }
  }

  function addLog(type, content) {
    const timestamp = new Date().toLocaleTimeString(); // get current timestamp
    const logEntry = document.createElement('div'); // create log entry element
    logEntry.className = `log-entry ${type}`; // set log entry class

    logEntry.innerHTML = `
      <div class="log-timestamp">[${timestamp}] ${type.toUpperCase()}</div>
      <div class="log-content">${content}</div>
    `; // set log entry html

    logsContent.appendChild(logEntry); // add log entry to container
    logsContent.scrollTop = logsContent.scrollHeight; // scroll to bottom

    // save log to persistent storage
    saveLogToPersistentStorage(type, content, timestamp); // persist log
  }

  function showTaskStatus(message, type) {
    taskStatus.textContent = message; // set task status message
    taskStatus.className = `task-status ${type}`; // set task status class for styling
    taskStatus.style.display = 'block'; // show task status element
  }

  function getActionDescription(action) {
    // convert action to human-readable description
    switch (action.type) {
      case 'navigate': return `navigating to ${action.url}`;
      case 'click': return `clicking element`;
      case 'type': return `typing "${action.text}"`;
      case 'press_key': return `pressing ${action.key} key`;
      case 'submit': return `submitting form`;
      case 'wait': return `waiting ${action.seconds} seconds`;
      case 'scroll': return `scrolling ${action.direction}`;
      case 'extract': return `extracting content`;
      case 'analyze_page': return `analyzing page structure`;
      case 'complete': return `completing task`;
      default: return `executing ${action.type}`;
    }
  }

  async function executeTask(instruction) {
    try {
      // clean instruction by removing "on autochat" suffix
      const cleanedInstruction = instruction.replace(/\s+on\s+autochat\s*$/i, '').trim(); // remove "on autochat" suffix
      
      submitBtn.disabled = true; // disable submit button
      pauseBtn.classList.add('show'); // show pause button
      isPaused = false; // reset pause state
      pauseBtn.textContent = 'Pause Execution'; // reset button text
      pauseBtn.style.background = '#dc3545'; // reset button color
      showTaskStatus('Processing your request...', 'working'); // show working status
      addLog('request', `user instruction: ${cleanedInstruction}`); // log cleaned instruction

      // check for existing data collection tab
      const taskId = Date.now().toString(); // generate unique task id
      let dataTab;
      let existingDataTabId = null;
      
      // check if there's already a data collection tab
      const existingResult = await chrome.storage.local.get(['persistent_data_tab_id']); // get existing tab id
      if (existingResult.persistent_data_tab_id) { // check if tab id exists
        try {
          const existingTab = await chrome.tabs.get(existingResult.persistent_data_tab_id); // try to get existing tab
          if (existingTab && existingTab.url.includes('data-collection.html')) { // check if it's still data collection tab
            dataTab = existingTab; // reuse existing tab
            existingDataTabId = existingTab.id; // store existing id
            addLog('system', `reusing existing data collection tab (id: ${dataTab.id})`); // log reuse
          }
        } catch (error) {
          // existing tab was closed, will create new one
          addLog('system', 'existing data collection tab was closed, creating new one'); // log creation
        }
      }
      
      // create new data collection tab if none exists
      if (!dataTab) { // check if no existing tab
        const dataCollectionUrl = chrome.runtime.getURL(`data-collection.html`); // get extension url without taskId
        dataTab = await chrome.tabs.create({ url: dataCollectionUrl, active: false }); // create new tab but don't activate it
        await chrome.storage.local.set({'persistent_data_tab_id': dataTab.id}); // save tab id for reuse
        addLog('system', `created new data collection tab (id: ${dataTab.id})`); // log creation
      }
      
      // initialize task data
      const taskData = {
        taskId: taskId,
        query: cleanedInstruction,
        startTime: new Date().toLocaleString(),
        urls: [],
        dataTabId: dataTab.id,
        workingTabId: null // will be set by background script
      };
      
      // save task data to storage
      await new Promise((resolve) => {
        chrome.storage.local.set({[`task_data_${taskId}`]: taskData, 'current_task_id': taskId}, resolve);
      });
      
      // update data collection tab with initial task data
      try {
        await chrome.scripting.executeScript({
          target: { tabId: dataTab.id },
          func: (taskData) => {
            console.log('initializing data collection with task:', taskData); // debug log
            if (window.updateTaskData) {
              window.updateTaskData(taskData);
            }
          },
          args: [taskData]
        });
        addLog('system', `initialized data collection tab with task data`); // log initialization
      } catch (error) {
        addLog('system', `failed to initialize data collection tab: ${error.message}`); // log error
      }
      
      addLog('system', `created data collection tab (id: ${dataTab.id})`); // log tab creation

      // send start task message to background script
      chrome.runtime.sendMessage({
        type: 'START_TASK',
        instruction: cleanedInstruction,
        taskId: taskId
      }); // send task to background

      if (true) { // check if task started
        addLog('system', 'task started in background - popup can be closed safely'); // log background start
        showTaskStatus('Task running in background - popup can be closed', 'working'); // show background status
      } else {
        throw new Error('failed to start task in background'); // throw error
      }

      // clear input and show completion message
      instructionInput.value = ''; // clear instruction input

    } catch (error) {
      console.error('task execution error:', error); // log error
      const errorMsg = `Error executing task: ${error.message}`; // create error message
      showTaskStatus(errorMsg, 'error'); // show error
      addLog('error', errorMsg); // log error
    } finally {
      submitBtn.disabled = false; // re-enable submit button
      pauseBtn.classList.remove('show'); // hide pause button
    }
  }

  async function executeActions(actions) {
    return await executeActionsFromIndex(actions, 0); // start from beginning
  }

  async function executeActionsFromIndex(actions, startIndex) {
    for (let i = startIndex; i < actions.length; i++) { // loop through actions
      if (isPaused) { // check if paused
        currentActionIndex = i; // save current index
        showTaskStatus('execution paused - click resume to continue', 'paused'); // show paused status
        return; // exit function
      }
      
      const action = actions[i]; // get current action
      
      // show immediate feedback for current action
      const actionDescription = getActionDescription(action); // get human-readable description
      showTaskStatus(`executing step ${i + 1}/${actions.length}: ${actionDescription}`, 'working'); // show current action
      
      addLog('action', `executing (${i + 1}/${actions.length}): ${JSON.stringify(action)}`); // log action
      
      try {
        await new Promise(resolve => setTimeout(resolve, 300)); // reduced wait between actions to content script
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

        if (action.type === 'navigate') { // check if navigation action
          await chrome.tabs.update(tab.id, {url: action.url}); // navigate to url
          addLog('action', `navigated to: ${action.url}`); // log navigation
          
          // wait for page to load and reinject content script
          await new Promise(resolve => setTimeout(resolve, 2000)); // wait for navigation
          
          try {
            // reinject content script after navigation
            if (chrome.scripting && chrome.scripting.executeScript) { // check if scripting api available
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              }); // reinject content script
              addLog('system', 'content script reinjected after navigation'); // log reinjection
            } else {
              addLog('system', 'scripting api not available - skipping reinject'); // log api unavailable
            }
          } catch (reinjectError) {
            addLog('system', `content script reinject failed: ${reinjectError.message}`); // log reinject failure
          }
          
          // track navigation in data collection
          await trackNavigationInDataCollection(action.url); // track navigation
        } else if (action.type === 'complete') { // check if completion action
          // only show completion if no previous errors occurred
          const hasErrors = document.querySelectorAll('.log-entry.error').length > 0; // check for error logs
          if (!hasErrors) { // check if no errors
            showTaskStatus(action.message, 'completed'); // show completion message
            addLog('action', `task completed: ${action.message}`); // log completion
          } else {
            showTaskStatus('task completed with errors - check logs', 'error'); // show error completion
            addLog('action', `task completed with errors: ${action.message}`); // log completion with errors
          }
          break;
        } else if (action.type === 'analyze_page') { // check if page analysis action
          const response = await chrome.tabs.sendMessage(tab.id, {action: action}); // send message to content script
          if (response && response.success) { // check if analysis succeeded
            addLog('action', `page analysis: ${response.result}`); // log analysis result
            // send analysis back to openai for selector guidance
            await requestSelectorGuidance(response.result, action.question); // request guidance
          } else if (response && !response.success) { // check if analysis failed
            addLog('error', `page analysis failed: ${response.error}`); // log error
          }
        } else if (action.type === 'wait') { // check if wait action
          await new Promise(resolve => setTimeout(resolve, action.seconds * 1000)); // wait specified seconds
          addLog('action', `waited ${action.seconds} seconds`); // log wait
        } else { // check if other action type
          // send message to content script with retry logic
          let response;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) { // retry loop
            try {
              response = await chrome.tabs.sendMessage(tab.id, { action: action }); // send message
              break; // success, exit retry loop
            } catch (error) {
              retryCount++; // increment retry count
              if (error.message.includes('message channel') || error.message.includes('back/forward cache')) { // check for cache error
                addLog('system', `message channel error, attempt ${retryCount}/${maxRetries}: ${error.message}`); // log error
                
                if (retryCount < maxRetries) { // check if more retries available
                  // wait and try to reinject content script
                  await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second
                  
                  try {
                    if (chrome.scripting && chrome.scripting.executeScript) { // check if scripting api available
                      await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                      }); // reinject content script
                      addLog('system', `content script reinjected on retry ${retryCount}`); // log reinjection
                    } else {
                      addLog('system', `scripting api not available on retry ${retryCount}`); // log api unavailable
                    }
                  } catch (reinjectError) {
                    addLog('system', `reinject failed on retry ${retryCount}: ${reinjectError.message}`); // log reinject failure
                  }
                }
              } else {
                throw error; // rethrow non-cache errors immediately
              }
            }
          }
          if (!response && retryCount >= maxRetries) { // check if all retries failed
            const errorMsg = 'failed to communicate with content script after retries'; // create error message
            addLog('error', errorMsg); // log error
            throw new Error(errorMsg); // throw error
          }
          
          if (!response) { // check if no response received
            const errorMsg = 'no response from content script'; // create error message
            addLog('error', `action failed: ${errorMsg}`); // log error
            throw new Error(errorMsg); // throw error
          }
          
          if (response && response.success) { // check if action succeeded
            addLog('action', response.result); // log success
          } else {
            const errorMsg = response.error || 'action failed with unknown error'; // create error message
            addLog('error', `action failed: ${errorMsg}`); // log error
            throw new Error(errorMsg); // throw error
          }

        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait between actions
      } catch (error) {
        console.error('action execution error:', error); // log error to console
        const errorMsg = `Error executing action: ${error.message}`; // create error message
        showTaskStatus(errorMsg, 'error'); // show error status
        addLog('error', errorMsg); // log error
        
        // stop execution and mark task as failed
        showTaskStatus('Task failed - check logs for details', 'error'); // show failure status
        addLog('system', 'task execution stopped due to error'); // log task failure
        return; // exit function to prevent further execution
      }
    }
  }

  async function attemptActionRecovery(failedAction, error) {
    try {
      // determine what type of element we're looking for based on action
      let focus = 'general';
      let question = '';

      if (failedAction.type === 'type' || failedAction.type === 'press_key') { // check if input-related action
        focus = 'search form'; // focus on search forms
        question = `what is the correct css selector for the search input field? the failed selector was: ${failedAction.selector}`; // ask for input selector
      } else if (failedAction.type === 'click') { // check if click action
        focus = 'navigation'; // focus on navigation
        question = `what is the correct css selector for clickable elements like buttons or links? the failed selector was: ${failedAction.selector}`; // ask for click selector
      } else {
        focus = 'general'; // general focus
        question = `what is the correct css selector for this element? the failed selector was: ${failedAction.selector}`; // ask for general selector
      }
      return null; // no recovery for other action types

      // get page analysis
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const analysisAction = {type: 'analyze_page', focus: focus, question: question}; // create analysis action
      const analysisResponse = await chrome.tabs.sendMessage(tab.id, {action: analysisAction}); // get page analysis

      if (!analysisResponse || !analysisResponse.success) { // check if analysis failed
        return null;
      }

      // get selector guidance from openai
      const guidance = await requestSelectorGuidance(analysisResponse.result, question); // get guidance
      if (!guidance) { // check if guidance failed
        return null;
      }

      // extract selector from guidance - handle various response formats
      let extractedSelector = null;

      // try to find a css selector in the response
      const selectorPatterns = [
        /([#.][\w-]+(?:\[[\w="'-\s]+\])?)/g, // id/class selectors with attributes
        /(input\[[\w="'-\s]+\])/g, // input with attributes
        /(textarea\[[\w="'-\s]+\])/g, // textarea with attributes
        /(button\[[\w="'-\s]+\])/g, // button with attributes
        /([a-zA-Z]+\[[\w="'-\s]+\])/g, // any element with attributes
        /(#[\w-]+)/g, // id selectors
        /(\.[\w-]+)/g // class selectors
      ];

      for (const pattern of selectorPatterns) {
        const matches = guidance.match(pattern);
        if (matches && matches.length > 0) {
          extractedSelector = matches[0].trim();
          break;
        }
      }

      // if no selector pattern found, check if the response itself looks like a selector
      if (!extractedSelector && guidance.length < 100) {
        const trimmed = guidance.trim();
        if (trimmed.match(/^[#.]?[\w-]+(\[[\w="'-\s]+\])?$/)) {
          extractedSelector = trimmed;
        }
      }

      if (!extractedSelector) { // check if no selector found
        addLog('error', `could not extract selector from guidance: ${guidance}`);
        return null;
      }

      // create new action with updated selector
      const newAction = {...failedAction}; // copy failed action
      newAction.selector = extractedSelector; // update selector
      addLog('action', `extracted selector for retry: ${extractedSelector}`);
      return newAction;

    } catch (error) {
      console.error('action recovery error:', error); // log error
      addLog('error', `action recovery failed: ${error.message}`); // log error
      return null;
    }
  }

  async function requestSelectorGuidance(pageAnalysis, question) {
    try {
      addLog('request', `requesting selector guidance: ${question}`); // log guidance request

      // get api key from storage
      const result = await chrome.storage.local.get(['openai_api_key']); // get api key
      if (!result.openai_api_key) { // check if no api key
        throw new Error('openai api key not found'); // throw error
      }

      const requestBody = {
        model: 'gpt-5-mini', // use gpt-5-mini model
        messages: [
          {
            role: 'system',
            content: 'you are a web automation expert. analyze the provided html and suggest the correct css selector. respond with just the selector, nothing else. if multiple selectors could work, choose the most reliable one.'
          },
          {
            role: 'user', 
            content: pageAnalysis
          }
        ],
        max_completion_tokens: 50 // reduced for faster response
      };

      // add timeout for faster error recovery
      const controller = new AbortController(); // create abort controller
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.openai_api_key}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal // add abort signal
      });

      clearTimeout(timeoutId); // clear timeout

      if (!response.ok) { // check if response not ok
        const errorData = await response.json(); // get error data
        throw new Error(`openai api error: ${response.status} - ${JSON.stringify(errorData)}`); // throw detailed error
      }

      const data = await response.json(); // parse response
      return data.choices[0].message.content.trim(); // return guidance
    } catch (error) {
      if (error.name === 'AbortError') { // check if timeout error
        addLog('error', `selector guidance timeout - continuing without recovery`); // log timeout
      } else {
        addLog('error', `selector guidance error: ${error.message}`); // log error
      }
      return null; // return null on error
    }
  }

  async function saveLogToPersistentStorage(type, content, timestamp) {
    try {
      // get existing logs from storage
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['persistent_logs'], resolve);
      });

      const logs = result.persistent_logs || []; // get existing logs or empty array

      // add new log entry
      logs.push({
        type: type,
        content: content,
        timestamp: timestamp,
        fullTimestamp: new Date().toISOString()
      }); // add log entry

      // keep only last 1000 log entries to prevent storage overflow
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000); // remove oldest entries
      }

      // save updated logs to storage
      await new Promise((resolve) => {
        chrome.storage.local.set({persistent_logs: logs}, resolve);
      });

    } catch (error) {
      console.error('failed to save log to persistent storage:', error); // log error
    }
  }

  async function loadPersistentLogs() {
    try {
      // get logs from storage
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['persistent_logs'], resolve);
      });

      const logs = result.persistent_logs || []; // get logs or empty array

      // display logs in ui
      logs.forEach(log => {
        const logEntry = document.createElement('div'); // create log entry element
        logEntry.className = `log-entry ${log.type}`; // set log entry class

        logEntry.innerHTML = `
          <div class="log-timestamp">[${log.timestamp}] ${log.type.toUpperCase()}</div>
          <div class="log-content">${log.content}</div>
        `; // set log entry html

        logsContent.appendChild(logEntry); // add log entry to container
      });
      
      if (logs.length > 0) {
        logsContent.scrollTop = logsContent.scrollHeight; // scroll to bottom
      }

    } catch (error) {
      console.error('failed to load persistent logs:', error); // log error
    }
  }

  async function clearPersistentLogs() {
    try {
      // clear logs from storage
      await new Promise((resolve) => {
        chrome.storage.local.set({persistent_logs: []}, resolve);
      });

      // clear logs from ui
      logsContent.innerHTML = ''; // clear container

    } catch (error) {
      console.error('failed to clear persistent logs:', error); // log error
    }
  }

  async function trackNavigationInDataCollection(url) {
    try {
      // get current task id
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['current_task_id'], resolve);
      });
      
      const taskId = result.current_task_id; // get task id
      if (!taskId) return; // no active task
      
      // get current task data
      const taskResult = await new Promise((resolve) => {
        chrome.storage.local.get([`task_data_${taskId}`], resolve);
      });
      
      const taskData = taskResult[`task_data_${taskId}`]; // get task data
      if (!taskData) return; // no task data found
      
      const timestamp = new Date().toLocaleTimeString(); // get timestamp
      
      // check if url already exists to avoid duplicates
      const urlExists = taskData.urls.some(urlData => urlData.url === url); // check for duplicate
      if (urlExists) return; // url already tracked
      
      // add new url to task data
      taskData.urls.push({
        url: url,
        timestamp: timestamp,
        title: 'navigated to page'
      }); // add url data
      
      // save updated task data
      await new Promise((resolve) => {
        chrome.storage.local.set({[`task_data_${taskId}`]: taskData}, resolve);
      });
      
      // update data collection tab if it exists
      try {
        await chrome.tabs.sendMessage(taskData.dataTabId, {
          type: 'UPDATE_TASK_DATA',
          taskData: taskData
        }); // send update to data tab
        addLog('system', `tracked navigation to: ${url}`); // log tracking
      } catch (error) {
        addLog('system', `could not update data collection tab: ${error.message}`); // log error
      }
      
    } catch (error) {
      addLog('error', `error tracking navigation: ${error.message}`); // log error
    }
  }

  function showStatus(message, type) {
    status.textContent = message; // set status message
    status.className = `status ${type}`; // set status class for styling
    status.style.display = 'block'; // show status element

    // hide status after 3 seconds
    setTimeout(() => {
      status.style.display = 'none'; // hide status element
    }, 3000);
  }
});
