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
    
    // get api key from storage using chrome storage api
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['openai_api_key'], resolve); // get api key
    });
    
    if (!result.openai_api_key) { // check if api key exists
      const errorMsg = 'API key not found. Please add your API key first.'; // create error message
      notifyPopup('TASK_ERROR', {error: errorMsg}); // notify popup
      currentTask = null; // clear task
      return;
    }

    // get task data using chrome storage api
    const taskResult = await new Promise((resolve) => {
      chrome.storage.local.get([`task_data_${taskId}`], resolve); // get task data
    });
    const taskData = taskResult[`task_data_${taskId}`]; // get task data
    const dataTabId = taskData ? taskData.dataTabId : null; // get data tab id

    // get current tab info using chrome tabs api
    
    const apiKey = result.openai_api_key; // get api key
    
    // get current tab info
    const tabs = await chrome.tabs.query({active: true, currentWindow: true}); // get active tab
    const currentTab = tabs[0]; // get first tab
    const currentTitle = currentTab.title || 'Unknown Page'; // get tab title
    
    console.log('starting task with instruction:', instruction); // log task start
    
    // try gpt-5 chat completion first, fallback to assistants api
    let result2;
    try {
      console.log('attempting gpt-5 chat completion...'); // log gpt-5 attempt
      result2 = await runGPT5ChatCompletion(currentTitle, instruction, apiKey); // try gpt-5 first
    } catch (gpt5Error) {
      console.log('gpt-5 failed, falling back to assistants api:', gpt5Error.message); // log fallback
      // fallback to assistants api with gpt-4o
      const assistantId = await getOrCreateAssistant(apiKey); // get or create assistant
      result2 = await runAssistantTask(assistantId, currentTitle, instruction, apiKey); // run task
    }
    
    if (result2 && result2.actions) { // check if actions exist
      await executeActionsFromIndex(result2.actions, 0); // execute actions
    } else {
      throw new Error('no actions returned from ai model'); // throw error if no actions
    }
  } catch (error) {
    console.error('task execution error:', error); // log error
    notifyPopup('TASK_FAILED', {error: error.message}); // notify popup of failure
    currentTask = null; // clear current task
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
      
      // get working tab id from task data using chrome storage api
      const taskResult = await new Promise((resolve) => {
        chrome.storage.local.get([`task_data_${currentTask.taskId}`], resolve); // get task data
      });
      const taskData = taskResult[`task_data_${currentTask.taskId}`]; // get task data
      const workingTabId = taskData ? taskData.workingTabId : null; // get working tab id
      
      // use chrome tabs api for tab management
      let tab;
      if (workingTabId) { // check if working tab id exists
        try {
          tab = await chrome.tabs.get(workingTabId); // get working tab using chrome api
        } catch (error) {
          // working tab was closed, create new one using chrome tabs api
          tab = await chrome.tabs.create({url: 'about:blank'}); // create new tab
          taskData.workingTabId = tab.id; // update working tab id
          await new Promise((resolve) => {
            chrome.storage.local.set({[`task_data_${currentTask.taskId}`]: taskData}, resolve); // save updated data
          });
        }
      } else {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true}); // get active tabs using chrome api
        tab = tabs[0]; // get first tab
      }

      if (action.type === 'navigate') { // check if navigation action
        await chrome.tabs.update(tab.id, {url: action.url}); // navigate to url
        
        // track navigation in data collection
        setTimeout(() => {
          trackNavigationInDataCollection(action.url); // track navigation after delay
        }, 1000); // wait for page to load
        
        // wait for page to load and reinject content script with verification
        await waitForPageLoadAndReinject(tab.id); // wait and reinject with verification
        
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
                  await waitForPageLoadAndReinject(tab.id); // use improved reinject function
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
    // use chrome storage api with promises
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['current_task_id'], resolve); // get task id
    });
    
    const taskId = result.current_task_id; // get task id
    if (!taskId) return; // no active task
    
    // get current task data using chrome storage api
    const taskResult = await new Promise((resolve) => {
      chrome.storage.local.get([`task_data_${taskId}`], resolve); // get task data
    });
    
    const taskData = taskResult[`task_data_${taskId}`]; // get task data
    if (!taskData) return; // no task data found

    // use chrome tabs api for tab management
    const workingTabId = taskData.workingTabId; // get working tab id
    let tab;
    if (workingTabId) { // check if working tab id exists
      try {
        tab = await chrome.tabs.get(workingTabId); // get working tab using chrome api
      } catch (error) {
        // working tab was closed, create new one using chrome tabs api
        tab = await chrome.tabs.create({url: 'about:blank'}); // create new tab
        taskData.workingTabId = tab.id; // update working tab id
        await new Promise((resolve) => {
          chrome.storage.local.set({[`task_data_${taskId}`]: taskData}, resolve); // save updated data
        });
      }
    } else {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true}); // get active tabs using chrome api
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
    
    // save to chrome storage using promise
    await new Promise((resolve) => {
      chrome.storage.local.set({[`task_data_${taskId}`]: taskData}, resolve); // save updated data
    });
    
    // notify data collection tab using chrome runtime messaging
    try {
      await chrome.tabs.sendMessage(taskData.dataTabId, {
        type: 'UPDATE_TASK_DATA',
        taskData: taskData
      }); // send update message
      console.log('sent url update to data collection tab:', tab.url); // log success
    } catch (error) {
      console.log('could not send message to data collection tab:', error); // log error
      // try alternative method using chrome scripting api
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
        console.log('updated data collection tab via chrome scripting api'); // log success
      } catch (scriptError) {
        console.log('chrome scripting api also failed:', scriptError); // log error
      }
    }
  } catch (error) {
    console.log('error tracking navigation:', error.message); // log error
  }
}

