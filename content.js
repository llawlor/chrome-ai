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
  if (!element) { // check if element not found
    throw new Error(`element not found: ${selector}`); // throw error
  }
  
  if (key === 'Enter') { // check if enter key
    // try multiple submission strategies for enter key
    
    // strategy 1: dispatch keyboard events
    const keydownEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keydownEvent); // dispatch keydown event
    
    const keypressEvent = new KeyboardEvent('keypress', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keypressEvent); // dispatch keypress event
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keyupEvent); // dispatch keyup event
    
    // strategy 2: try to submit parent form if enter didn't work
    await new Promise(resolve => setTimeout(resolve, 500)); // wait briefly
    const form = element.closest('form'); // find parent form
    if (form) { // check if form found
      form.submit(); // submit form
      return `pressed Enter and submitted form for element: ${selector}`; // return success message
    }
    
    // strategy 3: try clicking submit button
    const submitBtn = form ? form.querySelector('input[type="submit"], button[type="submit"], button:not([type])') : null; // find submit button
    if (submitBtn) { // check if submit button found
      submitBtn.click(); // click submit button
      return `pressed Enter and clicked submit button for element: ${selector}`; // return success message
    }
    
  } else {
    // handle other keys normally
    const keydownEvent = new KeyboardEvent('keydown', {
      key: key,
      code: key,
      keyCode: key.charCodeAt(0),
      which: key.charCodeAt(0),
      bubbles: true
    });
    element.dispatchEvent(keydownEvent); // dispatch keydown event
    
    const keypressEvent = new KeyboardEvent('keypress', {
      key: key,
      code: key,
      keyCode: key.charCodeAt(0),
      which: key.charCodeAt(0),
      bubbles: true
    });
    element.dispatchEvent(keypressEvent); // dispatch keypress event
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key: key,
      code: key,
      keyCode: key.charCodeAt(0),
      which: key.charCodeAt(0),
      bubbles: true
    });
    element.dispatchEvent(keyupEvent); // dispatch keyup event
  }
  
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
    
    htmlContent += '\nSEARCH INPUTS:\n'; // add search inputs header
    searchInputs.forEach((input, i) => {
      htmlContent += `Search Input ${i + 1}: ${input.outerHTML}\n`; // add search input html
    });
    
    htmlContent += '\nBUTTONS:\n'; // add buttons header
    buttons.forEach((button, i) => {
      if (i < 15) { // limit to first 15 buttons
        htmlContent += `Button ${i + 1}: ${button.outerHTML}\n`; // add button html
      }
    });
  } else if (focus.toLowerCase().includes('filter') || focus.toLowerCase().includes('prime')) { // check if analyzing filters
    // find filter-related elements
    const filterElements = document.querySelectorAll('[data-component-type="s-refinement"], .s-refinement, .a-checkbox, input[type="checkbox"], .facet, .filter'); // find filter elements
    const sidebarElements = document.querySelectorAll('#leftNav, .s-refinements, .s-size-base-plus, [data-cy="refinements"]'); // find sidebar elements
    const primeElements = document.querySelectorAll('[data-value*="prime" i], [aria-label*="prime" i], [title*="prime" i], .prime, #prime'); // find prime-specific elements
    const checkboxes = document.querySelectorAll('input[type="checkbox"], .a-checkbox'); // find all checkboxes
    
    htmlContent += 'FILTER ELEMENTS:\n'; // add filter elements header
    filterElements.forEach((element, i) => {
      if (i < 20) { // limit to first 20 filter elements
        htmlContent += `Filter ${i + 1}: ${element.outerHTML.substring(0, 500)}\n\n`; // add filter element html
      }
    });
    
    htmlContent += 'SIDEBAR ELEMENTS:\n'; // add sidebar elements header
    sidebarElements.forEach((element, i) => {
      if (i < 5) { // limit to first 5 sidebar elements
        htmlContent += `Sidebar ${i + 1}: ${element.outerHTML.substring(0, 1000)}\n\n`; // add sidebar element html
      }
    });
    
    htmlContent += 'PRIME ELEMENTS:\n'; // add prime elements header
    primeElements.forEach((element, i) => {
      if (i < 10) { // limit to first 10 prime elements
        htmlContent += `Prime ${i + 1}: ${element.outerHTML}\n`; // add prime element html
      }
    });
    
    htmlContent += '\nCHECKBOXES:\n'; // add checkboxes header
    checkboxes.forEach((checkbox, i) => {
      if (i < 15) { // limit to first 15 checkboxes
        htmlContent += `Checkbox ${i + 1}: ${checkbox.outerHTML}\n`; // add checkbox html
      }
    });
  } else {
    // for other focus types, capture general page structure
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6'); // find all headings
    const links = document.querySelectorAll('a'); // find all links
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]'); // find all buttons
    const mainContent = document.querySelector('main, #main, .main, [role="main"]'); // find main content area
    
    htmlContent += 'PAGE HEADINGS:\n'; // add headings header
    headings.forEach((heading, i) => {
      if (i < 50) { // limit to first 50 headings
        htmlContent += `${heading.tagName}: ${heading.textContent.trim()}\n`; // add heading text
      }
    });
    
    htmlContent += '\nNAVIGATION LINKS:\n'; // add links header
    links.forEach((link, i) => {
      if (i < 20) { // limit to first 20 links
        htmlContent += `Link ${i + 1}: ${link.textContent.trim()} (href: ${link.href})\n`; // add link text and href
      }
    });
    
    htmlContent += '\nBUTTONS:\n'; // add buttons header
    buttons.forEach((button, i) => {
      if (i < 15) { // limit to first 15 buttons
        htmlContent += `Button ${i + 1}: ${button.outerHTML}\n`; // add button html
      }
    });
    
    if (mainContent) { // check if main content found
      htmlContent += `\nMAIN CONTENT SNIPPET:\n${mainContent.outerHTML.substring(0, 1000)}\n`; // add main content snippet
    }
  }
  
  // truncate if too long
  if (htmlContent.length > 4000) { // check if content too long
    htmlContent = htmlContent.substring(0, 4000) + '...[truncated]'; // truncate content
  }
  
  return `page analysis requested: ${question}\n\nHTML STRUCTURE:\n${htmlContent}`; // return analysis
}

async function waitSeconds(seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000)); // wait specified seconds
  return `waited ${seconds} seconds`; // return success message
}
