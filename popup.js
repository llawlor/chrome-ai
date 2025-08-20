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

  // load existing api key on popup open
  loadApiKey();

  // toggle api key section visibility when link is clicked
  apiKeyLink.addEventListener('click', function() {
    apiKeySection.classList.toggle('hidden'); // toggle hidden class
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
    } else {
      mainInterface.classList.add('hidden'); // hide main interface
    }
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
      
      // get api key from storage
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['openai_api_key'], resolve);
      });
      
      if (!result.openai_api_key) { // check if api key exists
        showStatus('API key not found. Please add your API key first.', 'error'); // show error message
        return;
      }

      // get current tab info
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const currentUrl = tab.url; // get current tab url
      const currentTitle = tab.title; // get current tab title

      // prepare openai request
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.openai_api_key}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `you are an ai assistant that helps users navigate and interact with websites. you can:
1. navigate to websites by providing urls
2. click on links and buttons by providing css selectors
3. fill out forms by providing selectors and values
4. extract information from pages
5. scroll and interact with page elements

current page: ${currentTitle} (${currentUrl})

respond with json containing an array of actions to perform:
{
  "actions": [
    {"type": "navigate", "url": "https://example.com"},
    {"type": "click", "selector": ".button-class"},
    {"type": "type", "selector": "#input-id", "text": "text to type"},
    {"type": "scroll", "direction": "down"},
    {"type": "extract", "selector": ".content", "description": "what to extract"},
    {"type": "wait", "seconds": 2},
    {"type": "complete", "message": "task completed successfully"}
  ]
}`
            },
            {
              role: 'user',
              content: instruction
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) { // check if request failed
        throw new Error(`openai api error: ${response.status}`); // throw error
      }

      const data = await response.json(); // parse response
      const aiResponse = data.choices[0].message.content; // get ai response
      
      // parse ai response as json
      let actions;
      try {
        const parsed = JSON.parse(aiResponse); // parse json response
        actions = parsed.actions; // get actions array
      } catch (e) {
        throw new Error('invalid response format from ai'); // throw error
      }

      // execute actions via content script
      await executeActions(actions); // execute the actions

    } catch (error) {
      console.error('task execution error:', error); // log error
      showTaskStatus(`Error: ${error.message}`, 'error'); // show error status
    } finally {
      submitBtn.disabled = false; // re-enable submit button
    }
  }

  async function executeActions(actions) {
    for (const action of actions) { // iterate through actions
      try {
        // send action to content script
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (action.type === 'navigate') { // check if navigation action
          await chrome.tabs.update(tab.id, {url: action.url}); // navigate to url
          await new Promise(resolve => setTimeout(resolve, 2000)); // wait for page load
        } else if (action.type === 'complete') { // check if completion action
          showTaskStatus(action.message, 'completed'); // show completion message
          break;
        } else {
          // send other actions to content script
          await chrome.tabs.sendMessage(tab.id, {action: action}); // send message to content script
          await new Promise(resolve => setTimeout(resolve, 1000)); // wait between actions
        }
      } catch (error) {
        console.error('action execution error:', error); // log error
        showTaskStatus(`Error executing action: ${error.message}`, 'error'); // show error
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