async function getOrCreateAssistant(apiKey) {
  // check if assistant id is stored
  const result = await new Promise((resolve) => {
    chrome.storage.local.get(['assistant_id'], resolve); // get stored assistant id
  });
  
  if (result.assistant_id) { // check if assistant exists
    console.log('using existing assistant:', result.assistant_id); // log existing assistant
    return result.assistant_id; // return existing assistant id
  }
  
  console.log('creating new assistant...'); // log assistant creation
  // create new assistant with persistent tools and instructions
  const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      name: "Web Automation Assistant",
      instructions: `You are a web automation assistant that helps users navigate and interact with web pages. You analyze the current page and provide structured actions to accomplish user goals.

Current capabilities:
- Navigate to URLs
- Click on elements (buttons, links, etc.)
- Type text into input fields
- Press keys (Enter, Tab, etc.)
- Submit forms
- Scroll pages
- Extract information from pages
- Analyze page content
- Wait for page loads
- Complete tasks

Always respond with a structured list of actions in the specified JSON format. Be precise with selectors and provide clear, actionable steps.`,
      model: "gpt-4o",
    tools: [
      {
        type: "function",
        function: {
          name: "web_automation_actions",
          description: "execute a sequence of web automation actions to complete the user's task",
          parameters: {
            type: "object",
            properties: {
              actions: {
                type: "array",
                description: "array of actions to perform in sequence",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["navigate", "click", "type", "press_key", "submit", "scroll", "extract", "analyze_page", "wait", "complete"],
                      description: "type of action to perform"
                    },
                    url: { type: "string", description: "url to navigate to (for navigate action)" },
                    selector: { type: "string", description: "css selector for the target element" },
                    text: { type: "string", description: "text to type into an input field" },
                    key: { type: "string", description: "key to press (e.g., 'Enter', 'Tab')" },
                    direction: { type: "string", enum: ["up", "down"], description: "scroll direction" },
                    seconds: { type: "number", description: "number of seconds to wait" },
                    message: { type: "string", description: "completion message for complete action" },
                    focus: { type: "string", description: "focus area for page analysis" },
                    question: { type: "string", description: "specific question for page analysis" },
                    description: { type: "string", description: "description of what to extract" }
                  },
                  required: ["type"],
                  additionalProperties: false
                }
              }
            },
            required: ["actions"],
            additionalProperties: false
          }
        }
      }
    ]
  })
});

if (!assistantResponse.ok) { // check if assistant creation failed
  const errorText = await assistantResponse.text(); // get error details
  console.error('assistant creation failed:', assistantResponse.status, errorText); // log error
  throw new Error(`failed to create assistant: ${assistantResponse.status} - ${errorText}`); // throw error
}

const assistant = await assistantResponse.json(); // parse assistant response
console.log('assistant created successfully:', assistant.id); // log success

// store assistant id for reuse
await new Promise((resolve) => {
  chrome.storage.local.set({'assistant_id': assistant.id}, resolve); // save assistant id
});

return assistant.id; // return new assistant id
}

