// content script - handles web automation actions from popup
console.log('content script loaded'); // log when content script loads

// track url visits for data collection
trackUrlVisit();

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

async function clickElement(selector, expectedOutcome) {
  // generate multiple selector strategies if single selector provided
  let selectors = Array.isArray(selector) ? selector : [selector]; // ensure array
  
  // if single selector provided, generate fallback strategies
  if (selectors.length === 1) { // check if only one selector
    const originalSelector = selectors[0]; // get original selector
    const fallbackSelectors = generateSelectorFallbacks(originalSelector); // generate fallbacks
    selectors = [originalSelector, ...fallbackSelectors]; // combine selectors
  }
  
  const result = findElementWithStrategies(selectors); // find element with strategies
  
  if (!result) { // check if no element found
    throw new Error(`element not found with any selector: ${selectors.join(', ')}`); // throw error
  }
  
  const { element, selector: successfulSelector } = result; // destructure result
  
  if (!isElementInteractable(element)) { // check if element is interactable
    throw new Error(`element not interactable: ${successfulSelector}`); // throw error
  }
  
  element.scrollIntoView({behavior: 'smooth', block: 'center'}); // scroll element into view
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for scroll
  
  element.click(); // click element
  
  // wait briefly for action to take effect
  await new Promise(resolve => setTimeout(resolve, 200)); // wait 200ms
  
  // verify action success
  const success = verifyActionSuccess({ type: 'click' }, element, expectedOutcome); // verify success
  
  return `clicked element: ${successfulSelector}${success ? ' (verified)' : ' (unverified)'}`; // return success message
}

