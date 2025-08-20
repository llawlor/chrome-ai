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
  clearLogsBtn.addEventListener('click', function() {
    logsContent.innerHTML = ''; // clear logs content
    addLog('system', 'logs cleared'); // add system log
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

  function loadApiKey() {
    // load api key from chrome storage
    chrome.storage.local.get(['openai_api_key'], function(result) {
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
    } else {
      mainInterface.classList.add('hidden'); // hide main interface
      logsSection.classList.add('hidden'); // hide logs section
    }
  }

  function addLog(type, content) {
    const timestamp = new Date().toLocaleTimeString(); // get current timestamp
    const logEntry = document.createElement('div'); // create log entry element
    logEntry.className = `log-entry ${type}`; // set log entry class
    
    logEntry.innerHTML = `
      <div class="log-timestamp">[${timestamp}] ${type.toUpperCase()}</div>
      <div class="log-content">${content}</div>
    `; // set log entry content
    
    logsContent.appendChild(logEntry); // add log entry to logs content
    logsContainer.scrollTop = logsContainer.scrollHeight; // scroll to bottom
  }

  function showTaskStatus(message, type) {
    taskStatus.textContent = message; // set task status message
    taskStatus.className = `task-status ${type}`; // set task status class for styling
    taskStatus.style.display = 'block'; // show task status element
  }

  async function executeTask(instruction) {
    try {
      submitBtn.disabled = true; // disable submit button
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

current page: ${currentTitle} (${currentUrl})

important: when filling out search forms or inputs, always follow up with submitting the form by either:
- clicking the search/submit button (preferred)
- pressing enter key on the input field
- submitting the form element

respond with json containing an array of actions to perform:
{
  "actions": [
    {"type": "navigate", "url": "https://example.com"},
    {"type": "click", "selector": ".button-class"},
    {"type": "type", "selector": "#input-id", "text": "text to type"},
    {"type": "submit", "selector": "#form-id"},
    {"type": "press_key", "selector": "#input-id", "key": "Enter"},
    {"type": "scroll", "direction": "down"},
    {"type": "extract", "selector": ".content", "description": "what to extract"},
    {"type": "wait", "seconds": 2},
    {"type": "complete", "message": "task completed successfully"}
  ]
}

example for amazon search:
1. navigate to amazon.com
2. type search term in search box
3. click search button or press enter to execute search
4. extract results or complete task`
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
      await executeActions(actions); // execute the actions

    } catch (error) {
      console.error('task execution error:', error); // log error
      const errorMsg = `Error: ${error.message}`; // create error message
      showTaskStatus(errorMsg, 'error'); // show error status
      addLog('error', errorMsg); // log error
    } finally {
      submitBtn.disabled = false; // re-enable submit button
    }
  }

  async function executeActions(actions) {
    for (const action of actions) { // iterate through actions
      try {
        addLog('action', `executing: ${JSON.stringify(action)}`); // log action execution
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
        } else {
          // send other actions to content script
          const response = await chrome.tabs.sendMessage(tab.id, {action: action}); // send message to content script
          if (response && response.success) { // check if action succeeded
            addLog('action', `success: ${response.result}`); // log success
          } else if (response && !response.success) { // check if action failed
            addLog('error', `action failed: ${response.error}`); // log error
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
