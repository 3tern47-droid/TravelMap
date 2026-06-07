# TravelMap - 3D World Map

An interactive 2D world map rendered in a 3D black space using React, Three.js, and D3.

## Features
- **3D Environment:** A floating flat map in a dark space void.
- **Interactive Navigation:** Smooth pan and zoom controls.
- **Dynamic Coloring:** Change the map color using a rainbow scale in real-time.
- **GeoJSON Powered:** High-quality country boundaries projected into 3D geometry.

## Tech Stack
- [React](https://reactjs.org/)
- [Three.js](https://threejs.org/)
- [@react-three/fiber](https://github.com/pmndrs/react-three-fiber)
- [D3.js](https://d3js.org/) (for GeoJSON projections)
- [Vite](https://vitejs.dev/)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/3tern47-droid/TravelMap.git
   cd TravelMap
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
To start the development server:
```bash
npm run dev
```
Open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

### Controls
- **Left Click + Drag:** Pan the map "anywhere to anywhere".
- **Scroll:** Zoom in and out.
- **Color Scale (Bottom Right):** Click anywhere on the rainbow bar to change the map color.
