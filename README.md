# GitHub Project Analyzer v3

A full-stack developer tool that analyzes any GitHub repository and provides an AI-powered chat assistant powered by Google Gemini.

## Features

- **Repository Analysis**: Fetch and analyze GitHub repositories including metadata, tech stack, contributors, and activity metrics
- **AI Assistant**: Chat with a Gemini AI about the analyzed repository using natural language queries
- **Health Scoring**: Calculate repository health scores based on commits, contributors, and activity
- **File Tree Visualization**: Display the repository's file structure with icons
- **Tech Stack Detection**: Identify programming languages and technologies used
- **Difficulty Assessment**: Evaluate project complexity for contributors

## Tech Stack

- **Backend**: Node.js with Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **APIs**: GitHub REST API, Google Gemini AI
- **Package Manager**: npm

## Installation

bash
cd github-analyzer-v3-folder
npm install


## Usage

### 1. Configure Gemini API Key

Open `server.js` and find line 12:

js
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';


Replace `YOUR_GEMINI_API_KEY_HERE` with your actual Gemini API key, or set it as an environment variable:

bash
GEMINI_API_KEY=AIzaSy... node server.js


> Get a free Gemini API key at https://aistudio.google.com/app/apikey

### 2. Run the Application

bash
npm start


Open http://localhost:3000 in your browser.

## Configuration

The application uses the following configuration options:

- **GitHub Token**: Optional - improves API rate limits (set via `GITHUB_TOKEN` environment variable)
- **Gemini API Key**: Required for AI chat functionality
- **Port**: Configurable via `PORT` environment variable (default: 3000)

## Project Structure


github-analyzer-v3-folder/
├── server.js              # Main server application
├── package.json           # Dependencies and scripts
├── package-lock.json      # Dependency lock file
├── public/
│   ├── index.html         # Main HTML file
│   ├── css/
│   │   └── style.css      # Stylesheets
│   └── js/
│       └── app.js         # Frontend JavaScript
└── README.md              # This file


## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/analyze` | Analyze a GitHub repository |
| POST | `/ask-ai` | Ask Gemini about the analyzed repository |
| GET | `*` | Serve the main HTML page |

## Contributing

This is an open-source project. Feel free to submit issues, feature requests, or pull requests to improve the GitHub Project Analyzer.

## License

No license information was found in the repository.