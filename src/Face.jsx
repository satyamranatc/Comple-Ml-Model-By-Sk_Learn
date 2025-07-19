import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

export default function ImprovedFaceTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const threeContainerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [faceData, setFaceData] = useState({
    xAngle: 0,
    yAngle: 0,
    position: { x: 0, y: 0 },
    mouthOpen: false,
    eyesOpen: { left: true, right: true },
    detected: false,
    confidence: 0,
    faceCenter: { x: 0, y: 0 },
    faceSize: 0
  });

  // Three.js refs
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const faceGroupRef = useRef(null);
  const animationIdRef = useRef(null);
  
  // Face tracking state
  const previousFaceRef = useRef(null);
  const faceHistoryRef = useRef([]);

  useEffect(() => {
    let mediaStream = null;
    let isProcessing = false;

    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            videoRef.current.onloadedmetadata = resolve;
          });
          videoRef.current.play();
        }
        
        mediaStream = stream;
        setIsLoading(false);
      } catch (err) {
        setError('Camera access denied or unavailable');
        setIsLoading(false);
      }
    };

    const initializeThreeJS = () => {
      if (!threeContainerRef.current) return;

      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0a0a);
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      camera.position.set(0, 0, 6);
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(400, 400);
      renderer.setClearColor(0x0a0a0a);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      threeContainerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lighting setup
      const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      const rimLight = new THREE.DirectionalLight(0x4a90e2, 0.3);
      rimLight.position.set(-5, 0, -5);
      scene.add(rimLight);

      // Create realistic 3D face
      const faceGroup = new THREE.Group();
      
      // Head (more realistic proportions)
      const headGeometry = new THREE.SphereGeometry(1.2, 32, 32);
      // Flatten the head slightly
      const headVertices = headGeometry.attributes.position.array;
      for (let i = 0; i < headVertices.length; i += 3) {
        const z = headVertices[i + 2];
        headVertices[i + 2] = z * 0.8; // Flatten front-to-back
      }
      headGeometry.attributes.position.needsUpdate = true;
      
      const headMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xffdbac,
        transparent: true,
        opacity: 0.95
      });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.castShadow = true;
      head.receiveShadow = true;
      faceGroup.add(head);

      // Eyes (more realistic)
      const eyeGeometry = new THREE.SphereGeometry(0.18, 16, 16);
      const eyeMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff,
        shininess: 30
      });
      
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.35, 0.25, 0.85);
      leftEye.name = 'leftEye';
      leftEye.castShadow = true;
      
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.35, 0.25, 0.85);
      rightEye.name = 'rightEye';
      rightEye.castShadow = true;

      // Pupils with iris
      const irisGeometry = new THREE.SphereGeometry(0.12, 16, 16);
      const irisMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4a90e2,
        shininess: 50
      });
      
      const leftIris = new THREE.Mesh(irisGeometry, irisMaterial);
      leftIris.position.set(-0.35, 0.25, 0.95);
      leftIris.name = 'leftIris';
      
      const rightIris = new THREE.Mesh(irisGeometry, irisMaterial);
      rightIris.position.set(0.35, 0.25, 0.95);
      rightIris.name = 'rightIris';

      const pupilGeometry = new THREE.SphereGeometry(0.06, 16, 16);
      const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
      
      const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
      leftPupil.position.set(-0.35, 0.25, 1.0);
      leftPupil.name = 'leftPupil';
      
      const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
      rightPupil.position.set(0.35, 0.25, 1.0);
      rightPupil.name = 'rightPupil';

      faceGroup.add(leftEye, rightEye, leftIris, rightIris, leftPupil, rightPupil);

      // Eyebrows
      const eyebrowGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
      const eyebrowMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
      
      const leftEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial);
      leftEyebrow.position.set(-0.35, 0.45, 0.8);
      leftEyebrow.rotation.z = Math.PI / 2;
      
      const rightEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial);
      rightEyebrow.position.set(0.35, 0.45, 0.8);
      rightEyebrow.rotation.z = Math.PI / 2;
      
      faceGroup.add(leftEyebrow, rightEyebrow);

      // Nose (more realistic)
      const noseGeometry = new THREE.ConeGeometry(0.1, 0.4, 8);
      const noseMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
      const nose = new THREE.Mesh(noseGeometry, noseMaterial);
      nose.position.set(0, 0.05, 0.95);
      nose.rotation.x = Math.PI / 2;
      nose.castShadow = true;
      faceGroup.add(nose);

      // Nostrils
      const nostrilGeometry = new THREE.SphereGeometry(0.03, 8, 8);
      const nostrilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
      
      const leftNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
      leftNostril.position.set(-0.06, -0.1, 1.05);
      
      const rightNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
      rightNostril.position.set(0.06, -0.1, 1.05);
      
      faceGroup.add(leftNostril, rightNostril);

      // Mouth (more realistic)
      const mouthGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16);
      const mouthMaterial = new THREE.MeshLambertMaterial({ color: 0xcd5c5c });
      const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
      mouth.position.set(0, -0.35, 0.85);
      mouth.rotation.x = Math.PI / 2;
      mouth.name = 'mouth';
      mouth.castShadow = true;
      faceGroup.add(mouth);

      // Teeth
      const teethGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16);
      const teethMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff,
        shininess: 100
      });
      const teeth = new THREE.Mesh(teethGeometry, teethMaterial);
      teeth.position.set(0, -0.35, 0.88);
      teeth.rotation.x = Math.PI / 2;
      teeth.name = 'teeth';
      faceGroup.add(teeth);

      // Ears
      const earGeometry = new THREE.SphereGeometry(0.2, 12, 12);
      const earMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
      
      const leftEar = new THREE.Mesh(earGeometry, earMaterial);
      leftEar.position.set(-1.1, 0.1, 0);
      leftEar.scale.set(0.6, 1, 0.3);
      
      const rightEar = new THREE.Mesh(earGeometry, earMaterial);
      rightEar.position.set(1.1, 0.1, 0);
      rightEar.scale.set(0.6, 1, 0.3);
      
      faceGroup.add(leftEar, rightEar);

      scene.add(faceGroup);
      faceGroupRef.current = faceGroup;

      // Animation loop
      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);
        
        // Add subtle breathing animation
        const time = Date.now() * 0.001;
        if (faceGroupRef.current) {
          faceGroupRef.current.position.y = Math.sin(time * 2) * 0.02;
        }
        
        renderer.render(scene, camera);
      };
      animate();
    };

    // Improved face detection using brightness and contrast analysis
    const detectFaceImproved = (imageData) => {
      const { data, width, height } = imageData;
      
      // Convert to grayscale and apply simple face detection
      const grayData = new Uint8Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        grayData[i / 4] = gray;
      }
      
      // Simple face detection using Viola-Jones-like approach
      const faceRegions = findFaceRegions(grayData, width, height);
      
      if (faceRegions.length === 0) {
        return { detected: false, confidence: 0 };
      }
      
      // Get the largest face region
      const mainFace = faceRegions.reduce((largest, current) => 
        current.area > largest.area ? current : largest
      );
      
      // Calculate face orientation and features
      const faceAnalysis = analyzeFaceRegion(mainFace, width, height);
      
      // Apply temporal smoothing
      const smoothedFace = applySmoothingFilter(faceAnalysis);
      
      return smoothedFace;
    };

    const findFaceRegions = (grayData, width, height) => {
      const regions = [];
      const visited = new Set();
      
      // Simple cascade-like detection
      for (let y = 20; y < height - 20; y += 10) {
        for (let x = 20; x < width - 20; x += 10) {
          if (visited.has(`${x},${y}`)) continue;
          
          const region = detectFaceAtPoint(x, y, grayData, width, height);
          if (region && region.confidence > 0.3) {
            regions.push(region);
            // Mark area as visited
            for (let dy = -20; dy <= 20; dy += 5) {
              for (let dx = -20; dx <= 20; dx += 5) {
                visited.add(`${x + dx},${y + dy}`);
              }
            }
          }
        }
      }
      
      return regions;
    };

    const detectFaceAtPoint = (centerX, centerY, grayData, width, height) => {
      const faceWidth = Math.min(120, width / 3);
      const faceHeight = Math.min(150, height / 3);
      
      const x1 = Math.max(0, centerX - faceWidth / 2);
      const y1 = Math.max(0, centerY - faceHeight / 2);
      const x2 = Math.min(width, centerX + faceWidth / 2);
      const y2 = Math.min(height, centerY + faceHeight / 2);
      
      let brightness = 0;
      let pixelCount = 0;
      let variance = 0;
      const pixels = [];
      
      // Calculate brightness and variance
      for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
          const index = y * width + x;
          if (index < grayData.length) {
            const value = grayData[index];
            pixels.push(value);
            brightness += value;
            pixelCount++;
          }
        }
      }
      
      if (pixelCount === 0) return null;
      
      brightness /= pixelCount;
      
      // Calculate variance
      for (const pixel of pixels) {
        variance += Math.pow(pixel - brightness, 2);
      }
      variance /= pixelCount;
      
      // Face detection heuristics
      const isLikelyFace = (
        brightness > 80 && brightness < 200 &&  // Reasonable skin brightness
        variance > 400 &&  // Sufficient contrast (features)
        variance < 3000 && // Not too noisy
        faceWidth > 40 &&  // Minimum size
        faceHeight > 50
      );
      
      if (!isLikelyFace) return null;
      
      const confidence = Math.min(1, (variance / 1000) * (brightness / 150));
      
      return {
        x: centerX,
        y: centerY,
        width: faceWidth,
        height: faceHeight,
        area: faceWidth * faceHeight,
        confidence: confidence,
        brightness: brightness,
        variance: variance
      };
    };

    const analyzeFaceRegion = (face, imgWidth, imgHeight) => {
      const centerX = imgWidth / 2;
      const centerY = imgHeight / 2;
      
      // Calculate angles based on face position
      const xOffset = (face.x - centerX) / centerX;
      const yOffset = (face.y - centerY) / centerY;
      
      const yAngle = Math.max(-45, Math.min(45, xOffset * 30));
      const xAngle = Math.max(-30, Math.min(30, yOffset * 25));
      
      // Estimate facial expressions based on face dimensions and position
      const aspectRatio = face.height / face.width;
      const mouthOpen = face.variance > 1200 && aspectRatio > 1.4;
      
      // Simple eye state estimation
      const eyesOpen = {
        left: face.brightness > 90 && face.variance > 500,
        right: face.brightness > 90 && face.variance > 500
      };
      
      return {
        detected: true,
        confidence: face.confidence,
        xAngle,
        yAngle,
        position: {
          x: face.x - centerX,
          y: face.y - centerY
        },
        faceCenter: { x: face.x, y: face.y },
        faceSize: Math.max(face.width, face.height),
        mouthOpen,
        eyesOpen,
        brightness: face.brightness,
        variance: face.variance
      };
    };

    const applySmoothingFilter = (currentFace) => {
      if (!currentFace.detected) return currentFace;
      
      // Add to history
      faceHistoryRef.current.push(currentFace);
      if (faceHistoryRef.current.length > 3) {
        faceHistoryRef.current.shift();
      }
      
      // Apply temporal smoothing
      if (previousFaceRef.current && previousFaceRef.current.detected) {
        const alpha = 0.7; // Smoothing factor
        currentFace.xAngle = previousFaceRef.current.xAngle * alpha + currentFace.xAngle * (1 - alpha);
        currentFace.yAngle = previousFaceRef.current.yAngle * alpha + currentFace.yAngle * (1 - alpha);
        currentFace.position.x = previousFaceRef.current.position.x * alpha + currentFace.position.x * (1 - alpha);
        currentFace.position.y = previousFaceRef.current.position.y * alpha + currentFace.position.y * (1 - alpha);
      }
      
      previousFaceRef.current = currentFace;
      return currentFace;
    };

    const processVideo = async () => {
      if (!videoRef.current || !canvasRef.current || isProcessing) {
        setTimeout(processVideo, 50);
        return;
      }
      
      isProcessing = true;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0);
        
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const faceDetection = detectFaceImproved(imageData);
          
          // Draw detection overlay
          if (faceDetection.detected) {
            ctx.strokeStyle = `rgba(0, 255, 0, ${faceDetection.confidence})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(
              faceDetection.faceCenter.x - faceDetection.faceSize / 2,
              faceDetection.faceCenter.y - faceDetection.faceSize / 2,
              faceDetection.faceSize,
              faceDetection.faceSize
            );
            
            // Draw center point
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(faceDetection.faceCenter.x, faceDetection.faceCenter.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw angle indicator
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(faceDetection.faceCenter.x, faceDetection.faceCenter.y);
            const angleLength = 40;
            const radianY = (faceDetection.yAngle * Math.PI) / 180;
            const radianX = (faceDetection.xAngle * Math.PI) / 180;
            ctx.lineTo(
              faceDetection.faceCenter.x + Math.cos(radianY) * angleLength,
              faceDetection.faceCenter.y + Math.sin(radianX) * angleLength
            );
            ctx.stroke();
          }
          
          // Update state
          setFaceData(faceDetection);

          // Update 3D face
          if (faceGroupRef.current && faceDetection.detected) {
            const rotationY = faceDetection.yAngle * (Math.PI / 180) * 0.6;
            const rotationX = -faceDetection.xAngle * (Math.PI / 180) * 0.6;
            
            faceGroupRef.current.rotation.y = rotationY;
            faceGroupRef.current.rotation.x = rotationX;
            
            // Animate eyes
            const leftEye = faceGroupRef.current.getObjectByName('leftEye');
            const rightEye = faceGroupRef.current.getObjectByName('rightEye');
            const leftIris = faceGroupRef.current.getObjectByName('leftIris');
            const rightIris = faceGroupRef.current.getObjectByName('rightIris');
            const leftPupil = faceGroupRef.current.getObjectByName('leftPupil');
            const rightPupil = faceGroupRef.current.getObjectByName('rightPupil');
            
            if (leftEye && rightEye) {
              const leftOpen = faceDetection.eyesOpen.left ? 1 : 0.1;
              const rightOpen = faceDetection.eyesOpen.right ? 1 : 0.1;
              
              leftEye.scale.y = leftOpen;
              rightEye.scale.y = rightOpen;
              if (leftIris) leftIris.scale.y = leftOpen;
              if (rightIris) rightIris.scale.y = rightOpen;
              if (leftPupil) leftPupil.scale.y = leftOpen;
              if (rightPupil) rightPupil.scale.y = rightOpen;
            }
            
            // Animate mouth
            const mouth = faceGroupRef.current.getObjectByName('mouth');
            const teeth = faceGroupRef.current.getObjectByName('teeth');
            if (mouth) {
              const mouthScale = faceDetection.mouthOpen ? 1.5 : 1;
              mouth.scale.y = mouthScale;
              mouth.scale.x = mouthScale;
              if (teeth) {
                teeth.visible = faceDetection.mouthOpen;
              }
            }
          }
          
        } catch (err) {
          console.error('Face processing error:', err);
        }
      }
      
      isProcessing = false;
      setTimeout(processVideo, 33); // ~30 FPS
    };

    const initialize = async () => {
      await initializeCamera();
      initializeThreeJS();
      processVideo();
    };

    initialize();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current && threeContainerRef.current && 
          threeContainerRef.current.contains(rendererRef.current.domElement)) {
        threeContainerRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
        <div className="text-red-400 text-xl mb-4">❌ {error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
        >
          Retry Camera Access
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Advanced Face Tracker
        </h1>
        
        {isLoading && (
          <div className="text-center text-xl mb-8">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-white border-t-transparent rounded-full mr-3"></div>
            Initializing camera and face detection...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-1">
            <div className="bg-black rounded-lg overflow-hidden shadow-2xl relative">
              <video
                ref={videoRef}
                className="w-full h-auto transform scale-x-[-1]"
                autoPlay
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
                style={{ mixBlendMode: 'screen' }}
              />
              <div className="absolute top-4 left-4 bg-black bg-opacity-80 px-3 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${faceData.detected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                  <span className="text-sm font-medium">
                    {faceData.detected ? `${(faceData.confidence * 100).toFixed(0)}%` : 'No Face'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Face Model */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4 shadow-2xl">
              <h2 className="text-xl font-semibold mb-4 text-center text-cyan-400">3D Face Model</h2>
              <div 
                ref={threeContainerRef}
                className="w-full flex justify-center items-center bg-black rounded-lg"
                style={{ minHeight: '400px' }}
              />
              <div className="mt-4 text-center">
                <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                  faceData.detected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    faceData.detected ? 'bg-green-400' : 'bg-red-400'
                  } mr-2 animate-pulse`}></div>
                  {faceData.detected ? 'Tracking Active' : 'Searching for Face'}
                </div>
              </div>
            </div>
          </div>

          {/* Face Analytics */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
              <h2 className="text-xl font-semibold mb-4 text-cyan-400">Head Rotation</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-purple-300">Pitch (Up/Down)</span>
                    <span className="text-cyan-300 font-mono text-lg">{faceData.xAngle.toFixed(1)}°</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-cyan-400 to-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.abs(faceData.xAngle) * 3)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-purple-300">Yaw (Left/Right)</span>
                    <span className="text-cyan-300 font-mono text-lg">{faceData.yAngle.toFixed(1)}°</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-purple-400 to-pink-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.abs(faceData.yAngle) * 2)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};