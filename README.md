# Capstone B.A.N.T.A.Y Mobile App

## Project Overview

- React Native mobile application for PNP reporting and patrol operations.
- Enables patrol scheduling, assignment tracking, reporting, and notifications.
- Integrates with backend APIs and Firebase services for real-time updates.

## Features

- Patrol schedule and assignments
- Dashboard overview for ongoing patrol and operational status
- Barangay referral and e-blotter entry workflows
- Map-based location tracking and search for areas or checkpoints
- Notifications for new updates, alerts, and assignments
- Patrol logs with completion and after-patrol documentation
- Profile management, password updates, and role-based access
- Media submission for reports and related documentation

## Installation & Setup

1. Obtain the source code: clone the repository into your workspace.
2. From the project root, run: `npm install`
3. Ensure the Android environment is configured correctly for React Native / Expo development.
4. Confirm the Android project contains the required native files and resources under the `android/` folder.

## Development & Preview Run Commands

For development builds with the Expo dev client enabled:

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

To launch the app in dev-client mode locally:

```bash
npx expo start --dev-client
```

For internal preview builds:

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

## Usage Instructions

- Sign in / sign up
- Access the dashboard and select a patrol assignment or task
- View patrol schedules and assigned locations
- Open the map to inspect barangay coverage, routes, and checkpoints
- Submit reports, logs, and after-patrol details
- Receive notifications for new assignments or status updates
- Manage profile and security settings as needed

## Requirements

### OS & tools

- Windows 10/11 (Android builds)
- Node.js LTS (18+)
- npm or Yarn
- Java JDK 17+
- Android Studio (SDK Manager & Platform Tools)
- Android SDK and emulator setup

### Hardware

- Disk: 10+ GB for Android SDK, emulator images, and build cache
- Memory: 8+ GB recommended for emulator and builds

## Project Notes

- This app is built with Expo and React Native for Android-first mobile deployment.
- Firebase services and location-based features require the correct Android configuration and valid backend endpoints.
- For local development, make sure the Firebase and API credentials are configured according to your environment.

## Quick Start

```bash
npm install
npx expo start
```

Then run the Android app with:

```bash
npm run android
```

