# Black-Hole Next.js

A stunning Three.js black hole visualization migrated to Next.js with React.

## Features

- Real-time black hole gravitational lensing effect
- Particle system for stars and accretion disc
- Custom GLSL shaders for realistic physics simulation
- Responsive design and smooth animations
- Built with Next.js 14 and React 18

## Setup

```bash
# Install dependencies (only the first time)
npm install

# Run the local development server at localhost:3000
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Technology Stack

- **Next.js 14** - React framework with App Router
- **Three.js** - 3D graphics and WebGL rendering
- **TypeScript** - Type-safe development
- **Custom GLSL Shaders** - Physics-accurate light distortion effects

## Migration Notes

This project has been migrated from Vite to Next.js while preserving all the original Three.js functionality:

- Converted to React component with proper lifecycle management
- Shader files moved to `/public/shaders/` directory
- Added TypeScript support with proper Three.js types
- Maintained all original visual effects and animations

