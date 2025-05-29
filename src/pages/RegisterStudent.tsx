import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, User, ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import * as faceapi from 'face-api.js';

const RegisterStudent = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [studentData, setStudentData] = useState({
    name: '',
    rollNo: '',
    email: ''
  });
  
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [faceDescriptors, setFaceDescriptors] = useState<number[][]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isComponentMounted, setIsComponentMounted] = useState(true);
  const [faceBox, setFaceBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
      } else {
        setUserId(session.user.id);
      }
    };
    checkSession();
  }, [navigate]);

  useEffect(() => {
    setIsComponentMounted(true);
    return () => {
      setIsComponentMounted(false);
      cleanupCamera();
    };
  }, []);

  // Download face-api.js models
  const downloadModels = async () => {
    try {
      setIsLoadingModels(true);
      console.log('Starting to download face-api.js models...');

      // First check if models exist
      const modelPath = '/models';  // This will look in the public/models directory
      console.log('Loading models from:', modelPath);

      // Load models one by one to better identify any issues
      try {
        console.log('Loading tiny face detector model...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        console.log('Tiny face detector model loaded successfully');
      } catch (error) {
        console.error('Error loading tiny face detector:', error);
        throw new Error('Failed to load tiny face detector model');
      }

      try {
        console.log('Loading face landmark model...');
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
        console.log('Face landmark model loaded successfully');
      } catch (error) {
        console.error('Error loading face landmark model:', error);
        throw new Error('Failed to load face landmark model');
      }

      try {
        console.log('Loading face recognition model...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
        console.log('Face recognition model loaded successfully');
      } catch (error) {
        console.error('Error loading face recognition model:', error);
        throw new Error('Failed to load face recognition model. Please ensure the model files are downloaded correctly.');
      }

      console.log('All face-api.js models downloaded successfully!');
      setIsLoadingModels(false);
      return true;
    } catch (error) {
      console.error('Error downloading models:', error);
      toast.error('Failed to download face recognition models. Please check if model files are complete.');
      setIsLoadingModels(false);
      return false;
    }
  };

  const startCamera = async () => {
    try {
      // First ensure models are loaded
      if (!isLoadingModels) {
        const modelsLoaded = await downloadModels();
        if (!modelsLoaded) {
          toast.error("Failed to load face recognition models");
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 1280,
          height: 720,
          facingMode: "user"
        } 
      });
      
      if (videoRef.current && isComponentMounted) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      } else {
        // If component is unmounted or ref is not available, stop the stream
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      toast.error('Failed to start camera. Please check camera permissions.');
    }
  };

  const cleanupCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.label);
      });
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const stopCamera = () => {
    cleanupCamera();
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      // Detect faces and extract features
      const detections = await faceapi.detectAllFaces(
        canvas, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptors();

      if (detections.length === 0) {
        toast.error("No face detected. Please try again.");
        return;
      }

      if (detections.length > 1) {
        toast.error("Multiple faces detected. Please ensure only one face is visible.");
        return;
      }

      const detection = detections[0];
      const descriptor = detection.descriptor;
      const descriptorArray = Array.from(descriptor);
      
      // Log face features to console with capture number
      const captureNumber = capturedImages.length + 1;
      console.log(`Face Detection Results - Capture #${captureNumber}:`, {
        captureNumber,
        timestamp: new Date().toISOString(),
        faceBox: detection.detection.box,
        landmarks: detection.landmarks.positions,
        descriptor: descriptorArray,
        confidence: detection.detection.score
      });

      // Compare with previous capture if exists
      if (capturedImages.length > 0) {
        const previousDescriptor = faceDescriptors[0];
        const distance = faceapi.euclideanDistance(descriptorArray, previousDescriptor);
        console.log(`Face Comparison - Distance between captures: ${distance}`);
        
        // If faces are too different, warn the user
        if (distance > 0.6) {
          toast.warning("Warning: The two face captures seem quite different. Please ensure it's the same person.");
        }
      }

      const imageData = canvas.toDataURL('image/jpeg');
      
      setCapturedImages(prev => [...prev, imageData]);
      setFaceDescriptors(prev => [...prev, descriptorArray]);
      
      toast.success(`Image ${captureNumber} captured successfully!`);
      
      if (captureNumber >= 2) {
        console.log('Both captures completed. Face descriptors:', faceDescriptors);
        cleanupCamera();
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      toast.error('Failed to capture image');
    }
  };

  const handleRegister = async () => {
    if (!studentData.name || !studentData.rollNo || !studentData.email) {
      toast.error("Please fill in all student details");
      return;
    }
    
    if (capturedImages.length < 2) {
      toast.error("Please capture 2 images for face recognition");
      return;
    }

    try {
      setIsRegistering(true);
      cleanupCamera();

      const { error } = await supabase
        .from('students')
        .insert([
          {
            name: studentData.name,
            roll_no: studentData.rollNo,
            email: studentData.email,
            face_descriptors: faceDescriptors,
            user_id: userId
          }
        ]);

      if (error) throw error;
      
      toast.success("Student registered successfully!");
      setStudentData({ name: '', rollNo: '', email: '' });
      setCapturedImages([]);
      setFaceDescriptors([]);
      navigate('/');
    } catch (error) {
      console.error('Error registering student:', error);
      toast.error('Failed to register student');
    } finally {
      setIsRegistering(false);
    }
  };

  // Add this useEffect to load models when component mounts
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoadingModels(true);
        const modelsLoaded = await downloadModels();
        if (!modelsLoaded) {
          toast.error("Failed to load face recognition models");
        }
      } catch (error) {
        console.error('Error loading models:', error);
        toast.error('Failed to load face recognition models');
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const detectFace = async () => {
      if (cameraActive && videoRef.current && faceapi.nets.tinyFaceDetector.params) {
        const result = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        );
        if (result) {
          const { x, y, width, height } = result.box;
          setFaceBox({ x, y, width, height });
        } else {
          setFaceBox(null);
        }
      }
      animationFrameId = requestAnimationFrame(detectFace);
    };

    if (cameraActive) {
      detectFace();
    } else {
      setFaceBox(null);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [cameraActive]);

  function getRelativeBox(box, video) {
    const scaleX = video.offsetWidth / video.videoWidth;
    const scaleY = video.offsetHeight / video.videoHeight;
    return {
      left: box.x * scaleX,
      top: box.y * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY,
    };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Register New Student
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Student Details Form */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5 text-blue-600" />
                <span>Student Information</span>
              </CardTitle>
              <CardDescription>
                Enter the student's basic details for registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter student's full name"
                  value={studentData.name}
                  onChange={(e) => setStudentData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rollNo">Roll Number / Student ID</Label>
                <Input
                  id="rollNo"
                  placeholder="Enter roll number or student ID"
                  value={studentData.rollNo}
                  onChange={(e) => setStudentData(prev => ({ ...prev, rollNo: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter student's email"
                  value={studentData.email}
                  onChange={(e) => setStudentData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Camera Section */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Camera className="w-5 h-5 text-green-600" />
                <span>Face Capture</span>
              </CardTitle>
              <CardDescription>
                Capture 2 clear images of the student's face for recognition
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-64 bg-gray-100 rounded-lg object-cover transition-opacity duration-300 ${
                    !cameraActive ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <canvas 
                  ref={canvasRef} 
                  className="hidden"
                  width={640}
                  height={480}
                />
                
                {!cameraActive && (
                  <div className="absolute inset-0 w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">Camera not active</p>
                    </div>
                  </div>
                )}

                {cameraActive && faceBox && videoRef.current && (
                  (() => {
                    const rel = getRelativeBox(faceBox, videoRef.current);
                    return (
                      <div
                        className="absolute border-4 border-green-500 rounded-lg pointer-events-none"
                        style={{
                          left: `${rel.left}px`,
                          top: `${rel.top}px`,
                          width: `${rel.width}px`,
                          height: `${rel.height}px`,
                          boxSizing: 'border-box',
                          transition: 'all 0.1s linear',
                          zIndex: 10,
                        }}
                      />
                    );
                  })()
                )}
              </div>

              <div className="flex space-x-2">
                {!cameraActive ? (
                  <Button 
                    onClick={startCamera} 
                    className="flex-1 bg-green-500 hover:bg-green-600"
                    disabled={isLoadingModels}
                  >
                    <div className="flex items-center space-x-2">
                      <Camera className="w-4 h-4" />
                      <span>{isLoadingModels ? 'Downloading Models...' : 'Start Camera'}</span>
                    </div>
                  </Button>
                ) : (
                  <Button 
                    onClick={captureImage} 
                    className="flex-1 bg-blue-500 hover:bg-blue-600"
                    disabled={capturedImages.length >= 2}
                  >
                    <div className="flex items-center space-x-2">
                      <Camera className="w-4 h-4" />
                      <span>Capture Image ({capturedImages.length}/2)</span>
                    </div>
                  </Button>
                )}
              </div>

              {/* Show loading state */}
              {isLoadingModels && (
                <div className="text-center text-sm text-gray-600 mt-2">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading face recognition models...</span>
                  </div>
                  <p className="mt-1">This may take a few moments</p>
                </div>
              )}

              {/* Captured Images Preview */}
              {capturedImages.length > 0 && (
                <div className="space-y-2">
                  <Label>Captured Images:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {capturedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={image} 
                          alt={`Captured ${index + 1}`}
                          className="w-full h-20 object-cover rounded border"
                        />
                        <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Register Button */}
        <div className="mt-8 text-center">
          <Button
            onClick={handleRegister}
            disabled={isRegistering || capturedImages.length < 2 || !studentData.name}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-medium"
          >
            {isRegistering ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Register Student</span>
              </div>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default RegisterStudent;
