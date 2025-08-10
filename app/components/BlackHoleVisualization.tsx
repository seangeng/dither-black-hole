"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface ShaderFiles {
  discVertex: string;
  discFragment: string;
  noisesVertex: string;
  noisesFragment: string;
  starsVertex: string;
  starsFragment: string;
  distortionHoleVertex: string;
  distortionHoleFragment: string;
  compositionVertex: string;
  compositionFragment: string;
  distortionDiscVertex: string;
  distortionDiscFragment: string;
}

async function loadShaders(): Promise<ShaderFiles> {
  const shaderPaths = {
    discVertex: "/shaders/disc/vertex.glsl",
    discFragment: "/shaders/disc/fragment.glsl",
    noisesVertex: "/shaders/noises/vertex.glsl",
    noisesFragment: "/shaders/noises/fragment.glsl",
    starsVertex: "/shaders/stars/vertex.glsl",
    starsFragment: "/shaders/stars/fragment.glsl",
    distortionHoleVertex: "/shaders/distortionHole/vertex.glsl",
    distortionHoleFragment: "/shaders/distortionHole/fragment.glsl",
    compositionVertex: "/shaders/composition/vertex.glsl",
    compositionFragment: "/shaders/composition/fragment.glsl",
    distortionDiscVertex: "/shaders/distortionDisc/vertex.glsl",
    distortionDiscFragment: "/shaders/distortionDisc/fragment.glsl",
  };

  const shaderPromises = Object.entries(shaderPaths).map(
    async ([key, path]) => {
      const response = await fetch(path);
      const text = await response.text();
      return [key, text];
    }
  );

  const shaderResults = await Promise.all(shaderPromises);
  return Object.fromEntries(shaderResults) as ShaderFiles;
}

