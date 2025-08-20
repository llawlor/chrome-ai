# A.I. Prime

AI-powered browsing assistant that automates web navigation and tasks using natural language instructions.

## Features

- **Natural Language Control**: Give freeform text instructions to navigate websites and perform tasks
- **Multi-Step Automation**: Execute complex workflows like searching, clicking, form filling, and data extraction
- **Pause/Resume Control**: Stop and resume task execution at any point
- **Comprehensive Logging**: View detailed logs of AI instructions, task execution, and errors
- **OpenAI Integration**: Powered by GPT-4 for intelligent web automation

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/llawlor/chrome-ai.git
   cd chrome-ai
   ```

2. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `chrome-ai` directory

3. The A.I. Prime extension will appear in your Chrome toolbar

## Setup

1. Click the A.I. Prime extension icon
2. Click "API Key" to expand the API key section
3. Enter your OpenAI API key (starts with `sk-`)
4. Click "Save API Key"

Once your API key is saved, the main interface will appear with an instruction textbox.

## Usage

### Basic Instructions

Type natural language instructions in the textbox and click "Execute Task". Examples:

- `"Go to Amazon and search for wireless headphones under $100"`
- `"Navigate to GitHub and find trending JavaScript repositories"`
- `"Fill out this contact form with my information"`
- `"Extract all product prices from this page"`

### Supported Actions

The AI can perform these actions:

- **Navigate** to websites
- **Click** on links, buttons, and elements
- **Type** text into input fields and forms
- **Submit** forms and execute searches
- **Scroll** up and down pages
- **Extract** information from page elements
- **Wait** for specified durations

### Pause/Resume Control

- During task execution, a red "Pause Execution" button appears
- Click to pause at any point - the button turns green "Resume Execution"
- Click again to resume from exactly where it left off
- Progress is tracked and logged

### Logging System

Click "Show Logs" to view detailed execution logs:

- **Blue entries**: User requests and OpenAI API calls
- **Purple entries**: AI responses and parsed actions
- **Green entries**: Successful action executions
- **Red entries**: Errors at any stage

Use "Clear Logs" to reset the log history.

## How It Works

1. **User Input**: You provide natural language instructions
2. **AI Processing**: GPT-4 analyzes your request and current page context
3. **Action Planning**: AI generates a sequence of specific actions to perform
4. **Execution**: Extension executes actions step-by-step via content script
5. **Feedback**: Real-time status updates and comprehensive logging

## File Structure

```
chrome-ai/
├── manifest.json       # Extension configuration and permissions
├── popup.html         # Extension popup interface
├── popup.js           # Main logic, OpenAI integration, UI control
├── content.js         # Web page automation and element interaction
├── background.js      # Background service worker
└── README.md          # This file
```

## Permissions

The extension requires these permissions:

- `storage`: Save API key locally
- `tabs`: Access current tab information
- `activeTab`: Interact with the active webpage

## Requirements

- Chrome browser with extensions enabled
- OpenAI API key with GPT-4 access
- Internet connection for API calls

## Privacy & Security

- Your OpenAI API key is stored locally in Chrome's secure storage
- No data is sent to external servers except OpenAI API calls
- All web interactions happen locally in your browser

## Troubleshooting

### Extension not working
- Ensure you have a valid OpenAI API key saved
- Check that the extension has necessary permissions
- Reload the extension in `chrome://extensions/`

### Actions failing
- Check the logs for specific error messages
- Some websites may block automated interactions
- Try pausing and resuming if actions seem stuck

### API errors
- Verify your OpenAI API key is correct and has credits
- Check your internet connection
- OpenAI API may have rate limits or temporary issues

## Development

To modify the extension:

1. Make changes to the source files
2. Reload the extension in `chrome://extensions/`
3. Test functionality on various websites

Key files:
- `popup.js`: Main application logic and OpenAI integration
- `content.js`: Web automation functions
- `popup.html`: User interface and styling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. See the repository for license details.

## Support

For issues or questions:
- Check the logs for error details
- Review this README for troubleshooting steps
- Open an issue on the GitHub repository
