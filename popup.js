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
    
    logsContainer.appendChild(logEntry); // add log entry to container
    logsContainer.scrollTop = logsContainer.scrollHeight; // scroll to bottom
    
    // save log to persistent storage
    saveLogToPersistentStorage(type, content, timestamp); // persist log
  }

  function showTaskStatus(message, type) {
    taskStatus.textContent = message; // set task status message
    taskStatus.className = `task-status ${type}`; // set task status class for styling
    taskStatus.style.display = 'block'; // show task status element
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
        model: 'gpt-4',
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
        temperature: 0.7,
        max_tokens: 1000
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
      await executeActions(actions); // execute the actions

    } catch (error) {
      console.error('task execution error:', error); // log error
      const errorMsg = `Error: ${error.message}`; // create error message
      showTaskStatus(errorMsg, 'error'); // show error status
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
    for (let i = startIndex; i < actions.length; i++) { // iterate through actions from start index
      if (isPaused) { // check if execution is paused
        currentActionIndex = i; // save current index for resume
        addLog('action', `execution paused at action ${i + 1} of ${actions.length}`); // log pause
        return; // exit function
      }

      const action = actions[i]; // get current action
      try {
        addLog('action', `executing (${i + 1}/${actions.length}): ${JSON.stringify(action)}`); // log action execution with progress
        // send action to content script
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (action.type === 'navigate') { // check if navigation action
          await chrome.tabs.update(tab.id, {url: action.url}); // navigate to url
          addLog('action', `navigated to: ${action.url}`); // log navigation
          await new Promise(resolve => setTimeout(resolve, 2000)); // wait for page load
        } else if (action.type === 'complete') { // check if completion action
          showTaskStatus(action.message, 'completed'); // show completion message
          addLog('action', `task completed: ${action.message}`); // log completion
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
          await new Promise(resolve => setTimeout(resolve, 1000)); // wait between actions
        } else {
          // send other actions to content script
          const response = await chrome.tabs.sendMessage(tab.id, {action: action}); // send message to content script
          if (response && response.success) { // check if action succeeded
            addLog('action', `success: ${response.result}`); // log success
          } else if (response && !response.success) { // check if action failed
            addLog('error', `action failed: ${response.error}`); // log error
            
            // attempt automatic recovery with page analysis
            const retryAction = await attemptActionRecovery(action, response.error); // try to recover
            if (retryAction) { // check if recovery action available
              addLog('action', 'attempting recovery with page analysis...'); // log recovery attempt
              const retryResponse = await chrome.tabs.sendMessage(tab.id, {action: retryAction}); // retry with new action
              if (retryResponse && retryResponse.success) { // check if retry succeeded
                addLog('action', `recovery success: ${retryResponse.result}`); // log recovery success
              } else {
                addLog('error', `recovery failed: ${retryResponse ? retryResponse.error : 'no response'}`); // log recovery failure
              }
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1000)); // wait between actions
        }
      } catch (error) {
        console.error('action execution error:', error); // log error
        const errorMsg = `Error executing action: ${error.message}`; // create error message
        showTaskStatus(errorMsg, 'error'); // show error
        addLog('error', errorMsg); // log error
        break;
      }
    }
  }

  async function attemptActionRecovery(failedAction, error) {
    try {
      // determine what type of element we're looking for based on action
      let focus = 'general';
      let question = '';
      
      if (failedAction.type === 'type' || failedAction.type === 'press_key') { // check if input action
        focus = 'search form';
        question = `what is the correct selector for the main search input field? the failed selector was: ${failedAction.selector}`;
      } else if (failedAction.type === 'click') { // check if click action
        if (failedAction.selector.includes('search') || failedAction.selector.includes('submit')) { // check if search related
          focus = 'search form';
          question = `what is the correct selector for the search/submit button? the failed selector was: ${failedAction.selector}`;
        } else {
          focus = 'navigation';
          question = `what is the correct selector for this clickable element? the failed selector was: ${failedAction.selector}`;
        }
      } else {
        return null; // no recovery for other action types
      }
      
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
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['openai_api_key'], resolve);
      });
      
      if (!result.openai_api_key) { // check if api key exists
        addLog('error', 'API key not found for selector guidance'); // log error
        return null;
      }

      const guidanceRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `you are analyzing html structure to find correct css selectors. based on the provided html, answer the specific question about what selector to use. respond with just the css selector (like input[name="q"] or #search-button) without any explanation.`
          },
          {
            role: 'user',
            content: `${question}\n\nHTML STRUCTURE:\n${pageAnalysis}`
          }
        ],
        temperature: 0.1,
        max_tokens: 50
      }; // create guidance request
      
      addLog('request', `openai guidance request: ${JSON.stringify(guidanceRequest, null, 2)}`); // log guidance request
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.openai_api_key}`
        },
        body: JSON.stringify(guidanceRequest)
      });

      if (!response.ok) { // check if request failed
        const errorText = await response.text(); // get error details
        addLog('error', `openai api error ${response.status}: ${errorText}`); // log detailed error
        throw new Error(`openai api error: ${response.status}`); // throw error
      }

      const data = await response.json(); // parse response
      const guidance = data.choices[0].message.content.trim(); // get guidance
      addLog('response', `selector guidance: ${guidance}`); // log guidance
      return guidance;
      
    } catch (error) {
      console.error('selector guidance error:', error); // log error
      addLog('error', `selector guidance failed: ${error.message}`); // log error
      return null;
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
        
        logsContainer.appendChild(logEntry); // add log entry to container
      });
      
      if (logs.length > 0) {
        logsContainer.scrollTop = logsContainer.scrollHeight; // scroll to bottom
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
      logsContainer.innerHTML = ''; // clear container
      
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