async function typeText(selector, text, expectedOutcome) {
  // generate multiple selector strategies if single selector provided
  let selectors = Array.isArray(selector) ? selector : [selector]; // ensure array
  
  // if single selector provided, generate fallback strategies
  if (selectors.length === 1) { // check if only one selector
    const originalSelector = selectors[0]; // get original selector
    const fallbackSelectors = generateSelectorFallbacks(originalSelector); // generate fallbacks
    selectors = [originalSelector, ...fallbackSelectors]; // combine selectors
  }
  
  const result = findElementWithStrategies(selectors); // find element with strategies
  
  if (!result) { // check if no element found
    throw new Error(`element not found with any selector: ${selectors.join(', ')}`); // throw error
  }
  
  const { element, selector: successfulSelector } = result; // destructure result
  
  if (!isElementInteractable(element)) { // check if element is interactable
    throw new Error(`element not interactable: ${successfulSelector}`); // throw error
  }
  
  element.focus(); // focus element
  element.value = text; // set element value
  
  // dispatch input event to trigger any listeners
  const inputEvent = new Event('input', { bubbles: true }); // create input event
  element.dispatchEvent(inputEvent); // dispatch input event
  
  // verify action success
  const success = verifyActionSuccess({ type: 'type', text }, element, expectedOutcome); // verify success
  
  return `typed text into ${successfulSelector}: ${text}${success ? ' (verified)' : ' (unverified)'}`; // return success message
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

async function pressKey(selector, key, expectedOutcome) {
  // generate multiple selector strategies if single selector provided
  let selectors = Array.isArray(selector) ? selector : [selector]; // ensure array
  
  // if single selector provided, generate fallback strategies
  if (selectors.length === 1) { // check if only one selector
    const originalSelector = selectors[0]; // get original selector
    const fallbackSelectors = generateSelectorFallbacks(originalSelector); // generate fallbacks
    selectors = [originalSelector, ...fallbackSelectors]; // combine selectors
  }
  
  const result = findElementWithStrategies(selectors); // find element with strategies
  
  if (!result) { // check if no element found
    throw new Error(`element not found with any selector: ${selectors.join(', ')}`); // throw error
  }
  
  const { element, selector: successfulSelector } = result; // destructure result
  
  if (!isElementInteractable(element)) { // check if element is interactable
    throw new Error(`element not interactable: ${successfulSelector}`); // throw error
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
      
      // wait and check for form submission confirmation
      await new Promise(resolve => setTimeout(resolve, 1000)); // wait for submission
      const submitted = detectFormSubmission(); // check if submitted
      
      return `pressed Enter and submitted form for element: ${successfulSelector}${submitted ? ' (confirmed)' : ' (unconfirmed)'}`; // return success message
    }
    
    // strategy 3: try clicking submit button
    const submitBtn = form ? form.querySelector('input[type="submit"], button[type="submit"], button:not([type])') : null; // find submit button
    if (submitBtn) { // check if submit button found
      submitBtn.click(); // click submit button
      
      // wait and check for form submission confirmation
      await new Promise(resolve => setTimeout(resolve, 1000)); // wait for submission
      const submitted = detectFormSubmission(); // check if submitted
      
      return `pressed Enter and clicked submit button for element: ${successfulSelector}${submitted ? ' (confirmed)' : ' (unconfirmed)'}`; // return success message
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
  
  // verify action success for enter key
  if (key === 'Enter') { // check if enter key
    await new Promise(resolve => setTimeout(resolve, 1000)); // wait for potential submission
    const success = verifyActionSuccess({ type: 'press_key', key }, element, expectedOutcome); // verify success
    return `pressed ${key} on element: ${successfulSelector}${success ? ' (verified)' : ' (unverified)'}`; // return success message
  }
  
  return `pressed ${key} on element: ${successfulSelector}`; // return success message
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
  } else if (focus.toLowerCase().includes('search') || focus.toLowerCase().includes('navigation')) { // check if analyzing search or navigation
    // find comprehensive search and navigation elements
    const allInputs = document.querySelectorAll('input, textarea'); // find all inputs
    const searchInputs = Array.from(allInputs).filter(input => 
      input.type === 'search' || 
      input.type === 'text' || 
      input.name === 'q' ||
      input.name === 'query' ||
      input.name === 'search' ||
      input.id && input.id.toLowerCase().includes('search') ||
      input.className && input.className.toLowerCase().includes('search') ||
      input.placeholder && input.placeholder.toLowerCase().includes('search') ||
      input.getAttribute('aria-label') && input.getAttribute('aria-label').toLowerCase().includes('search') ||
      input.getAttribute('title') && input.getAttribute('title').toLowerCase().includes('search')
    ); // comprehensive search input detection
    
    const allButtons = document.querySelectorAll('button, input[type="submit"], input[type="button"]'); // find all buttons
    const searchButtons = Array.from(allButtons).filter(button => 
      button.type === 'submit' ||
      button.name && (button.name.includes('btn') || button.name.includes('search')) ||
      button.textContent && button.textContent.toLowerCase().includes('search') ||
      button.getAttribute('aria-label') && button.getAttribute('aria-label').toLowerCase().includes('search') ||
      button.className && button.className.toLowerCase().includes('search')
    ); // comprehensive search button detection
    
    const allLinks = document.querySelectorAll('a[href]'); // find all links
    const navigationLinks = Array.from(allLinks).filter(link => 
      link.href && (
        link.href.includes('image') ||
        link.href.includes('video') ||
        link.href.includes('news') ||
        link.href.includes('shopping') ||
        link.textContent && (
          link.textContent.toLowerCase().includes('image') ||
          link.textContent.toLowerCase().includes('video') ||
          link.textContent.toLowerCase().includes('news') ||
          link.textContent.toLowerCase().includes('shop')
        )
      )
    ); // comprehensive navigation link detection
    
    htmlContent += 'ALL INPUTS:\\n'; // add all inputs header
    allInputs.forEach((input, i) => {
      if (i < 15) { // limit to first 15 inputs
        htmlContent += `Input ${i + 1}: ${input.outerHTML}\\n`; // add input html
      }
    });
    
    htmlContent += '\\nSEARCH INPUTS:\\n'; // add search inputs header
    searchInputs.forEach((input, i) => {
      htmlContent += `Search Input ${i + 1}: ${input.outerHTML}\\n`; // add search input html
    });
    
    htmlContent += '\\nALL BUTTONS:\\n'; // add all buttons header
    allButtons.forEach((button, i) => {
      if (i < 15) { // limit to first 15 buttons
      htmlContent += `Button ${i + 1}: ${button.outerHTML}\\n`; // add button html
      }
    });
    
    htmlContent += '\\nSEARCH BUTTONS:\\n'; // add search buttons header
    searchButtons.forEach((button, i) => {
      htmlContent += `Search Button ${i + 1}: ${button.outerHTML}\\n`; // add search button html
    });
    
    htmlContent += '\\nNAVIGATION LINKS:\\n'; // add navigation links header
    navigationLinks.forEach((link, i) => {
      if (i < 10) { // limit to first 10 navigation links
        htmlContent += `Nav Link ${i + 1}: ${link.textContent.trim()} - ${link.outerHTML.substring(0, 300)}\\n`; // add link info
      }
    });
    
    htmlContent += '\\nALL LINKS (first 25):\\n'; // add all links header
    allLinks.forEach((link, i) => {
      if (i < 25 && link.textContent && link.textContent.trim()) { // limit to first 25 links with text
        htmlContent += `Link ${i + 1}: "${link.textContent.trim()}" - ${link.outerHTML.substring(0, 200)}\\n`; // add link info
      }
    });
  } else if (focus.toLowerCase().includes('filter')) { // check if analyzing filters
    // find filter-related elements
    const filterElements = document.querySelectorAll('[data-component-type="s-refinement"], .s-refinement, .a-checkbox, input[type="checkbox"], .facet, .filter'); // find filter elements
    const sidebarElements = document.querySelectorAll('#leftNav, .s-refinements, .s-size-base-plus, [data-cy="refinements"]'); // find sidebar elements
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

async function waitForPageLoad() {
  // wait for page to be fully loaded
  return new Promise((resolve) => {
    if (document.readyState === 'complete') { // check if already loaded
      resolve('page already loaded'); // resolve immediately
    } else {
      const checkLoad = () => {
        if (document.readyState === 'complete') { // check if loaded
          resolve('page loaded'); // resolve when loaded
        } else {
          setTimeout(checkLoad, 100); // check again in 100ms
        }
      };
      checkLoad(); // start checking
    }
  });
}

function isElementVisible(element) {
  // check if element is visible and interactable
  if (!element) return false; // element doesn't exist
  
  const rect = element.getBoundingClientRect(); // get element position
  const style = window.getComputedStyle(element); // get computed styles
  
  return (
    rect.width > 0 && // has width
    rect.height > 0 && // has height
    style.visibility !== 'hidden' && // not hidden
    style.display !== 'none' && // not display none
    style.opacity !== '0' && // not transparent
    rect.top >= 0 && // visible in viewport
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

function isElementInteractable(element) {
  // check if element can be interacted with
  if (!isElementVisible(element)) return false; // must be visible first
  
  const style = window.getComputedStyle(element); // get computed styles
  return (
    !element.disabled && // not disabled
    style.pointerEvents !== 'none' && // can receive pointer events
    !element.hasAttribute('readonly') // not readonly
  );
}

function findElementWithStrategies(selectors) {
  // try multiple selector strategies
  for (const selector of selectors) { // loop through selectors
    try {
      const element = document.querySelector(selector); // try selector
      if (element && isElementVisible(element)) { // check if found and visible
        return { element, selector }; // return element and successful selector
      }
    } catch (e) {
      continue; // try next selector if this one fails
    }
  }
  return null; // no selector worked
}

function verifyActionSuccess(action, element, expectedOutcome) {
  // verify that action had expected effect
  switch (action.type) {
    case 'click':
      // check if click triggered expected changes
      if (expectedOutcome && expectedOutcome.urlChange) { // check for url change
        return window.location.href.includes(expectedOutcome.urlChange); // verify url changed
      }
      if (expectedOutcome && expectedOutcome.elementChange) { // check for element change
        const changedElement = document.querySelector(expectedOutcome.elementChange); // find changed element
        return changedElement !== null; // verify element exists
      }
      return true; // assume success if no specific outcome expected
      
    case 'type':
      // verify text was entered
      return element.value === action.text || element.textContent === action.text; // check value matches
      
    case 'submit':
    case 'press_key':
      // check for form submission indicators
      return detectFormSubmission(); // use form submission detection
      
    default:
      return true; // assume success for other actions
  }
}

function detectFormSubmission() {
  // detect if form was successfully submitted
  const indicators = [
    () => window.location.href !== window.location.href, // url changed (will be false initially)
    () => document.querySelector('.loading, .spinner, [aria-busy="true"]') !== null, // loading indicator
    () => document.querySelector('.success, .confirmation, .thank-you') !== null, // success message
    () => document.querySelector('.error, .validation-error') !== null, // error message (still indicates submission attempt)
    () => document.title !== document.title // title changed (will be false initially)
  ];
  
  // check for immediate indicators
  return indicators.some(check => {
    try {
      return check(); // run check
    } catch (e) {
      return false; // ignore errors
    }
  });
}

function generateSelectorFallbacks(originalSelector) {
  // generate fallback selectors based on common patterns
  const fallbacks = []; // initialize fallbacks array
  
  // if selector targets input with name="q", add common search input patterns
  if (originalSelector.includes('name="q"') || originalSelector.includes("name='q'")) { // check for search input
    fallbacks.push(
      'input[type="search"]', // search type input
      'input[type="text"][placeholder*="search" i]', // text input with search placeholder
      'input[aria-label*="search" i]', // input with search aria-label
      'input[title*="search" i]', // input with search title
      'textarea[name="q"]', // textarea with name q
      'input[name="query"]', // input with name query
      'input[name="search"]', // input with name search
      'input[id*="search" i]', // input with search in id
      'input[class*="search" i]' // input with search in class
    );
  }
  
  // if selector targets links with href patterns, add common navigation patterns
  if (originalSelector.includes('href*=')) { // check for href pattern
    if (originalSelector.includes('tbm=isch') || originalSelector.includes('images')) { // check for images
      fallbacks.push(
        'a[href*="images"]', // links with images in href
        'a[data-ved*="images"]', // links with images in data-ved
        'a:contains("Images")', // links containing "Images" text
        'a[aria-label*="images" i]', // links with images in aria-label
        'nav a[href*="image"]', // navigation links with image
        'button[data-ved*="images"]' // buttons with images data
      );
    }
  }
  
  // if selector targets buttons, add common button patterns
  if (originalSelector.includes('button') || originalSelector.includes('input[type="submit"]')) { // check for buttons
    fallbacks.push(
      'button[type="submit"]', // submit buttons
      'input[type="submit"]', // submit inputs
      'button[aria-label*="search" i]', // buttons with search aria-label
      'button:contains("Search")', // buttons containing "Search"
      'input[name*="btn"]', // inputs with btn in name
      'button[class*="search" i]', // buttons with search in class
      'button[id*="search" i]' // buttons with search in id
    );
  }
  
  // add generic fallbacks based on selector type
  if (originalSelector.startsWith('#')) { // check for id selector
    const id = originalSelector.substring(1); // extract id
    fallbacks.push(
      `[id="${id}"]`, // attribute selector for id
      `[id*="${id}"]`, // partial id match
      `*[id^="${id}"]` // id starts with
    );
  } else if (originalSelector.startsWith('.')) { // check for class selector
    const className = originalSelector.substring(1); // extract class
    fallbacks.push(
      `[class*="${className}"]`, // partial class match
      `*[class^="${className}"]`, // class starts with
      `*[class$="${className}"]` // class ends with
    );
  }
  
  return fallbacks; // return fallback selectors
}

async function waitSeconds(seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000)); // wait specified seconds
  return `waited ${seconds} seconds`; // return success message
}

async function trackUrlVisit() {
  try {
    // use chrome storage api with promises for consistent api usage
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['current_task_id'], resolve); // get task id using chrome storage api
    });
    
    const taskId = result.current_task_id; // get task id
    if (!taskId) return; // no active task
    
    // get current task data using chrome storage api
    const taskResult = await new Promise((resolve) => {
      chrome.storage.local.get([`task_data_${taskId}`], resolve); // get task data using chrome storage api
    });
    
    const taskData = taskResult[`task_data_${taskId}`]; // get task data
    if (!taskData) return; // no task data found
    
    const currentUrl = window.location.href; // get current url
    const timestamp = new Date().toLocaleTimeString(); // get timestamp
    
    // check if url already exists to avoid duplicates
    const urlExists = taskData.urls.some(urlData => urlData.url === currentUrl); // check for duplicate
    if (urlExists) return; // url already tracked
    
    // add new url to task data
    taskData.urls.push({
      url: currentUrl,
      timestamp: timestamp,
      title: document.title || 'untitled page'
    }); // add url data
    
    // save updated task data using chrome storage api
    await new Promise((resolve) => {
      chrome.storage.local.set({[`task_data_${taskId}`]: taskData}, resolve); // save using chrome storage api
    });
    
    // update data collection tab using chrome runtime messaging
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_TASK_DATA',
        taskData: taskData,
        targetTabId: taskData.dataTabId
      }); // send update via chrome runtime messaging
    } catch (error) {
      console.log('could not update data collection tab via runtime:', error.message); // log error
      // fallback to direct tab messaging
      try {
        await chrome.tabs.sendMessage(taskData.dataTabId, {
          type: 'UPDATE_TASK_DATA',
          taskData: taskData
        }); // send update to data tab
      } catch (tabError) {
        console.log('could not update data collection tab via tabs:', tabError.message); // log error
      }
    }
    
    console.log('tracked url visit using chrome apis:', currentUrl); // log url tracking
    
  } catch (error) {
    console.log('error tracking url visit:', error.message); // log error
  }
}
