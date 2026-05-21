# SoulSync - Backend

> REST API for SoulSync — AI-powered mental wellness platform

Express/Node.js backend with TypeScript, MongoDB Atlas, and Groq SDK integration powering the SoulSync mental wellness application.

## 🌟 Features

- 🔐 JWT Authentication & authorization
- 💬 AI chat session management via Groq LLaMA
- 📊 Mood logging and analysis
- 🚨 Crisis detection and event logging
- 🏃 Activity tracking
- 🛡️ Error handling middleware
- 📝 Request logging

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB Atlas (Mongoose)
- **AI:** Groq SDK
- **Auth:** JWT + bcrypt
- **Deployment:** Railway

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Groq API key

### Installation

git clone https://github.com/aliciaferns22/soulsync-backend.git
cd soulsync-backend
npm install

### Environment Variables

Create a .env file in the root directory:

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
PORT=5000

### Run Development Server

npm run dev

Server runs on http://localhost:5000

## 📁 Project Structure

- **controllers/** — Route handlers
- **middleware/** — Auth & error middleware
- **models/** — Mongoose schemas
- **routes/** — API routes
- **services/** — Business logic
- **utils/** — DB, logger, helpers
  
## 🔗 Related

- [SoulSync Frontend](https://github.com/aliciaferns22/soulsync-frontend)
