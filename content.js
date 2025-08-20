// content script - handles web automation actions from popup
console.log('content script loaded'); // log when content script loads

// listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action) { // check if action is provided
    console.log('content script executing action:', request.action); // log action execution
    executeAction(request.action) // execute the action
      .then(result => {
        console.log('content script action success:', result); // log success
        sendResponse({success: true, result: result}); // send success response
      })
      .catch(error => {
        console.error('content script action error:', error); // log error
        sendResponse({success: false, error: error.message}); // send error response
      });
    return true; // keep message channel open for async response
  }
});

async function executeAction(action) {
  switch (action.type) { // check action type
    case 'click':
      return await clickElement(action.selector); // click element
    case 'type':
      return await typeText(action.selector, action.text); // type text
    case 'submit':
      return await submitForm(action.selector); // submit form
    case 'press_key':
      return await pressKey(action.selector, action.key); // press key
    case 'scroll':
      return await scrollPage(action.direction); // scroll page
    case 'extract':
      return await extractContent(action.selector, action.description); // extract content
    case 'analyze_page':
      return await analyzePage(action.focus, action.question); // analyze page structure
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

async function submitForm(selector) {
  const element = document.querySelector(selector); // find element by selector
  if (!element) { // check if element exists
    throw new Error(`element not found: ${selector}`); // throw error
  }
  
  // check if element is a form
  if (element.tagName.toLowerCase() === 'form') { // check if form element
    element.submit(); // submit form
    return `submitted form: ${selector}`; // return success message
  } else {
    // try to find parent form
    const form = element.closest('form'); // find closest form
    if (form) { // check if form found
      form.submit(); // submit form
      return `submitted form containing: ${selector}`; // return success message
    } else {
      throw new Error(`no form found for element: ${selector}`); // throw error
    }
  }
}

async function pressKey(selector, key) {
  const element = document.querySelector(selector); // find element by selector
  if (!element) { // check if element exists
    throw new Error(`element not found: ${selector}`); // throw error
  }
  
  element.scrollIntoView({behavior: 'smooth', block: 'center'}); // scroll element into view
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for scroll
  
  element.focus(); // focus on element
  
  // create and dispatch keydown event
  const keydownEvent = new KeyboardEvent('keydown', {
    key: key,
    code: key === 'Enter' ? 'Enter' : key,
    keyCode: key === 'Enter' ? 13 : key.charCodeAt(0),
    which: key === 'Enter' ? 13 : key.charCodeAt(0),
    bubbles: true
  });
  element.dispatchEvent(keydownEvent); // dispatch keydown event
  
  // create and dispatch keyup event
  const keyupEvent = new KeyboardEvent('keyup', {
    key: key,
    code: key === 'Enter' ? 'Enter' : key,
    keyCode: key === 'Enter' ? 13 : key.charCodeAt(0),
    which: key === 'Enter' ? 13 : key.charCodeAt(0),
    bubbles: true
  });
  element.dispatchEvent(keyupEvent); // dispatch keyup event
  
  return `pressed ${key} on element: ${selector}`; // return success message
}

async function analyzePage(focus, question) {
  let htmlContent = ''; // initialize html content
  
  if (focus === 'search form') { // check if analyzing search form
    // find all forms and inputs with broader selectors
    const forms = document.querySelectorAll('form'); // find all forms
    const allInputs = document.querySelectorAll('input, textarea'); // find all input elements
    const searchInputs = Array.from(allInputs).filter(input => 
      input.type === 'search' || 
      input.type === 'text' || 
      input.name === 'q' ||
      input.placeholder?.toLowerCase().includes('search') ||
      input.getAttribute('aria-label')?.toLowerCase().includes('search') ||
      input.getAttribute('title')?.toLowerCase().includes('search')
    ); // filter for search-related inputs
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]'); // find all buttons
    
    htmlContent += 'FORMS:\n'; // add forms header
    forms.forEach((form, i) => {
      htmlContent += `Form ${i + 1}: ${form.outerHTML.substring(0, 800)}\n\n`; // add form html (less truncated)
    });
    
    htmlContent += 'ALL INPUTS:\n'; // add all inputs header
    allInputs.forEach((input, i) => {
      if (i < 10) { // limit to first 10 inputs
        htmlContent += `Input ${i + 1}: ${input.outerHTML}\n`; // add input html
      }
    });
    
    htmlContent += 'SEARCH-RELATED INPUTS:\n'; // add search inputs header
    searchInputs.forEach((input, i) => {
      htmlContent += `SearchInput ${i + 1}: ${input.outerHTML}\n`; // add search input html
    });
    
    htmlContent += 'BUTTONS:\n'; // add buttons header
    buttons.forEach((button, i) => {
      if (i < 10) { // limit to first 10 buttons
        htmlContent += `Button ${i + 1}: ${button.outerHTML}\n`; // add button html
      }
    });
  } else if (focus === 'navigation') { // check if analyzing navigation
    const links = document.querySelectorAll('a, nav a, [role="navigation"] a'); // find navigation links
    htmlContent += 'NAVIGATION LINKS:\n'; // add links header
    links.forEach((link, i) => {
      if (i < 20) { // limit to first 20 links
        htmlContent += `Link ${i + 1}: ${link.outerHTML}\n`; // add link html
      }
    });
  } else { // general page analysis
    // get page structure overview
    const headings = document.querySelectorAll('h1, h2, h3'); // find headings
    const mainContent = document.querySelector('main, [role="main"], .main-content'); // find main content
    
    htmlContent += 'PAGE HEADINGS:\n'; // add headings header
    headings.forEach((heading, i) => {
      htmlContent += `${heading.tagName}: ${heading.textContent.trim()}\n`; // add heading text
    });
    
    if (mainContent) { // check if main content found
      htmlContent += '\nMAIN CONTENT STRUCTURE:\n'; // add main content header
      htmlContent += mainContent.outerHTML.substring(0, 1000) + '...\n'; // add main content html (truncated)
    }
  }
  
  // send html content back to popup for openai analysis
  return `page analysis requested: ${question}\n\nHTML STRUCTURE:\n${htmlContent}`; // return analysis request
}

async function waitSeconds(seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000)); // wait specified seconds
  return `waited ${seconds} seconds`; // return success message
}
