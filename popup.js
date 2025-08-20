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

  // toggle api key section visibility when link is clicked
  apiKeyLink.addEventListener('click', function() {
    apiKeySection.classList.toggle('hidden'); // toggle hidden class
  });

  // toggle logs visibility when toggle is clicked
  logsToggle.addEventListener('click', function() {
    logsContainer.classList.toggle('hidden'); // toggle logs container visibility
    logsToggle.textContent = logsContainer.classList.contains('hidden') ? 'Show Logs' : 'Hide Logs'; // update toggle text
  });

  // clear logs when button is clicked
  clearLogsBtn.addEventListener('click', async function() {
    await clearPersistentLogs(); // clear persistent logs
  });

  // handle pause/resume button
  pauseBtn.addEventListener('click', function() {
    if (isPaused) { // check if currently paused
      isPaused = false; // resume execution
      pauseBtn.textContent = 'Pause Execution'; // update button text
      pauseBtn.style.background = '#dc3545'; // reset button color
      addLog('action', 'execution resumed'); // log resume
      if (currentActions.length > 0) { // check if actions to resume
        executeActionsFromIndex(currentActions, currentActionIndex); // resume from current index
      }
    } else {
      isPaused = true; // pause execution
      pauseBtn.textContent = 'Resume Execution'; // update button text
      pauseBtn.style.background = '#28a745'; // change to green
      addLog('action', 'execution paused'); // log pause
      showTaskStatus('Execution paused by user', 'working'); // show pause status
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
      logsSection.classList.remove('hidden'); // show logs section
      apiKeyLink.classList.remove('hidden'); // show api key link
      apiKeySection.classList.add('hidden'); // hide api key section
    } else {
      mainInterface.classList.add('hidden'); // hide main interface
      logsSection.classList.add('hidden'); // hide logs section
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
      submitBtn.disabled = true; // disable submit button
      pauseBtn.classList.add('show'); // show pause button
      isPaused = false; // reset pause state
      pauseBtn.textContent = 'Pause Execution'; // reset button text
      pauseBtn.style.background = '#dc3545'; // reset button color
      showTaskStatus('Processing your request...', 'working'); // show working status
      addLog('request', `user instruction: ${instruction}`); // log user instruction

      // get api key from storage
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['openai_api_key'], resolve);
      });

      if (!result.openai_api_key) { // check if api key exists
        const errorMsg = 'API key not found. Please add your API key first.'; // create error message
        showStatus(errorMsg, 'error'); // show error message
        addLog('error', errorMsg); // log error
        return;
      }

      // get current tab info
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const currentUrl = tab.url; // get current tab url
      const currentTitle = tab.title; // get current tab title
      addLog('request', `current page: ${currentTitle} (${currentUrl})`); // log current page

      // prepare openai request
      const requestBody = {
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: `you are an ai assistant that helps users navigate and interact with websites. you can:
1. navigate to websites by providing urls
2. click on links and buttons by providing css selectors
3. fill out forms by providing selectors and values
4. submit forms by clicking submit buttons or pressing enter
5. extract information from pages
6. scroll and interact with page elements

current page: ${currentTitle}

important: when filling out search forms or inputs, always follow up with submitting the form. use these strategies in order of preference:
1. press enter key on the input field (most reliable)
2. click the submit/search button if enter doesn't work
3. submit the parent form element

if you cannot find the right selectors or actions fail, use the "analyze_page" action to get page structure and ask for guidance.

respond with json containing an array of actions to perform:
{
  "actions": [
    {"type": "navigate", "url": "https://example.com"},
    {"type": "click", "selector": ".button-class"},
    {"type": "type", "selector": "#input-id", "text": "text to type"},
    {"type": "press_key", "selector": "#input-id", "key": "Enter"},
    {"type": "submit", "selector": "#form-id"},
    {"type": "scroll", "direction": "down"},
    {"type": "extract", "selector": ".content", "description": "what to extract"},
    {"type": "analyze_page", "focus": "search form", "question": "what selector should I use for the search button?"},
    {"type": "wait", "seconds": 2},
    {"type": "complete", "message": "task completed successfully"}
  ]
}

when selectors fail or you're unsure about page structure, use analyze_page to get relevant HTML and determine correct selectors.`
          },
          {
            role: 'user',
            content: instruction
          }
        ],
        max_completion_tokens: 1000
      }; // create request body

      addLog('request', `openai request: ${JSON.stringify(requestBody, null, 2)}`); // log openai request

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.openai_api_key}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) { // check if request failed
        const errorText = await response.text(); // get error details
        addLog('error', `openai api error ${response.status}: ${errorText}`); // log detailed error
        throw new Error(`openai api error: ${response.status}`); // throw error
      }

      const data = await response.json(); // parse response
      addLog('response', `openai response: ${JSON.stringify(data, null, 2)}`); // log openai response
      const aiResponse = data.choices[0].message.content; // get ai response

      // parse ai response as json
      let actions;
      try {
        const parsed = JSON.parse(aiResponse); // parse json response
        actions = parsed.actions; // get actions array
        addLog('response', `parsed actions: ${JSON.stringify(actions, null, 2)}`); // log parsed actions
      } catch (e) {
        const errorMsg = 'invalid response format from ai'; // create error message
        addLog('error', `${errorMsg}: ${aiResponse}`); // log error with response
        throw new Error(errorMsg); // throw error
      }

      // execute actions via content script
      currentActions = actions; // store actions for pause/resume
      currentActionIndex = 0; // reset action index
      await executeActions(actions); // execute actions

      // clear input and show completion message only if no errors
      const hasErrors = document.querySelectorAll('.log-entry.error').length > 0; // check for error logs
      instructionInput.value = ''; // clear instruction input
      if (!hasErrors) { // check if no errors
        showTaskStatus('Task completed - waiting for next task', 'completed'); // show completion message
        addLog('system', 'task completed - ready for next instruction'); // log completion
      } else {
        showTaskStatus('Task finished with errors - check logs', 'error'); // show error completion
        addLog('system', 'task finished with errors - ready for next instruction'); // log completion with errors
      }

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
              response = await chrome.tabs.sendMessage(tab.id, { action: action.type, ...action }); // send message
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