async function runGPT5ChatCompletion(currentTitle, instruction, apiKey) {
  console.log('running gpt-5 chat completion...'); // log gpt-5 start
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: `You are a web automation assistant that helps users navigate and interact with web pages. You analyze the current page and provide structured actions to accomplish user goals.

Current capabilities:
- Navigate to URLs
- Click on elements (buttons, links, etc.)
- Type text into input fields
- Press keys (Enter, Tab, etc.)
- Submit forms
- Scroll pages
- Extract information from pages
- Analyze page content
- Wait for page loads
- Complete tasks

Always respond with a structured list of actions in the specified JSON format. Be precise with selectors and provide clear, actionable steps.`
        },
        {
          role: 'user',
          content: `Current page: ${currentTitle}\n\nUser instruction: ${instruction}`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "web_automation_actions",
            description: "execute a sequence of web automation actions to complete the user's task",
            parameters: {
              type: "object",
              properties: {
                actions: {
                  type: "array",
                  description: "array of actions to perform in sequence",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["navigate", "click", "type", "press_key", "submit", "scroll", "extract", "analyze_page", "wait", "complete"],
                        description: "type of action to perform"
                      },
                      url: {
                        type: "string",
                        description: "url to navigate to (for navigate action)"
                      },
                      selector: {
                        type: "string", 
                        description: "css selector for element to interact with"
                      },
                      text: {
                        type: "string",
                        description: "text to type or extract"
                      },
                      key: {
                        type: "string",
                        description: "key to press (for press_key action)"
                      },
                      direction: {
                        type: "string",
                        enum: ["up", "down", "left", "right"],
                        description: "scroll direction"
                      },
                      pixels: {
                        type: "number",
                        description: "number of pixels to scroll"
                      },
                      duration: {
                        type: "number",
                        description: "wait duration in milliseconds"
                      },
                      message: {
                        type: "string",
                        description: "completion message or analysis result"
                      }
                    },
                    required: ["type"],
                    additionalProperties: false
                  }
                }
              },
              required: ["actions"],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "web_automation_actions" } }
    })
  });

  if (!response.ok) { // check if response failed
    const errorText = await response.text(); // get error details
    console.error('gpt-5 chat completion failed:', response.status, errorText); // log error
    throw new Error(`gpt-5 chat completion failed: ${response.status} - ${errorText}`); // throw error
  }
  
  const result = await response.json(); // parse response
  console.log('gpt-5 response:', JSON.stringify(result, null, 2)); // log response
  
  if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.tool_calls) { // check for tool calls
    const toolCall = result.choices[0].message.tool_calls[0]; // get first tool call
    if (toolCall.type === 'function') { // check if function call
      console.log('gpt-5 function call:', toolCall.function.name, toolCall.function.arguments); // log function call
      try {
        return JSON.parse(toolCall.function.arguments); // parse and return function arguments
      } catch (e) {
        console.error('failed to parse gpt-5 function arguments:', toolCall.function.arguments); // log parse error
        throw new Error('failed to parse gpt-5 function call arguments as json'); // throw parse error
      }
    }
  }
  
  throw new Error('no valid function call found in gpt-5 response'); // throw error
}

async function runAssistantTask(assistantId, currentTitle, instruction, apiKey) {
  console.log('creating thread for assistant task...'); // log thread creation
  // create a new thread for this task
  const threadResponse = await fetch('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({})
  });
  
  if (!threadResponse.ok) { // check if thread creation failed
    const errorText = await threadResponse.text(); // get error details
    console.error('thread creation failed:', threadResponse.status, errorText); // log error
    throw new Error(`failed to create thread: ${threadResponse.status} - ${errorText}`); // throw error
  }
  
  const thread = await threadResponse.json(); // parse thread response
  console.log('thread created:', thread.id); // log thread id
  
  console.log('adding message to thread...'); // log message addition
  const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      role: "user",
      content: `Current page: ${currentTitle}\n\nUser instruction: ${instruction}`
    })
  });
  
  if (!messageResponse.ok) { // check if message creation failed
    const errorText = await messageResponse.text(); // get error details
    console.error('message creation failed:', messageResponse.status, errorText); // log error
    throw new Error(`failed to add message: ${messageResponse.status} - ${errorText}`); // throw error
  }
  
  console.log('message added to thread'); // log success
  
  // run assistant
  console.log('starting assistant run...'); // log run start
  const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      assistant_id: assistantId
    })
  });
  
  if (!runResponse.ok) { // check if run creation failed
    const errorText = await runResponse.text(); // get error details
    console.error('run creation failed:', runResponse.status, errorText); // log error
    throw new Error(`failed to start run: ${runResponse.status} - ${errorText}`); // throw error
  }
  
  const run = await runResponse.json(); // parse run response
  console.log('run started:', run.id, 'status:', run.status); // log run details
  
  // wait for run completion and get result
  return await waitForRunCompletion(thread.id, run.id, apiKey); // wait for completion
}

