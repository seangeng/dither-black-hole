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

## Controls

- **Mouse**: Orbit around the black hole
- **Mouse Wheel**: Zoom in/out
- **H Key**: Toggle dithering controls
- **Controls Panel**: Adjust grid size, intensity, contrast, and background color

## Dithering Effect

The visualization includes a high-contrast dithering effect inspired by classic newspaper halftone patterns:

- **Grid Size**: Control pixelation level (1-8 pixels)
- **Dither Intensity**: Adjust dithering strength (0-1)
- **Contrast**: Enhance visibility of orbital patterns (0.5-3x)
- **Background Color**: HEX color picker + presets for customization

## Migration Notes

This project has been migrated from Vite to Next.js while preserving all the original Three.js functionality:

- Converted to React component with proper lifecycle management
- Shader files moved to `/public/shaders/` directory
- Added TypeScript support with proper Three.js types
- Maintained all original visual effects and animations
- Added custom dithering post-processing pipeline

