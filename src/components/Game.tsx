import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface GameState {
  score: number;
  isGameOver: boolean;
  bananas: THREE.Mesh[];
  monkey: THREE.Mesh | null;
  speed: number;
  lives: number;
}

interface AudioAssets {
  backgroundMusic: HTMLAudioElement;
  collectSound: HTMLAudioElement;
  loseLifeSound: HTMLAudioElement;
  gameOverSound: HTMLAudioElement;
}

const INITIAL_STATE: GameState = {
  score: 0,
  isGameOver: false,
  bananas: [],
  monkey: null,
  speed: 0.02,
  lives: 3,
};

const Game: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gameStateRef = useRef<GameState>({ ...INITIAL_STATE });
  const audioRef = useRef<AudioAssets | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const animationFrameRef = useRef<number>();
  const [audioMessage, setAudioMessage] = useState("");
  const spawnIntervalRef = useRef(2000);
  const lastSpawnTimeRef = useRef(0);
  const [countdown, setCountdown] = useState(3);
  const countdownActiveRef = useRef(false);

  // Initialize audio assets
  useEffect(() => {
    // Create a shared audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a better beep sound function
    const createBeepSound = (type: string, frequency: number, duration: number, volume: number) => {
      return () => {
        try {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.type = type as OscillatorType;
          oscillator.frequency.value = frequency;
          gainNode.gain.value = volume;
          
          oscillator.start();
          setTimeout(() => {
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
            setTimeout(() => oscillator.stop(), 100);
          }, duration);
        } catch (e) {
          console.error("Error playing sound:", e);
        }
      };
    };

    // Background music controller
    let bgMusicTimer: number | null = null;
    
    // Create the background music player
    const playBackgroundMusic = () => {
      if (!audioEnabled) return;
      
      // Clear any existing timers
      if (bgMusicTimer) {
        clearTimeout(bgMusicTimer);
        bgMusicTimer = null;
      }
      
      // Define notes and durations directly without using them as parameters
      const notes = [262, 330, 392, 523, 392, 330];
      const durations = [400, 400, 400, 600, 400, 600];
      let currentIndex = 0;
      
      const playNextNote = () => {
        if (!audioEnabled) return;
        
        try {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          
          osc.connect(gain);
          gain.connect(audioContext.destination);
          
          // Use a nicer sounding waveform
          osc.type = 'triangle';
          osc.frequency.value = notes[currentIndex];
          gain.gain.value = 0.03;
          
          // Add envelope for smoother sound
          gain.gain.setValueAtTime(0, audioContext.currentTime);
          gain.gain.linearRampToValueAtTime(0.03, audioContext.currentTime + 0.01);
          gain.gain.linearRampToValueAtTime(0.015, audioContext.currentTime + durations[currentIndex]/1000 - 0.05);
          gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + durations[currentIndex]/1000);
          
          osc.start();
          osc.stop(audioContext.currentTime + durations[currentIndex]/1000);
          
          // Get the current duration before changing the index
          const currentDuration = durations[currentIndex];
          
          // Move to next note
          currentIndex = (currentIndex + 1) % notes.length;
          
          // Schedule next note with the current duration
          bgMusicTimer = window.setTimeout(playNextNote, currentDuration);
        } catch (e) {
          console.error("Error playing note:", e);
        }
      };
      
      // Start with the first note
      playNextNote();
    };
    
    const stopBackgroundMusic = () => {
      if (bgMusicTimer) {
        clearTimeout(bgMusicTimer);
        bgMusicTimer = null;
      }
    };
    
    // Set up all sound effects
    audioRef.current = {
      backgroundMusic: { 
        play: playBackgroundMusic, 
        pause: stopBackgroundMusic, 
        volume: 0.4 
      } as any,
      collectSound: { 
        play: createBeepSound('sine', 800, 150, 0.05),
        volume: 0.6 
      } as any,
      loseLifeSound: { 
        play: createBeepSound('sawtooth', 300, 300, 0.04),
        volume: 0.6 
      } as any,
      gameOverSound: { 
        play: createBeepSound('square', 200, 500, 0.3), 
        volume: 0.7 
      } as any
    };
    
    // Play music when enabled
    if (audioEnabled) {
      playBackgroundMusic();
    }
    
    return () => {
      // Stop all sounds on cleanup
      stopBackgroundMusic();
    };
  }, [audioEnabled]);
  
  // Countdown effect
  useEffect(() => {
    // Only run when countdown is active and has a valid value
    if (countdownActiveRef.current) {
      console.log(`Countdown value: ${countdown}`);
      
      if (countdown > 0) {
        // Set timer for next countdown value
        const timer = setTimeout(() => {
          setCountdown(countdown - 1);
        }, 1000);
        
        return () => clearTimeout(timer);
      } 
      else if (countdown === 0) {
        // When countdown reaches zero, wait 1 second then end countdown
        const timer = setTimeout(() => {
          countdownActiveRef.current = false;
          console.log("Countdown complete, game resumed");
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [countdown]);
  
  // Function to toggle audio
  const toggleAudio = () => {
    if (!audioRef.current) return;
    
    if (!audioEnabled) {
      setAudioMessage("Initializing audio...");
      setAudioEnabled(true);
      
      // Create and resume AudioContext on user interaction
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const context = new AudioContextClass();
        
        // Resume context if needed
        if (context.state !== 'running') {
          context.resume().then(() => {
            console.log('AudioContext resumed successfully');
          }).catch(error => {
            console.error('Failed to resume AudioContext:', error);
          });
        }
      } catch (e) {
        console.error('Failed to initialize AudioContext:', e);
      }
      
      // Show message briefly
      setTimeout(() => {
        setAudioMessage("");
      }, 1500);
    } else {
      if (audioRef.current.backgroundMusic) {
        audioRef.current.backgroundMusic.pause();
      }
      setAudioEnabled(false);
    }
  };
  
  // Function to play a sound effect
  const playSound = (soundType: keyof Omit<AudioAssets, 'backgroundMusic'>) => {
    if (!audioRef.current || !audioEnabled) return;
    
    try {
      audioRef.current[soundType].play();
    } catch (e) {
      console.error(`Error with sound ${soundType}:`, e);
    }
  };

  // Play banana collect sound
  const playCollectSound = () => {
    if (audioRef.current && audioEnabled) {
      audioRef.current.collectSound.play();
    }
  };
  
  // Play lose life sound
  const playLoseLifeSound = () => {
    if (audioRef.current && audioEnabled) {
      audioRef.current.loseLifeSound.play();
    }
  };
  
  // Play game over sound
  const playGameOverSound = () => {
    if (audioRef.current && audioEnabled) {
      // Stop background music first by setting audioEnabled to false temporarily
      const wasAudioEnabled = audioEnabled;
      setAudioEnabled(false);
      
      // Then play game over sound
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.gameOverSound.play();
          // Keep audio enabled off after game over
        }
      }, 100);
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.OrthographicCamera(
      -5, 5, 3, -3, 0.1, 1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(800, 600);
    renderer.setClearColor(0x87CEEB); // Sky blue background
    mountRef.current.appendChild(renderer.domElement);

    // Background
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      'https://images.unsplash.com/photo-1596237563267-84ffd99c80e1?auto=format&fit=crop&w=800&q=80',
      (texture) => {
        const backgroundGeometry = new THREE.PlaneGeometry(10, 6);
        const backgroundMaterial = new THREE.MeshBasicMaterial({ 
          map: texture,
          transparent: true,
          opacity: 0.8
        });
        const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        background.position.z = -1;
        scene.add(background);
      }
    );

    // Monkey setup
    const createMonkey = () => {
      // Create a group to hold all monkey parts
      const monkeyGroup = new THREE.Group();
      
      // Body (larger circle)
      const bodyGeometry = new THREE.CircleGeometry(0.3, 32);
      const bodyMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x8B4513, // Brown color for monkey body
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      monkeyGroup.add(body);
      
      // Face/head (slightly smaller and different color)
      const faceGeometry = new THREE.CircleGeometry(0.25, 32);
      const faceMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xD2B48C, // Tan color for face
      });
      const face = new THREE.Mesh(faceGeometry, faceMaterial);
      face.position.z = 0.01; // Slightly in front of body
      monkeyGroup.add(face);
      
      // Eyes (two small circles)
      const eyeGeometry = new THREE.CircleGeometry(0.04, 16);
      const eyeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000, // Black color for eyes
      });
      
      // Left eye
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.1, 0.08, 0.02);
      monkeyGroup.add(leftEye);
      
      // Right eye
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.1, 0.08, 0.02);
      monkeyGroup.add(rightEye);
      
      // White part of eyes
      const eyeWhiteGeometry = new THREE.CircleGeometry(0.02, 12);
      const eyeWhiteMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF, // White color
      });
      
      // Left eye white
      const leftEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
      leftEyeWhite.position.set(-0.09, 0.07, 0.03);
      monkeyGroup.add(leftEyeWhite);
      
      // Right eye white
      const rightEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
      rightEyeWhite.position.set(0.09, 0.07, 0.03);
      monkeyGroup.add(rightEyeWhite);
      
      // Mouth (different shapes for different emotions)
      // Happy mouth (default)
      const happyMouthGeometry = new THREE.RingGeometry(0.08, 0.1, 16, 2, 0, Math.PI);
      const mouthMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000, // Black color for mouth
        side: THREE.DoubleSide
      });
      const happyMouth = new THREE.Mesh(happyMouthGeometry, mouthMaterial);
      happyMouth.position.set(0, -0.05, 0.02);
      happyMouth.name = "happyMouth";
      happyMouth.visible = true;
      monkeyGroup.add(happyMouth);
      
      // Sad mouth (inverted smile, hidden by default)
      const sadMouthGeometry = new THREE.RingGeometry(0.08, 0.1, 16, 2, Math.PI, Math.PI);
      const sadMouth = new THREE.Mesh(sadMouthGeometry, mouthMaterial);
      sadMouth.position.set(0, -0.1, 0.02);
      sadMouth.rotation.z = Math.PI;
      sadMouth.name = "sadMouth";
      sadMouth.visible = false;
      monkeyGroup.add(sadMouth);
      
      // Crying tears (hidden by default)
      const tearGeometry = new THREE.CircleGeometry(0.02, 8);
      const tearMaterial = new THREE.MeshBasicMaterial({
        color: 0x1E90FF, // Blue color for tears
      });
      
      // Left tear
      const leftTear = new THREE.Mesh(tearGeometry, tearMaterial);
      leftTear.position.set(-0.1, 0.0, 0.03);
      leftTear.name = "leftTear";
      leftTear.visible = false;
      monkeyGroup.add(leftTear);
      
      // Right tear
      const rightTear = new THREE.Mesh(tearGeometry, tearMaterial);
      rightTear.position.set(0.1, 0.0, 0.03);
      rightTear.name = "rightTear";
      rightTear.visible = false;
      monkeyGroup.add(rightTear);
      
      // Ears (two small circles)
      const earGeometry = new THREE.CircleGeometry(0.1, 16);
      const earMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x8B4513, // Brown color for ears (same as body)
      });
      
      // Left ear
      const leftEar = new THREE.Mesh(earGeometry, earMaterial);
      leftEar.position.set(-0.27, 0.1, -0.01);
      monkeyGroup.add(leftEar);
      
      // Right ear
      const rightEar = new THREE.Mesh(earGeometry, earMaterial);
      rightEar.position.set(0.27, 0.1, -0.01);
      monkeyGroup.add(rightEar);
      
      // Arms (two elongated shapes)
      const armGeometry = new THREE.PlaneGeometry(0.1, 0.3);
      const armMaterial = new THREE.MeshBasicMaterial({
        color: 0x8B4513, // Brown color for arms (same as body)
      });
      
      // Left arm
      const leftArm = new THREE.Mesh(armGeometry, armMaterial);
      leftArm.position.set(-0.35, -0.15, 0.0);
      leftArm.rotation.z = -0.3; // Angle the arm slightly
      leftArm.name = "leftArm";
      monkeyGroup.add(leftArm);
      
      // Right arm
      const rightArm = new THREE.Mesh(armGeometry, armMaterial);
      rightArm.position.set(0.35, -0.15, 0.0);
      rightArm.rotation.z = 0.3; // Angle the arm slightly
      rightArm.name = "rightArm";
      monkeyGroup.add(rightArm);
      
      // Legs (two elongated shapes)
      const legGeometry = new THREE.PlaneGeometry(0.12, 0.35);
      const legMaterial = new THREE.MeshBasicMaterial({
        color: 0x8B4513, // Brown color for legs (same as body)
      });
      
      // Left leg
      const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
      leftLeg.position.set(-0.15, -0.5, 0.0);
      leftLeg.name = "leftLeg";
      monkeyGroup.add(leftLeg);
      
      // Right leg
      const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
      rightLeg.position.set(0.15, -0.5, 0.0);
      rightLeg.name = "rightLeg";
      monkeyGroup.add(rightLeg);
      
      // Tail (curved line)
      const tailCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, -0.3, 0),
        new THREE.Vector3(0.2, -0.5, 0),
        new THREE.Vector3(0.4, -0.3, 0)
      );
      
      const tailGeometry = new THREE.TubeGeometry(tailCurve, 20, 0.03, 8, false);
      const tailMaterial = new THREE.MeshBasicMaterial({
        color: 0x8B4513, // Brown color for tail (same as body)
      });
      
      const tail = new THREE.Mesh(tailGeometry, tailMaterial);
      tail.name = "tail";
      monkeyGroup.add(tail);
      
      // Store emotion state in userData for animation
      monkeyGroup.userData = {
        emotionState: "happy", // happy, sad, or crying
        tearOffset: 0,
        armOffset: 0,
        legOffset: 0,
        tailRotation: 0
      };
      
      return monkeyGroup;
    };
    
    // Create the monkey and add to scene
    const monkey = createMonkey();
    monkey.position.y = -2.5;
    scene.add(monkey);
    gameStateRef.current.monkey = monkey;

    // Keyboard controls
    const handleKeyDown = (event: KeyboardEvent) => {
      if (gameStateRef.current.isGameOver || !gameStateRef.current.monkey) return;

      const speed = 0.2;
      if (event.key === 'ArrowLeft' && gameStateRef.current.monkey.position.x > -4.7) {
        gameStateRef.current.monkey.position.x -= speed;
      }
      if (event.key === 'ArrowRight' && gameStateRef.current.monkey.position.x < 4.7) {
        gameStateRef.current.monkey.position.x += speed;
      }
    };

    // Touch controls for mobile
    let touchStartX = 0;
    const handleTouchStart = (event: TouchEvent) => {
      touchStartX = event.touches[0].clientX;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (gameStateRef.current.isGameOver || !gameStateRef.current.monkey) return;

      const touchX = event.touches[0].clientX;
      const diff = touchX - touchStartX;
      const speed = 0.01;

      if (diff < 0 && gameStateRef.current.monkey.position.x > -4.7) {
        gameStateRef.current.monkey.position.x -= speed * Math.abs(diff);
      }
      if (diff > 0 && gameStateRef.current.monkey.position.x < 4.7) {
        gameStateRef.current.monkey.position.x += speed * Math.abs(diff);
      }

      touchStartX = touchX;
    };

    // Spawn banana function
    const spawnBanana = () => {
      // Create a banana-shaped object instead of a simple circle
      const createBanana = () => {
        const bananaGroup = new THREE.Group();
        
        // Main banana body (slightly curved shape using scaled ellipse)
        const bananaBodyGeometry = new THREE.CircleGeometry(0.2, 32);
        const bananaBodyMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFF00, // Yellow color for banana
      });
        const bananaBody = new THREE.Mesh(bananaBodyGeometry, bananaBodyMaterial);
        bananaBody.scale.y = 1.5; // Make it elliptical
        bananaGroup.add(bananaBody);
        
        // Add darker yellow "tips" to the banana for more realism
        const tipGeometry = new THREE.CircleGeometry(0.05, 16);
        const tipMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xDAA520, // Golden rod color for tips
        });
        
        // Top tip
        const topTip = new THREE.Mesh(tipGeometry, tipMaterial);
        topTip.position.set(0, 0.23, 0.01);
        bananaGroup.add(topTip);
        
        // Bottom tip
        const bottomTip = new THREE.Mesh(tipGeometry, tipMaterial);
        bottomTip.position.set(0, -0.23, 0.01);
        bananaGroup.add(bottomTip);
        
        return bananaGroup;
      };
      
      const banana = createBanana();
      banana.position.x = (Math.random() - 0.5) * 9;
      banana.position.y = 3;
      scene.add(banana);
      gameStateRef.current.bananas.push(banana);
    };

    // Game loop
    let monkeyAnimationTime = 0;

    const animate = (time: number) => {
      // Debug every few seconds to avoid flooding the console
      if (time % 1000 < 10) {
        console.log(`Animation frame: gameOver=${gameStateRef.current.isGameOver}, countdownActive=${countdownActiveRef.current}, countdown=${countdown}`);
      }
      
      // Always render the scene even during countdown
      if (!gameStateRef.current.isGameOver) {
        if (!countdownActiveRef.current) {
          // Only run game logic if countdown is not active
          // Spawn new bananas - with dynamic spawn rate
          const currentSpawnInterval = getSpawnInterval();
          if (time - lastSpawnTimeRef.current > currentSpawnInterval) {
            spawnBanana();
            lastSpawnTimeRef.current = time;
            
            // Debug info - log every 5 bananas spawned to avoid console flood
            if (gameStateRef.current.bananas.length % 5 === 0) {
              console.log(`Bananas in scene: ${gameStateRef.current.bananas.length}, Spawn interval: ${currentSpawnInterval}ms, Speed: ${gameStateRef.current.speed.toFixed(3)}`);
            }
          }
          
          // Animate monkey (subtle breathing/bouncing effect)
          if (gameStateRef.current.monkey) {
            // Use new emotion animation system instead of simple breathing
            animateMonkeyEmotion(gameStateRef.current.monkey, time);
            
            // Store current position for next frame
            gameStateRef.current.monkey.userData.lastX = gameStateRef.current.monkey.position.x;
          }
          
          // Update bananas
          gameStateRef.current.bananas.forEach((banana, index) => {
            banana.position.y -= gameStateRef.current.speed;

            // Check for banana collision with monkey
            if (gameStateRef.current.monkey && 
                Math.abs(banana.position.x - gameStateRef.current.monkey.position.x) < 0.5 &&
                Math.abs(banana.position.y - gameStateRef.current.monkey.position.y) < 0.5) {
              
              scene.remove(banana);
              gameStateRef.current.bananas.splice(index, 1);
              gameStateRef.current.score += 1;
              setDisplayScore(gameStateRef.current.score);
              
              // Increase speed gradually with score
              if (gameStateRef.current.score % 5 === 0) {
                gameStateRef.current.speed += 0.005;
                console.log(`Speed increased to: ${gameStateRef.current.speed.toFixed(3)}`);
              }
              
              // Add a bigger boost every 15 points
              if (gameStateRef.current.score % 15 === 0) {
                gameStateRef.current.speed += 0.01;
                console.log(`MAJOR speed boost! Speed now: ${gameStateRef.current.speed.toFixed(3)}`);
              }
              
              // Play collect sound
              playCollectSound();
              
              // Show happy emotion on collection
              if (gameStateRef.current.monkey) {
                setMonkeyEmotion(gameStateRef.current.monkey, "happy");
              }
            }

            // Check if banana hit ground
            if (banana.position.y < -3) {
              scene.remove(banana);
              gameStateRef.current.bananas.splice(index, 1);
              gameStateRef.current.lives -= 1;
              setDisplayLives(gameStateRef.current.lives);
              
              // Play lose life sound
              playLoseLifeSound();
              
              // Show sad emotion when losing a life
              if (gameStateRef.current.monkey) {
                setMonkeyEmotion(gameStateRef.current.monkey, "sad");
                
                // Reset to happy after 1.5 seconds if game not over
                setTimeout(() => {
                  if (gameStateRef.current.monkey && !gameStateRef.current.isGameOver) {
                    setMonkeyEmotion(gameStateRef.current.monkey, "happy");
                  }
                }, 1500);
              }

              if (gameStateRef.current.lives <= 0) {
                gameStateRef.current.isGameOver = true;
                setGameOver(true);
                
                // Force audio disabled state to stop background music
                setAudioEnabled(false);
                
                // Set crying emotion when game over
                if (gameStateRef.current.monkey) {
                  setMonkeyEmotion(gameStateRef.current.monkey, "crying");
                }
                
                // Play game over sound manually without audio enabled state
                setTimeout(() => {
                  try {
                    // Create a one-time game over sound
                    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.type = 'square';
                    oscillator.frequency.value = 200;
                    gainNode.gain.value = 0.3;
                    
                    oscillator.start();
                    setTimeout(() => {
                      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
                      setTimeout(() => oscillator.stop(), 100);
                    }, 500);
                  } catch (e) {
                    console.error("Error playing game over sound:", e);
                  }
                }, 100);
              }
            }
          });
        }
      }

      // Always render the scene, regardless of game state
      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Event listeners
    window.addEventListener('keydown', handleKeyDown);
    mountRef.current.addEventListener('touchstart', handleTouchStart);
    mountRef.current.addEventListener('touchmove', handleTouchMove);

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (mountRef.current) {
        mountRef.current.removeEventListener('touchstart', handleTouchStart);
        mountRef.current.removeEventListener('touchmove', handleTouchMove);
        mountRef.current.removeChild(renderer.domElement);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      scene.clear();
      renderer.dispose();
    };
  }, []);

  // Helper function to reset the scene
  const resetScene = () => {
    if (!sceneRef.current) return;
    
    // Save camera and essential objects
    const scene = sceneRef.current;
    const essentialObjects: THREE.Object3D[] = [];
    
    // Find and save essential objects like background, lights, etc.
    scene.traverse((object) => {
      if (object.type === 'AmbientLight' || object.type === 'DirectionalLight' || 
          object.name === 'background' || object.type === 'Camera') {
        essentialObjects.push(object);
      }
    });
    
    // Clear everything from the scene
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
    
    // Add back essential objects
    essentialObjects.forEach(obj => {
      scene.add(obj);
    });
    
    // Create a new monkey
    const monkey = createMonkey();
    monkey.position.y = -2.5;
    scene.add(monkey);
    
    return monkey;
  };

  const handleRestart = () => {
    console.log("handleRestart called");
    if (!sceneRef.current) {
      console.log("No scene ref, cannot restart");
      return;
    }
    
    // Prevent multiple restarts while countdown is active
    if (countdownActiveRef.current) {
      console.log("Restart blocked: countdown already active");
      return;
    }

    // Cancel any running animation frame to prevent overlap
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Check if we need a full scene reset
    let needsFullReset = false;
    if (!gameStateRef.current.monkey || !gameStateRef.current.monkey.visible) {
      needsFullReset = true;
    } else {
      // Check if monkey parts are missing
      let monkeyPartsCount = 0;
      gameStateRef.current.monkey.traverse((child) => {
        if (child.type === 'Mesh' || child.type === 'Group') {
          monkeyPartsCount++;
        }
      });
      // If we have less than 10 parts, the monkey is probably corrupted
      if (monkeyPartsCount < 10) {
        needsFullReset = true;
      }
    }

    // Perform full reset if needed
    if (needsFullReset) {
      console.log("Performing full scene reset");
      const newMonkey = resetScene();
      
      // Reset game state with new monkey
      gameStateRef.current = {
        ...INITIAL_STATE,
        monkey: newMonkey,
      };
    } else {
      // Reset game state with existing monkey
      gameStateRef.current = {
        ...INITIAL_STATE,
        monkey: gameStateRef.current.monkey,
      };
      
      // Reset existing monkey
      gameStateRef.current.monkey.position.x = 0;
      setMonkeyEmotion(gameStateRef.current.monkey, "happy");
      gameStateRef.current.monkey.scale.set(1, 1, 1);
      gameStateRef.current.monkey.rotation.set(0, 0, 0);
      gameStateRef.current.monkey.visible = true;
      
      // Remove all bananas from the scene
      if (sceneRef.current) {
        const bananasToRemove = [...gameStateRef.current.bananas];
        bananasToRemove.forEach(banana => {
          sceneRef.current?.remove(banana);
        });
      }
    }

    // Reset spawn interval and timing
    lastSpawnTimeRef.current = 0;
    spawnIntervalRef.current = 2000;
    
    // Reset UI state
    setDisplayScore(0);
    setDisplayLives(3);
    setGameOver(false);
    
    // Clear bananas array BEFORE removing objects to prevent any further processing
    gameStateRef.current.bananas = [];
    
    // Double-check and remove any remaining objects with the name "banana"
    if (sceneRef.current) {
      let bananasRemoved = 0;
      sceneRef.current.traverse((object) => {
        if (object.name === "banana" || (object.type === 'Group' && object.position.y < 3 && object.position.y > -3)) {
          sceneRef.current?.remove(object);
          bananasRemoved++;
        }
      });
      console.log(`Removed ${bananasRemoved} remaining bananas from scene`);
    }
    
    // Make sure audio is enabled and properly initialized
    if (!audioEnabled) {
      setAudioEnabled(true);
      // Create and resume AudioContext on restart
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const context = new AudioContextClass();
        
        // Resume context if needed
        if (context.state !== 'running') {
          context.resume().then(() => {
            console.log('AudioContext resumed successfully on restart');
          }).catch(error => {
            console.error('Failed to resume AudioContext on restart:', error);
          });
        }
      } catch (e) {
        console.error('Failed to initialize AudioContext on restart:', e);
      }
    }
    
    // Play background music after a short delay to ensure audio context is ready
    setTimeout(() => {
      if (audioRef.current?.backgroundMusic) {
        try {
          audioRef.current.backgroundMusic.play();
          console.log("Background music started");
        } catch (e) {
          console.error("Failed to play background music:", e);
        }
      }
    }, 500);
    
    // Start countdown as the final step - after everything else is prepared
    setCountdown(3);
    countdownActiveRef.current = true;
    console.log("Game restarted, countdown set to 3, countdownActive=true");
    
    // Restart animation frame if it was canceled
    if (!animationFrameRef.current) {
      console.log("Restarting animation frame");
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  };

  // Function to change monkey emotion
  const setMonkeyEmotion = (monkey: THREE.Object3D, emotion: string) => {
    monkey.userData.emotionState = emotion;
    
    // Find mouth and tear parts by traversing all children
    let happyMouth, sadMouth, leftTear, rightTear;
    
    monkey.traverse((child) => {
      if (child.name === "happyMouth") happyMouth = child;
      if (child.name === "sadMouth") sadMouth = child;
      if (child.name === "leftTear") leftTear = child;
      if (child.name === "rightTear") rightTear = child;
    });
    
    if (!happyMouth || !sadMouth || !leftTear || !rightTear) {
      console.error("Could not find all emotional parts of monkey");
      return;
    }
    
    // Set appropriate visibility based on emotion
    if (emotion === "happy") {
      happyMouth.visible = true;
      sadMouth.visible = false;
      leftTear.visible = false;
      rightTear.visible = false;
      console.log("Set happy emotion - happy mouth should be visible");
    } else if (emotion === "sad") {
      happyMouth.visible = false;
      sadMouth.visible = true;
      leftTear.visible = false;
      rightTear.visible = false;
    } else if (emotion === "crying") {
      happyMouth.visible = false;
      sadMouth.visible = true;
      leftTear.visible = true;
      rightTear.visible = true;
    }
  };
  
  // Animate monkey based on emotion
  const animateMonkeyEmotion = (monkey: THREE.Object3D, time: number) => {
    const emotion = monkey.userData.emotionState;
    
    // Find limbs for animation
    const leftArm = monkey.children.find(child => child.name === "leftArm");
    const rightArm = monkey.children.find(child => child.name === "rightArm");
    const leftLeg = monkey.children.find(child => child.name === "leftLeg");
    const rightLeg = monkey.children.find(child => child.name === "rightLeg");
    const tail = monkey.children.find(child => child.name === "tail");
    const leftTear = monkey.children.find(child => child.name === "leftTear");
    const rightTear = monkey.children.find(child => child.name === "rightTear");
    
    if (!leftArm || !rightArm || !leftLeg || !rightLeg || !tail) return;
    
    // Base animation for all emotions - breathing
    monkey.userData.breathOffset = Math.sin(time * 0.05) * 0.02;
    const breathScale = 1 + monkey.userData.breathOffset;
    monkey.scale.set(breathScale, breathScale, 1);
    
    // Animate based on emotion
    if (emotion === "happy") {
      // Happy animations - wiggle arms and tail with reduced amplitude
      monkey.userData.armOffset = Math.sin(time * 0.1) * 0.08;
      leftArm.rotation.z = -0.3 + monkey.userData.armOffset;
      rightArm.rotation.z = 0.3 - monkey.userData.armOffset;
      
      // Wag tail (slightly reduced)
      monkey.userData.tailRotation = Math.sin(time * 0.15) * 0.15;
      tail.rotation.z = monkey.userData.tailRotation;
      
    } else if (emotion === "sad") {
      // Sad animations - drooping arms and tail
      leftArm.rotation.z = -0.6;
      rightArm.rotation.z = 0.6;
      tail.rotation.z = -0.3;
      
    } else if (emotion === "crying") {
      // Crying animations - shake slightly and animate tears
      const shakeAmount = Math.sin(time * 0.2) * 0.01;
      monkey.position.x += shakeAmount;
      
      // Animate tears falling
      if (leftTear && rightTear) {
        monkey.userData.tearOffset += 0.01;
        if (monkey.userData.tearOffset > 0.4) {
          monkey.userData.tearOffset = 0;
        }
        
        leftTear.position.y = 0.0 - monkey.userData.tearOffset;
        rightTear.position.y = 0.0 - monkey.userData.tearOffset;
        
        // Make tears disappear at bottom and reappear at top
        leftTear.visible = (monkey.userData.tearOffset < 0.35);
        rightTear.visible = (monkey.userData.tearOffset < 0.35);
      }
      
      // Drooping arms and tail (same as sad)
      leftArm.rotation.z = -0.6;
      rightArm.rotation.z = 0.6;
      tail.rotation.z = -0.3;
    }
    
    // Animation for leg movement when moving horizontally
    if (monkey.userData.lastX !== undefined) {
      const movement = monkey.position.x - monkey.userData.lastX;
      if (Math.abs(movement) > 0.01) {
        monkey.userData.legOffset = (monkey.userData.legOffset || 0) + 0.2;
        const legAngle = Math.sin(monkey.userData.legOffset) * 0.2;
        leftLeg.rotation.z = legAngle;
        rightLeg.rotation.z = -legAngle;
      } else {
        // Reset legs when not moving
        leftLeg.rotation.z = 0;
        rightLeg.rotation.z = 0;
      }
    }
  };

  const getSpawnInterval = () => {
    // Use a more reliable method with fixed intervals that don't cause issues
    // Start at 2000ms (2 seconds) and decrease based on score
    // Minimum interval of 750ms (increased from 500ms for less intensity)
    const score = gameStateRef.current.score;
    // Decrease by 100ms (instead of 200ms) for every 10 points
    const newInterval = Math.max(750, 2000 - Math.floor(score / 10) * 100);
    // Store the current value for debugging
    spawnIntervalRef.current = newInterval;
    return newInterval;
  };

  return (
    <div className="relative flex">
      {/* Game Area */}
    <div className="relative">
      <div className="absolute top-4 left-4 text-white text-2xl font-bold z-10">
        Score: {displayScore}
      </div>
      <div className="absolute top-4 right-4 text-white text-2xl font-bold z-10">
        Lives: {displayLives}
      </div>
        
      <div ref={mountRef} className="w-[800px] h-[600px] rounded-lg overflow-hidden shadow-2xl" />
        
        {/* Audio controls */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-10">
          <div className={`bg-black bg-opacity-70 text-white px-3 py-1 rounded-lg transition-opacity duration-300 ${audioMessage ? 'opacity-100' : 'opacity-0'}`}>
            {audioMessage}
          </div>
          <button 
            onClick={toggleAudio}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition-colors flex items-center"
            title="Click to enable/disable game sounds"
          >
            {audioEnabled ? "🔊 Sound On" : "🔇 Enable Sound"}
          </button>
        </div>

      {/* Countdown overlay */}
      {countdownActiveRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 z-30">
          <div className="text-white text-8xl font-bold animate-pulse">
            {countdown > 0 ? countdown : "GO!"}
          </div>
        </div>
      )}
        
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20">
          <div className="bg-white p-8 rounded-lg text-center">
            <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
            <p className="text-xl mb-4">Final Score: {displayScore}</p>
            <button
              onClick={handleRestart}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-lg z-10">
        Use ← → arrow keys or touch to move
        </div>
      </div>
      
      {/* Side Panel */}
      <div className="w-64 p-6 bg-gray-800 h-[600px] rounded-r-lg text-white flex flex-col">
        <h2 className="text-2xl font-bold mb-4 text-yellow-400">Banana Rush</h2>
        <h3 className="text-xl font-semibold mb-6 text-blue-400">Free Style Vibe Coding Gaming Hackathon</h3>
        
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-bold text-green-400 mb-1">Game Objective</p>
            <p>Help the monkey catch falling bananas while avoiding misses!</p>
          </div>
          
          <div>
            <p className="font-bold text-green-400 mb-1">Controls</p>
            <p>Use arrow keys (←→) or touch controls to move the monkey.</p>
          </div>
          
          <div>
            <p className="font-bold text-green-400 mb-1">Scoring</p>
            <p>Each banana caught = 1 point</p>
            <p>Miss 3 bananas = Game Over</p>
          </div>
          
          <div>
            <p className="font-bold text-green-400 mb-1">Difficulty</p>
            <p>Speed increases with each banana</p>
            <p>Major speed boost every 15 points</p>
          </div>
          
          <div className="mt-auto pt-4">
            <p className="italic text-xs text-gray-400">Created during the Free Style Vibe Coding Gaming Hackathon</p>
            <p className="italic text-xs text-gray-400">Featuring ReactJS, Three.js, and TailwindCSS</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;