async function waitForRunCompletion(threadId, runId, apiKey) {
  let attempts = 0; // initialize attempts counter
  const maxAttempts = 30; // maximum attempts
  
  while (attempts < maxAttempts) { // loop until completion or max attempts
    console.log(`checking run status (attempt ${attempts + 1}/${maxAttempts})...`); // log attempt
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    if (!runResponse.ok) { // check if run status check failed
      const errorText = await runResponse.text(); // get error details
      console.error('run status check failed:', runResponse.status, errorText); // log error
      throw new Error(`failed to check run status: ${runResponse.status} - ${errorText}`); // throw error
    }
    
    const run = await runResponse.json(); // parse run response
    console.log('run status:', run.status); // log current status
    
    if (run.status === 'completed') { // check if run completed
      console.log('run completed, getting messages...'); // log completion
      // get messages from thread
      const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      if (!messagesResponse.ok) { // check if messages retrieval failed
        const errorText = await messagesResponse.text(); // get error details
        console.error('messages retrieval failed:', messagesResponse.status, errorText); // log error
        throw new Error(`failed to get messages: ${messagesResponse.status} - ${errorText}`); // throw error
      }
      
      const messages = await messagesResponse.json(); // parse messages response
      console.log('found', messages.data.length, 'messages'); // log message count
      
      // find assistant's response with function call
      const assistantMessage = messages.data.find(msg => msg.role === 'assistant'); // find assistant message
      if (assistantMessage) { // check if assistant message exists
        console.log('assistant message content:', JSON.stringify(assistantMessage.content, null, 2)); // log content
        
        // check for tool calls (function calls)
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) { // check for tool calls
          const toolCall = assistantMessage.tool_calls[0]; // get first tool call
          if (toolCall.type === 'function') { // check if function call
            console.log('found function call:', toolCall.function.name); // log function name
            try {
              return JSON.parse(toolCall.function.arguments); // parse and return function arguments
            } catch (e) {
              console.error('failed to parse function arguments:', toolCall.function.arguments); // log parse error
              throw new Error('failed to parse function call arguments as json'); // throw parse error
            }
          }
        }
        
        // fallback: check text content for json
        if (assistantMessage.content[0] && assistantMessage.content[0].type === 'text') { // check if text content
          const content = assistantMessage.content[0].text.value; // get text content
          console.log('assistant text content:', content); // log text content
          try {
            return JSON.parse(content); // parse and return json content
          } catch (e) {
            console.error('failed to parse text content as json:', content); // log parse error
            throw new Error('failed to parse assistant response as json'); // throw parse error
          }
        }
      }
      
      throw new Error('no valid function call found in assistant response'); // throw error
    } else if (run.status === 'failed') { // check if run failed
      throw new Error(`assistant run failed: ${run.last_error?.message || 'unknown error'}`); // throw error
    }
    
    attempts++; // increment attempts
    await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second before retry
  }
  
  throw new Error('assistant run timed out'); // throw timeout error
}

async function waitForPageLoadAndReinject(tabId) {
  // wait for page to be ready and reinject content script with verification
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    try {
      // check if tab is loading
      const tab = await chrome.tabs.get(tabId); // get tab status
      if (tab.status === 'complete') { // check if page loaded
        // wait a bit more for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 500)); // additional wait
        
        // reinject content script
        if (chrome.scripting && chrome.scripting.executeScript) { // check if scripting api available
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }); // reinject content script
        }
        
        // verify content script is responsive
        await new Promise(resolve => setTimeout(resolve, 300)); // wait for script to initialize
        
        try {
          await chrome.tabs.sendMessage(tabId, { action: { type: 'wait', seconds: 0 } }); // test message
          console.log('content script successfully reinjected and verified'); // log success
          return; // success
        } catch (testError) {
          console.log('content script not responsive yet, retrying...'); // log retry
        }
      }
    } catch (error) {
      console.log('error during reinject attempt:', error.message); // log error
    }
    
    attempts++; // increment attempts
    await new Promise(resolve => setTimeout(resolve, 500)); // wait before retry
  }
  
  throw new Error('failed to reinject content script after multiple attempts'); // throw error after max attempts
}

function notifyPopup(type, data) {
  // try to send message to popup if it's open
  chrome.runtime.sendMessage({type: type, data: data}).catch(() => {
    // popup is closed, ignore error
  });
}
