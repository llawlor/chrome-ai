document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey'); // get api key input element
  const saveApiKeyBtn = document.getElementById('saveApiKey'); // get save button element
  const clearApiKeyBtn = document.getElementById('clearApiKey'); // get clear button element
  const apiKeyStatus = document.getElementById('apiKeyStatus'); // get status display element
  const status = document.getElementById('status'); // get general status element
  const apiKeyLink = document.getElementById('apiKeyLink'); // get api key link element
  const apiKeySection = document.getElementById('apiKeySection'); // get api key section element

  // load existing api key on popup open
  loadApiKey();

  // toggle api key section visibility when link is clicked
  apiKeyLink.addEventListener('click', function() {
    apiKeySection.classList.toggle('hidden'); // toggle hidden class
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
      } else {
        updateApiKeyStatus(false); // update status display
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
