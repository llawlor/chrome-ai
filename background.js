// background service worker - handles persistent task execution
console.log('background script loaded'); // log when background script loads

let currentTask = null; // store current task execution state
let isPaused = false; // track pause state
let currentActions = []; // store current actions
let currentActionIndex = 0; // track current action index

// listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_TASK') { // handle task start
    startTask(request.instruction, request.taskId); // start task execution
    sendResponse({success: true}); // send response
  } else if (request.type === 'PAUSE_TASK') { // handle task pause
    isPaused = true; // pause execution
    sendResponse({success: true}); // send response
  } else if (request.type === 'RESUME_TASK') { // handle task resume
    isPaused = false; // resume execution
    if (currentActions.length > 0) { // check if actions to resume
      executeActionsFromIndex(currentActions, currentActionIndex); // resume from current index
    }
    sendResponse({success: true}); // send response
  } else if (request.type === 'GET_TASK_STATUS') { // handle status request
    sendResponse({
      isRunning: currentTask !== null,
      isPaused: isPaused,
      currentActionIndex: currentActionIndex,
      totalActions: currentActions.length
    }); // send task status
  }
  return true; // keep message channel open
});

async function startTask(instruction, taskId) {
  try {
    currentTask = {instruction, taskId}; // store task info
    isPaused = false; // reset pause state
    currentActionIndex = 0; // reset action index
    
    // notify popup of task start
    notifyPopup('TASK_STARTED', {instruction, taskId}); // notify popup
    
    // get api key from storage
    const result = await chrome.storage.local.get(['openai_api_key']); // get api key
    
    if (!result.openai_api_key) { // check if api key exists
      const errorMsg = 'API key not found. Please add your API key first.'; // create error message
      notifyPopup('TASK_ERROR', {error: errorMsg}); // notify popup
      currentTask = null; // clear task
      return;
    }

    // get task data to find data collection tab
    const taskResult = await chrome.storage.local.get([`task_data_${taskId}`]); // get task data
    const taskData = taskResult[`task_data_${taskId}`]; // get task data
    const dataTabId = taskData ? taskData.dataTabId : null; // get data tab id

    // get current tab info (but exclude data collection tab)
    const tabs = await chrome.tabs.query({active: true, currentWindow: true}); // get active tabs
    let workingTab = tabs[0]; // get first tab
    
    // if current tab is data collection tab, create new working tab
    if (workingTab.id === dataTabId) { // check if current tab is data tab
      workingTab = await chrome.tabs.create({url: 'about:blank'}); // create new working tab
      await chrome.tabs.update(workingTab.id, {active: true}); // make it active
    }
    
    // store working tab id in task data
    if (taskData) { // check if task data exists
      taskData.workingTabId = workingTab.id; // store working tab id
      await chrome.storage.local.set({[`task_data_${taskId}`]: taskData}); // save updated data
    }
    
    const currentUrl = workingTab.url; // get current tab url
    const currentTitle = workingTab.title; // get current tab title
    
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
      max_completion_tokens: 1500
    }; // create request body

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.openai_api_key}`
      },
      body: JSON.stringify(requestBody)
    }); // make api request

    if (!response.ok) { // check if request failed
      const errorText = await response.text(); // get error details
      throw new Error(`openai api error: ${response.status} - ${errorText}`); // throw error
    }

    const data = await response.json(); // parse response
    const aiResponse = data.choices[0].message.content; // get ai response

    // check if response is empty or null
    if (!aiResponse || aiResponse.trim() === '') { // check for empty response
      throw new Error('received empty response from ai'); // throw error
    }

    // parse ai response as json
    let actions;
    try {
      const parsed = JSON.parse(aiResponse); // parse json response
      actions = parsed.actions; // get actions array
      
      // validate actions array exists and is not empty
      if (!actions || !Array.isArray(actions) || actions.length === 0) { // check for valid actions
        throw new Error('no valid actions found in response'); // throw error
      }
    } catch (e) {
      throw new Error('invalid response format from ai'); // throw error
    }

    // execute actions
    currentActions = actions; // store actions for pause/resume
    currentActionIndex = 0; // reset action index
    await executeActions(actions); // execute actions

  } catch (error) {
    console.error('task execution error:', error); // log error
    notifyPopup('TASK_ERROR', {error: error.message}); // notify popup
    currentTask = null; // clear task
  }
}

async function executeActions(actions) {
  return await executeActionsFromIndex(actions, 0); // start from beginning
}

async function executeActionsFromIndex(actions, startIndex) {
  for (let i = startIndex; i < actions.length; i++) { // loop through actions
    if (isPaused) { // check if paused
      currentActionIndex = i; // save current index
      notifyPopup('TASK_PAUSED', {currentActionIndex: i, totalActions: actions.length}); // notify popup
      return; // exit function
    }
    
    const action = actions[i]; // get current action
    currentActionIndex = i; // update current index
    
    // notify popup of current action
    notifyPopup('ACTION_EXECUTING', {
      action: action,
      index: i,
      total: actions.length
    }); // notify popup
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300)); // wait between actions
      
      // get working tab id from task data
      const taskResult = await chrome.storage.local.get([`task_data_${currentTask.taskId}`]); // get task data
      const taskData = taskResult[`task_data_${currentTask.taskId}`]; // get task data
      const workingTabId = taskData ? taskData.workingTabId : null; // get working tab id
      
      // use working tab if available, otherwise get active tab
      let tab;
      if (workingTabId) { // check if working tab id exists
        try {
          tab = await chrome.tabs.get(workingTabId); // get working tab
        } catch (error) {
          // working tab was closed, create new one
          tab = await chrome.tabs.create({url: 'about:blank'}); // create new tab
          taskData.workingTabId = tab.id; // update working tab id
          await chrome.storage.local.set({[`task_data_${currentTask.taskId}`]: taskData}); // save updated data
        }
      } else {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true}); // get active tabs
        tab = tabs[0]; // get first tab
      }

      if (action.type === 'navigate') { // check if navigation action
        await chrome.tabs.update(tab.id, {url: action.url}); // navigate to url
        
        // track navigation in data collection
        setTimeout(() => {
          trackNavigationInDataCollection(action.url); // track navigation after delay
        }, 1000); // wait for page to load
        
        // wait for page to load and reinject content script
        await new Promise(resolve => setTimeout(resolve, 2000)); // wait for navigation
        
        try {
          // reinject content script after navigation
          if (chrome.scripting && chrome.scripting.executeScript) { // check if scripting api available
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }); // reinject content script
          }
        } catch (reinjectError) {
          console.log('content script reinject failed:', reinjectError.message); // log reinject failure
        }
        
      } else if (action.type === 'complete') { // check if completion action
        notifyPopup('TASK_COMPLETED', {message: action.message}); // notify popup
        currentTask = null; // clear task
        break;
        
      } else if (action.type === 'wait') { // check if wait action
        await new Promise(resolve => setTimeout(resolve, action.seconds * 1000)); // wait specified seconds
        notifyPopup('ACTION_SUCCESS', {result: `waited ${action.seconds} seconds`}); // notify popup
        
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
              if (retryCount < maxRetries) { // check if more retries available
                // wait and try to reinject content script
                await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second
                
                try {
                  if (chrome.scripting && chrome.scripting.executeScript) { // check if scripting api available
                    await chrome.scripting.executeScript({
                      target: { tabId: tab.id },
                      files: ['content.js']
                    }); // reinject content script
                  }
                } catch (reinjectError) {
                  console.log('reinject failed on retry:', reinjectError.message); // log reinject failure
                }
              }
            } else {
              throw error; // rethrow non-cache errors immediately
            }
          }
        }
        
        if (!response && retryCount >= maxRetries) { // check if all retries failed
          throw new Error('failed to communicate with content script after retries'); // throw error
        }
        
        if (!response) { // check if no response received
          throw new Error('no response from content script'); // throw error
        }
        
        if (response && response.success) { // check if action succeeded
          notifyPopup('ACTION_SUCCESS', {result: response.result}); // notify popup
        } else {
          const errorMsg = response.error || 'action failed with unknown error'; // create error message
          throw new Error(errorMsg); // throw error
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // wait between actions
      
    } catch (error) {
      console.error('action execution error:', error); // log error to console
      notifyPopup('ACTION_ERROR', {error: error.message, action: action}); // notify popup
      
      // stop execution and mark task as failed
      notifyPopup('TASK_FAILED', {error: error.message}); // notify popup
      currentTask = null; // clear task
      return; // exit function to prevent further execution
    }
  }
  
  // task completed successfully
  if (!isPaused && currentTask) { // check if not paused and task still active
    notifyPopup('TASK_COMPLETED', {message: 'task completed successfully'}); // notify popup
    currentTask = null; // clear task
  }
}

async function trackNavigationInDataCollection(url) {
  try {
    // get current task id
    const result = await chrome.storage.local.get(['current_task_id']); // get task id
    const taskId = result.current_task_id; // get task id
    if (!taskId) return; // no active task
    
    // get current task data
    const taskResult = await chrome.storage.local.get([`task_data_${taskId}`]); // get task data
    const taskData = taskResult[`task_data_${taskId}`]; // get task data
    if (!taskData) return; // no task data found

    // get working tab id from task data
    const workingTabId = taskData.workingTabId; // get working tab id
    let tab;
    if (workingTabId) { // check if working tab id exists
      try {
        tab = await chrome.tabs.get(workingTabId); // get working tab
      } catch (error) {
        // working tab was closed, create new one
        tab = await chrome.tabs.create({url: 'about:blank'}); // create new tab
        taskData.workingTabId = tab.id; // update working tab id
        await chrome.storage.local.set({[`task_data_${taskId}`]: taskData}); // save updated data
      }
    } else {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true}); // get active tabs
      tab = tabs[0]; // get first tab
    }

    const timestamp = new Date().toLocaleTimeString(); // get timestamp
    
    // check if url already exists to avoid duplicates
    const urlExists = taskData.urls.some(urlData => urlData.url === tab.url); // check for duplicate
    if (urlExists) return; // skip if duplicate
    
    // update task data with new url
    taskData.urls.push({
      url: tab.url,
      timestamp: new Date().toLocaleString()
    }); // add url to list
    await chrome.storage.local.set({[`task_data_${taskId}`]: taskData}); // save updated data
    
    // notify data collection tab of update
    try {
      await chrome.tabs.sendMessage(taskData.dataTabId, {
        type: 'UPDATE_TASK_DATA',
        taskData: taskData
      }); // send update message
      console.log('sent url update to data collection tab:', tab.url); // log success
    } catch (error) {
      console.log('could not send message to data collection tab:', error); // log error
      // try alternative method - execute script directly
      try {
        await chrome.scripting.executeScript({
          target: { tabId: taskData.dataTabId },
          func: (taskData) => {
            if (window.updateTaskData) {
              window.updateTaskData(taskData);
            }
          },
          args: [taskData]
        });
        console.log('updated data collection tab via script injection'); // log success
      } catch (scriptError) {
        console.log('script injection also failed:', scriptError); // log error
      }
    }
  } catch (error) {
    console.log('error tracking navigation:', error.message); // log error
  }
}

function notifyPopup(type, data) {
  // try to send message to popup if it's open
  chrome.runtime.sendMessage({type: type, data: data}).catch(() => {
    // popup is closed, ignore error
  });
}
