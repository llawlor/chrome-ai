// content script - handles web automation actions from popup
console.log('content script loaded'); // log when content script loads

// listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action) { // check if action is provided
    executeAction(request.action) // execute the action
      .then(result => sendResponse({success: true, result: result})) // send success response
      .catch(error => sendResponse({success: false, error: error.message})); // send error response
    return true; // keep message channel open for async response
  }
});

async function executeAction(action) {
  switch (action.type) { // check action type
    case 'click':
      return await clickElement(action.selector); // click element
    case 'type':
      return await typeText(action.selector, action.text); // type text
    case 'scroll':
      return await scrollPage(action.direction); // scroll page
    case 'extract':
      return await extractContent(action.selector, action.description); // extract content
    case 'wait':
      return await waitSeconds(action.seconds); // wait specified seconds
    default:
      throw new Error(`unknown action type: ${action.type}`); // throw error for unknown action
  }
}

async function clickElement(selector) {
  const element = document.querySelector(selector); // find element by selector
  if (!element) { // check if element exists
    throw new Error(`element not found: ${selector}`); // throw error
  }
  
  element.scrollIntoView({behavior: 'smooth', block: 'center'}); // scroll element into view
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for scroll
  
  element.click(); // click the element
  return `clicked element: ${selector}`; // return success message
}

async function typeText(selector, text) {
  const element = document.querySelector(selector); // find element by selector
  if (!element) { // check if element exists
    throw new Error(`element not found: ${selector}`); // throw error
  }
  
  element.scrollIntoView({behavior: 'smooth', block: 'center'}); // scroll element into view
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for scroll
  
  element.focus(); // focus on element
  element.value = text; // set element value
  
  // trigger input events
  element.dispatchEvent(new Event('input', {bubbles: true})); // dispatch input event
  element.dispatchEvent(new Event('change', {bubbles: true})); // dispatch change event
  
  return `typed text into ${selector}: ${text}`; // return success message
}

async function scrollPage(direction) {
  const scrollAmount = window.innerHeight * 0.8; // calculate scroll amount
  
  if (direction === 'down') { // check if scrolling down
    window.scrollBy(0, scrollAmount); // scroll down
  } else if (direction === 'up') { // check if scrolling up
    window.scrollBy(0, -scrollAmount); // scroll up
  } else {
    throw new Error(`invalid scroll direction: ${direction}`); // throw error
  }
  
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for scroll
  return `scrolled ${direction}`; // return success message
}

async function extractContent(selector, description) {
  const elements = document.querySelectorAll(selector); // find elements by selector
  if (elements.length === 0) { // check if elements exist
    throw new Error(`no elements found: ${selector}`); // throw error
  }
  
  const content = Array.from(elements).map(el => el.textContent.trim()).join('\n'); // extract text content
  return `extracted content (${description}): ${content}`; // return extracted content
}

async function waitSeconds(seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000)); // wait specified seconds
  return `waited ${seconds} seconds`; // return success message
}