async function loadShaderWithIncludes(fragmentPath: string): Promise<string> {
  const response = await fetch(fragmentPath);
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${fragmentPath}`);
  }
  let shaderCode = await response.text();

  // Process #include directives
  const includeRegex = /#include\s+(.+)/g;
  const includes: string[] = [];
  let match;

  // Find all includes first
  while ((match = includeRegex.exec(shaderCode)) !== null) {
    includes.push(match[0]);
  }

  // Process each include
  for (const includeDirective of includes) {
    const includeMatch = includeDirective.match(/#include\s+(.+)/);
    if (includeMatch) {
      let includePath = includeMatch[1].trim();

      // Remove semicolon if present
      includePath = includePath.replace(";", "");

      // Convert relative path to absolute path
      let absolutePath = includePath;
      if (includePath.startsWith("../")) {
        absolutePath = includePath.replace("../", "/shaders/");
      } else if (!includePath.startsWith("/")) {
        absolutePath = `/shaders/${includePath}`;
      }

      // Ensure .glsl extension
      if (!absolutePath.endsWith(".glsl")) {
        absolutePath += ".glsl";
      }

      try {
        const includeResponse = await fetch(absolutePath);
        if (includeResponse.ok) {
          const includeCode = await includeResponse.text();
          shaderCode = shaderCode.replace(includeDirective, includeCode);
        } else {
          console.warn(
            `Could not load include: ${absolutePath} (${includeResponse.status})`
          );
          // Remove the include directive to prevent shader compilation errors
          shaderCode = shaderCode.replace(includeDirective, "");
        }
      } catch (error) {
        console.warn(`Could not load include: ${absolutePath}`, error);
        // Remove the include directive to prevent shader compilation errors
        shaderCode = shaderCode.replace(includeDirective, "");
      }
    }
  }

  return shaderCode;
}

export default function BlackHoleVisualization() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene?: THREE.Scene;
    renderer?: THREE.WebGLRenderer;
    animationId?: number;
    dither?: any;
    cleanup?: () => void;
  }>({});

  const [showControls, setShowControls] = useState(true);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H") {
        setShowControls(!showControls);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [showControls]);

  useEffect(() => {
    let mounted = true;

    const initScene = async () => {
      if (!mountRef.current || !mounted) return;

      try {
        // Load all shaders with includes processed
        const rawShaders = await loadShaders();

        // Process includes for shaders that need them
        const shaders = {
          ...rawShaders,
          discFragment: await loadShaderWithIncludes(
            "/shaders/disc/fragment.glsl"
          ),
          distortionHoleFragment: await loadShaderWithIncludes(
            "/shaders/distortionHole/fragment.glsl"
          ),
          distortionDiscFragment: await loadShaderWithIncludes(
            "/shaders/distortionDisc/fragment.glsl"
          ),
          compositionFragment: await loadShaderWithIncludes(
            "/shaders/composition/fragment.glsl"
          ),
          noisesFragment: await loadShaderWithIncludes(
            "/shaders/noises/fragment.glsl"
          ),
          ditherVertex: await fetch("/shaders/dither/vertex.glsl").then((r) =>
            r.text()
          ),
          ditherFragment: await fetch("/shaders/dither/fragment.glsl").then(
            (r) => r.text()
          ),
        };

        /**
         * Setup
         */
        const canvas = document.createElement("canvas");
        canvas.className = "webgl";
        mountRef.current.appendChild(canvas);

        const scene = new THREE.Scene();

        /**
         * Sizes
         */
        const sizes = { width: window.innerWidth, height: window.innerHeight };

        const handleResize = () => {
          sizes.width = window.innerWidth;
          sizes.height = window.innerHeight;

          camera.aspect = sizes.width / sizes.height;
          camera.updateProjectionMatrix();

          renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
          renderer.setSize(sizes.width, sizes.height);

          composition.distortionRenderTarget.setSize(
            sizes.width * renderer.getPixelRatio(),
            sizes.height * renderer.getPixelRatio()
          );

          composition.defaultRenderTarget.setSize(
            sizes.width * renderer.getPixelRatio(),
            sizes.height * renderer.getPixelRatio()
          );

          composition.preDistortionRenderTarget.setSize(
            sizes.width * renderer.getPixelRatio(),
            sizes.height * renderer.getPixelRatio()
          );
        };

        window.addEventListener("resize", handleResize);

        /**
         * Camera
         */
        const cameraGroup = new THREE.Group();
        scene.add(cameraGroup);

        const camera = new THREE.PerspectiveCamera(
          35,
          sizes.width / sizes.height,
          0.1,
          500
        );
        camera.position.set(0, 3, 10);
        cameraGroup.add(camera);

        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.zoomSpeed = 0.4;

        /**
         * Renderer
         */
        const renderer = new THREE.WebGLRenderer({
          canvas: canvas,
          antialias: true,
        });
        renderer.setClearColor("#130e16");
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.setSize(sizes.width, sizes.height);

        /**
         * Stars
         */
        const stars: any = {};
        stars.count = 10000;

        // Geometry
        const positionsArray = new Float32Array(stars.count * 3);
        const sizesArray = new Float32Array(stars.count);
        const colorsArray = new Float32Array(stars.count * 3);

        for (let i = 0; i < stars.count; i++) {
          const i3 = i * 3;

          // Positions
          const theta = 2 * Math.PI * Math.random();
          const phi = Math.acos(2 * Math.random() - 1.0);

          positionsArray[i3 + 0] = Math.cos(theta) * Math.sin(phi) * 400;
          positionsArray[i3 + 1] = Math.sin(theta) * Math.sin(phi) * 400;
          positionsArray[i3 + 2] = Math.cos(phi) * 400;

          // Sizes
          sizesArray[i] = 0.5 + Math.random() * 30;

          // Colors
          const hue = Math.round(Math.random() * 360);
          const lightness = Math.round(80 + Math.random() * 20);
          const color = new THREE.Color(`hsl(${hue}, 100%, ${lightness}%)`);

          colorsArray[i3 + 0] = color.r;
          colorsArray[i3 + 1] = color.g;
          colorsArray[i3 + 2] = color.b;
        }

        stars.geometry = new THREE.BufferGeometry();
        stars.geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positionsArray, 3)
        );
        stars.geometry.setAttribute(
          "size",
          new THREE.Float32BufferAttribute(sizesArray, 1)
        );
        stars.geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(colorsArray, 3)
        );

        // Material
        stars.material = new THREE.ShaderMaterial({
          transparent: true,
          vertexShader: shaders.starsVertex,
          fragmentShader: shaders.starsFragment,
        });

        // Points
        stars.points = new THREE.Points(stars.geometry, stars.material);
        scene.add(stars.points);

        /**
         * Noises
         */
        const noises: any = {};
        noises.scene = new THREE.Scene();
        noises.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        noises.camera.position.set(0, 0, 5);
        noises.scene.add(noises.camera);

        // Plane
        noises.plane = {};
        noises.plane.geometry = new THREE.PlaneGeometry(2, 2);
        noises.plane.material = new THREE.ShaderMaterial({
          vertexShader: shaders.noisesVertex,
          fragmentShader: shaders.noisesFragment,
        });
        noises.plane.mesh = new THREE.Mesh(
          noises.plane.geometry,
          noises.plane.material
        );
        noises.scene.add(noises.plane.mesh);

        // Render Target
        noises.renderTarget = new THREE.WebGLRenderTarget(256, 256, {
          generateMipmaps: false,
          type: THREE.FloatType,
          wrapS: THREE.RepeatWrapping,
          wrapT: THREE.RepeatWrapping,
        });

        // Render the noises into the render target
        renderer.setRenderTarget(noises.renderTarget);
        renderer.render(noises.scene, noises.camera);
        renderer.setRenderTarget(null);

        /**
         * Disc
         */
        const disc: any = {};

        // Gradient
        disc.gradient = {};
        disc.gradient.canvas = document.createElement("canvas");
        disc.gradient.canvas.width = 1;
        disc.gradient.canvas.height = 128;
        disc.gradient.context = disc.gradient.canvas.getContext("2d");
        disc.gradient.style = disc.gradient.context.createLinearGradient(
          0,
          0,
          0,
          disc.gradient.canvas.height
        );
        disc.gradient.style.addColorStop(0, "#fffbf9");
        disc.gradient.style.addColorStop(0.1, "#ffbc68");
        disc.gradient.style.addColorStop(0.2, "#ff5600");
        disc.gradient.style.addColorStop(0.4, "#ff0053");
        disc.gradient.style.addColorStop(0.8, "#cc00ff");
        disc.gradient.context.fillStyle = disc.gradient.style;
        disc.gradient.context.fillRect(
          0,
          0,
          disc.gradient.canvas.width,
          disc.gradient.canvas.height
        );
        disc.gradient.texture = new THREE.CanvasTexture(disc.gradient.canvas);

        // Mesh
        disc.geometry = new THREE.CylinderGeometry(1.5, 6, 0, 64, 8, true);
        disc.material = new THREE.ShaderMaterial({
          transparent: true,
          side: THREE.DoubleSide,
          vertexShader: shaders.discVertex,
          fragmentShader: shaders.discFragment,
          uniforms: {
            uTime: { value: 0 },
            uGradientTexture: { value: disc.gradient.texture },
            uNoisesTexture: { value: noises.renderTarget.texture },
          },
        });
        disc.mesh = new THREE.Mesh(disc.geometry, disc.material);
        scene.add(disc.mesh);

        /**
         * Distortion
         */
        const distortion: any = {};
        distortion.scene = new THREE.Scene();

        // Hole
        distortion.hole = {};
        distortion.hole.geometry = new THREE.PlaneGeometry(4, 4);
        distortion.hole.material = new THREE.ShaderMaterial({
          vertexShader: shaders.distortionHoleVertex,
          fragmentShader: shaders.distortionHoleFragment,
        });
        distortion.hole.mesh = new THREE.Mesh(
          distortion.hole.geometry,
          distortion.hole.material
        );
        distortion.scene.add(distortion.hole.mesh);

        // Disc
        distortion.disc = {};
        distortion.disc.geometry = new THREE.PlaneGeometry(12, 12);
        distortion.disc.material = new THREE.ShaderMaterial({
          transparent: true,
          side: THREE.DoubleSide,
          vertexShader: shaders.distortionDiscVertex,
          fragmentShader: shaders.distortionDiscFragment,
        });
        distortion.disc.mesh = new THREE.Mesh(
          distortion.disc.geometry,
          distortion.disc.material
        );
        distortion.disc.mesh.rotation.x = -Math.PI * 0.5;
        distortion.scene.add(distortion.disc.mesh);

        /**
         * Composition
         */
        const composition: any = {};

        composition.defaultRenderTarget = new THREE.WebGLRenderTarget(
          sizes.width * renderer.getPixelRatio(),
          sizes.height * renderer.getPixelRatio(),
          {
            generateMipmaps: false,
          }
        );

        composition.distortionRenderTarget = new THREE.WebGLRenderTarget(
          sizes.width * renderer.getPixelRatio(),
          sizes.height * renderer.getPixelRatio(),
          {
            generateMipmaps: false,
            format: THREE.RedFormat,
          }
        );

        // Add render target for dithering effect
        composition.preDistortionRenderTarget = new THREE.WebGLRenderTarget(
          sizes.width * renderer.getPixelRatio(),
          sizes.height * renderer.getPixelRatio(),
          {
            generateMipmaps: false,
          }
        );

        // Custom scene
        composition.scene = new THREE.Scene();
        composition.camera = new THREE.OrthographicCamera(
          -1,
          1,
          1,
          -1,
          0.1,
          10
        );
        composition.camera.position.set(0, 0, 5);
        composition.scene.add(composition.camera);

        // Plane
        composition.plane = {};
        composition.plane.geometry = new THREE.PlaneGeometry(2, 2);
        composition.plane.material = new THREE.ShaderMaterial({
          vertexShader: shaders.compositionVertex,
          fragmentShader: shaders.compositionFragment,
          uniforms: {
            uTime: { value: 0 },
            uDefaultTexture: {
              value: composition.preDistortionRenderTarget.texture,
            },
            uDistortionTexture: {
              value: composition.distortionRenderTarget.texture,
            },
            uConvergencePosition: { value: new THREE.Vector2() },
          },
        });
        composition.plane.mesh = new THREE.Mesh(
          composition.plane.geometry,
          composition.plane.material
        );
        composition.scene.add(composition.plane.mesh);

        /**
         * Dither Effect
         */
        const dither: any = {};
        dither.scene = new THREE.Scene();
        dither.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        dither.camera.position.set(0, 0, 5);
        dither.scene.add(dither.camera);

        // Dither plane
        dither.plane = {};
        dither.plane.geometry = new THREE.PlaneGeometry(2, 2);
        dither.plane.material = new THREE.ShaderMaterial({
          vertexShader: shaders.ditherVertex,
          fragmentShader: shaders.ditherFragment,
          uniforms: {
            tDiffuse: { value: null },
            resolution: {
              value: new THREE.Vector2(
                sizes.width * renderer.getPixelRatio(),
                sizes.height * renderer.getPixelRatio()
              ),
            },
            gridSize: { value: 3.0 },
            intensity: { value: 0.7 },
            time: { value: 0 },
            backgroundColor: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
            contrast: { value: 1.2 },
          },
        });
        dither.plane.mesh = new THREE.Mesh(
          dither.plane.geometry,
          dither.plane.material
        );
        dither.scene.add(dither.plane.mesh);

        /**
         * Tick loop
         */
        const clock = new THREE.Clock();

        const tick = () => {
          if (!mounted) return;

          // Elapsed Time
          const time = clock.getElapsedTime();

          // Update Disc
          disc.material.uniforms.uTime.value = time;

          // Update dither effect
          dither.plane.material.uniforms.time.value = time;
          dither.plane.material.uniforms.resolution.value.set(
            sizes.width * renderer.getPixelRatio(),
            sizes.height * renderer.getPixelRatio()
          );

          // Update camera and controls
          controls.update();
          camera.rotateZ(0.2);

          const cameraTime = time * 0.2;
          const shakeAmplitude = 0.1;
          cameraGroup.position.x =
            shakeAmplitude *
            Math.sin(cameraTime) *
            Math.sin(cameraTime * 2.1) *
            Math.sin(cameraTime * 4.3);
          cameraGroup.position.y =
            shakeAmplitude *
            Math.sin(cameraTime * 1.23) *
            Math.sin(cameraTime * 4.56) *
            Math.sin(cameraTime * 7.89);
          cameraGroup.position.z =
            shakeAmplitude *
            Math.sin(cameraTime * 3.45) *
            Math.sin(cameraTime * 6.78) *
            Math.sin(cameraTime * 9.01);

          camera.updateWorldMatrix(true, true);

          // Update distortion
          distortion.hole.mesh.lookAt(camera.position);

          // Update composition
          const screenPosition = new THREE.Vector3(0, 0, 0);
          screenPosition.project(camera);
          screenPosition.x = screenPosition.x * 0.5 + 0.5;
          screenPosition.y = screenPosition.y * 0.5 + 0.5;
          composition.plane.material.uniforms.uConvergencePosition.value.set(
            screenPosition.x,
            screenPosition.y
          );
          composition.plane.material.uniforms.uTime.value = time;

          // Render default scene to intermediate target
          renderer.setRenderTarget(composition.preDistortionRenderTarget);
          renderer.setClearColor("#130e16");
          renderer.render(scene, camera);
          renderer.setRenderTarget(null);

          // Render distortion scene
          renderer.setRenderTarget(composition.distortionRenderTarget);
          renderer.setClearColor("#000000");
          renderer.render(distortion.scene, camera);
          renderer.setRenderTarget(null);

          // Render composition scene to default target
          renderer.setRenderTarget(composition.defaultRenderTarget);
          renderer.setClearColor("#130e16");
          renderer.render(composition.scene, composition.camera);
          renderer.setRenderTarget(null);

          // Apply dithering effect as final pass
          dither.plane.material.uniforms.tDiffuse.value =
            composition.defaultRenderTarget.texture;
          renderer.render(dither.scene, dither.camera);

          // Keep ticking
          sceneRef.current.animationId = window.requestAnimationFrame(tick);
        };

        // Store references for cleanup
        sceneRef.current = {
          scene,
          renderer,
          dither,
          cleanup: () => {
            window.removeEventListener("resize", handleResize);
            controls.dispose();
            renderer.dispose();
            if (sceneRef.current.animationId) {
              window.cancelAnimationFrame(sceneRef.current.animationId);
            }
          },
        };

        tick();
      } catch (error) {
        console.error("Error initializing scene:", error);
      }
    };

    initScene();

    return () => {
      mounted = false;
      if (sceneRef.current.cleanup) {
        sceneRef.current.cleanup();
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Toggle Controls Button */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="absolute top-4 right-4 bg-black bg-opacity-80 backdrop-blur-sm px-3 py-2 rounded-lg border border-white border-opacity-20 text-white text-xs shadow-lg hover:bg-opacity-90 transition-all z-20"
        title="Toggle controls (Press H)"
      >
        {showControls ? "✕" : "⚙️"} Controls
      </button>

      {/* Dither Controls */}
      {showControls && (
        <div className="absolute top-16 right-4 bg-black bg-opacity-85 backdrop-blur-sm p-4 rounded-lg border border-white border-opacity-20 text-white text-sm w-64 shadow-lg z-10">
          <div className="mb-3">
            <label className="block mb-1 text-xs">Grid Size</label>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              defaultValue="3"
              onChange={(e) => {
                if (sceneRef.current.dither) {
                  sceneRef.current.dither.plane.material.uniforms.gridSize.value =
                    parseFloat(e.target.value);
                }
              }}
              className="w-full"
            />
          </div>
          <div className="mb-3">
            <label className="block mb-1 text-xs">Dither Intensity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              defaultValue="0.7"
              onChange={(e) => {
                if (sceneRef.current.dither) {
                  sceneRef.current.dither.plane.material.uniforms.intensity.value =
                    parseFloat(e.target.value);
                }
              }}
              className="w-full"
            />
          </div>
          <div className="mb-3">
            <label className="block mb-1 text-xs">Contrast</label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              defaultValue="1.2"
              onChange={(e) => {
                if (sceneRef.current.dither) {
                  sceneRef.current.dither.plane.material.uniforms.contrast.value =
                    parseFloat(e.target.value);
                }
              }}
              className="w-full"
            />
          </div>
          <div className="mb-3">
            <label className="block mb-1 text-xs">Background Color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                defaultValue="#000000"
                onChange={(e) => {
                  if (sceneRef.current.dither) {
                    const hex = e.target.value;
                    // Convert hex to RGB values (0-1 range)
                    const r = parseInt(hex.slice(1, 3), 16) / 255;
                    const g = parseInt(hex.slice(3, 5), 16) / 255;
                    const b = parseInt(hex.slice(5, 7), 16) / 255;
                    sceneRef.current.dither.plane.material.uniforms.backgroundColor.value.set(
                      r,
                      g,
                      b
                    );
                  }
                }}
                className="w-8 h-6 rounded border border-white cursor-pointer"
                title="Custom Color"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (sceneRef.current.dither) {
                      sceneRef.current.dither.plane.material.uniforms.backgroundColor.value.set(
                        0,
                        0,
                        0
                      );
                    }
                  }}
                  className="w-5 h-5 bg-black border border-white rounded-sm"
                  title="Black"
                />
                <button
                  onClick={() => {
                    if (sceneRef.current.dither) {
                      sceneRef.current.dither.plane.material.uniforms.backgroundColor.value.set(
                        0.1,
                        0.1,
                        0.2
                      );
                    }
                  }}
                  className="w-5 h-5 border border-white rounded-sm"
                  style={{ backgroundColor: "rgb(25, 25, 51)" }}
                  title="Dark Blue"
                />
                <button
                  onClick={() => {
                    if (sceneRef.current.dither) {
                      sceneRef.current.dither.plane.material.uniforms.backgroundColor.value.set(
                        0.2,
                        0.1,
                        0.2
                      );
                    }
                  }}
                  className="w-5 h-5 border border-white rounded-sm"
                  style={{ backgroundColor: "rgb(51, 25, 51)" }}
                  title="Dark Purple"
                />
              </div>
            </div>
          </div>
          <div>
            <small className="text-xs opacity-75">High-Contrast Dither</small>
          </div>
        </div>
      )}
      <div ref={mountRef} className="w-full h-full absolute inset-0"></div>
    </div>
  );
}
