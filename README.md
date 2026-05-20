# AirDraw AI - Gesture Based Drawing Platform

AirDraw AI is a futuristic, gesture-based drawing web application that allows users to draw in the air using hand tracking via a webcam. It features a complete "antigravity" UI experience, neon effects, and a smooth drawing engine built with React, TailwindCSS, HTML5 Canvas, and MediaPipe Hands.

## 🌟 Features

- **Real-Time Hand Tracking**: Uses Google's MediaPipe Hands for high-performance, low-latency gesture detection.
- **Gesture Controls**:
  - ☝️ **Index Finger Up**: Draw
  - ✊ **Fist**: Stop drawing
  - ✌️ **Two Fingers**: Change brush color
  - 🖐️ **Open Palm**: Clear screen
- **Antigravity UI**: A sleek, dark-themed UI with glassmorphism and a dynamic floating particle background built with React and TailwindCSS.
- **Accessibility Mode**: Built-in voice guidance and a simple UI toggle for physically challenged users.
- **Firebase Integration**: Google Authentication and Firestore database for saving and loading drawings.

## 📁 Project Structure

```text
/airdaw-ai
  ├── src/
  │   ├── components/  # React UI components (Navbar, CanvasArea, etc.)
  │   ├── hooks/       # useDrawing and useHandTracking logic
  │   ├── pages/       # Home page
  │   ├── services/    # Firebase Auth & Firestore logic
  │   └── utils/       # Math utilities, EMA smoothing, Bezier curves
  ├── index.html       # Main HTML layout
  ├── package.json     # Node dependencies and scripts
  ├── tailwind.config.js # Tailwind CSS configuration
  └── vite.config.js   # Vite configuration
```

## 🚀 How to Run Locally

This project is built using React and Vite. You need Node.js installed on your machine.

1. **Navigate into the project directory**:
   ```bash
   cd airdaw-ai
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start the development server**:
   ```bash
   npm run dev
   ```
4. **Open** the provided localhost URL (usually `http://localhost:5173`) in Google Chrome.
5. Allow Camera permissions when prompted.

## 🔥 Firebase Setup Guide (Required for Save/Load)

To enable Google Login and cloud saving, follow these steps:

1. **Create a Firebase Project**:
   - Go to the [Firebase Console](https://console.firebase.google.com/).
   - Click **Add Project** and name it "AirDraw AI".
   - Disable Google Analytics (optional).

2. **Add a Web App to Firebase**:
   - In the project overview, click the **Web `</>`** icon.
   - Register the app as "AirDraw Web".
   - Copy the `firebaseConfig` object provided.

3. **Update `src/services/firebase.js`**:
   - Open `src/services/firebase.js`.
   - Replace the `firebaseConfig` placeholder with your actual keys.

4. **Enable Authentication**:
   - Go to **Build -> Authentication** in the sidebar.
   - Click **Get Started**.
   - Go to the **Sign-in method** tab.
   - Enable **Google** and select a support email.

5. **Enable Firestore Database**:
   - Go to **Build -> Firestore Database**.
   - Click **Create Database**.
   - Start in **Test Mode** (Note: this allows anyone to read/write for 30 days. For production, you will need to set up proper security rules).

## 🌍 Deployment Guide (Vite + Firebase Hosting)

Deploying AirDraw AI is incredibly simple using Firebase Hosting:

1. Build the production application:
   ```bash
   npm run build
   ```
2. Install the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
3. Login to your Firebase account:
   ```bash
   firebase login
   ```
4. Initialize Firebase in the project directory:
   ```bash
   firebase init hosting
   ```
   - Select your "AirDraw AI" project.
   - Set the public directory to `dist` (this is where Vite puts the build output).
   - Configure as a single-page app: `Yes`.
   - Set up automatic builds: `No`.
5. Deploy the app:
   ```bash
   firebase deploy
   ```
6. Your app will be live at `https://<YOUR_PROJECT_ID>.web.app`!

## 🔮 Future Extensions
- **AI Shape Detection**: Convert rough hand-drawn circles/squares into perfect vectors.
- **Voice Commands**: Integrate Web Speech API to change colors and tools via voice.
- **Multi-user Collaboration**: Use Firebase Realtime Database to draw with friends live.
- **3D Canvas**: Integrate Three.js to draw in 3D space.

## 🧪 Browser Compatibility
Tested and optimized for Google Chrome on Desktop. Hardware acceleration is recommended for 60FPS hand tracking.