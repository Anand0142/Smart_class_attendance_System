import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, ArrowLeft, Users, Clock, Calendar, CheckCircle, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import * as faceapi from 'face-api.js';

const FACE_MATCH_THRESHOLD = 0.5;

const extractFeaturesWithPython = async (imageBlob: Blob) => {
  const formData = new FormData();
  formData.append('image1', imageBlob);
  formData.append('image2', imageBlob);

  const response = await fetch('http://localhost:5000/extract-features', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.image1_features.face_encoding;
};

function euclideanDistance(a: number[], b: number[]) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

const fadeOutAnimation = `
  @keyframes fadeOut {
    from { opacity: 0.7; }
    to { opacity: 0; }
  }
`;

function getRelativeBox(box: { x: number, y: number, width: number, height: number }, video: HTMLVideoElement) {
  const videoRect = video.getBoundingClientRect();
  const scaleX = video.offsetWidth / video.videoWidth;
  const scaleY = video.offsetHeight / video.videoHeight;
  return {
    left: box.x * scaleX,
    top: box.y * scaleY,
    width: box.width * scaleX,
    height: box.height * scaleY,
  };
}

const TakeAttendance = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [selectedSubject, setSelectedSubject] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [recognizedStudents, setRecognizedStudents] = useState<{id: string, name: string}[]>([]);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date().toLocaleDateString());
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [studentFaceFeatures, setStudentFaceFeatures] = useState<{id: string, name: string, face_descriptor: number[]}[]>([]);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [faceBox, setFaceBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      if (modelsLoaded) return;
      
      try {
        setIsModelLoading(true);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
        setIsModelLoading(false);
        console.log("Face recognition models loaded successfully!");
      } catch (error) {
        console.error('Error loading face-api models:', error);
        toast.error("Failed to load face recognition models");
      }
    };
    loadModels();
  }, [modelsLoaded]);

  // Cleanup models on component unmount
  useEffect(() => {
    return () => {
      if (modelsLoaded) {
        faceapi.env.monkeyPatch({
          Canvas: HTMLCanvasElement,
          Image: HTMLImageElement,
          ImageData: ImageData,
          Video: HTMLVideoElement,
          createCanvasElement: () => document.createElement('canvas'),
          createImageElement: () => document.createElement('img')
        });
      }
      cleanupCamera();
    };
  }, [modelsLoaded]);

  // Fetch students' face features when subject is selected
  useEffect(() => {
    const fetchStudentFeatures = async () => {
      if (!selectedSubject) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('students')
          .select('id, name, face_descriptors, roll_no, email')
          .eq('user_id', user.id);

        if (error) throw error;
        
        if (data) {
          setStudentFaceFeatures(data.map(student => ({
            ...student,
            face_descriptor: student.face_descriptors
          })));
        }
      } catch (error) {
        console.error('Error fetching student features:', error);
        toast.error('Failed to load student data');
      }
    };

    fetchStudentFeatures();
  }, [selectedSubject]);

  const fetchSubjects = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user:', userError);
        throw new Error('Authentication error');
      }
      if (!user) {
        console.log('No user found, skipping subject fetch');
        return;
      }
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('teacher_id', user.id)
        .not('name', 'is', null)
        .order('name');
      if (error) {
        console.error('Error fetching subjects:', error);
        throw new Error(error.message);
      }
      if (data) {
        const filtered = data.filter(subject => subject.name && subject.name.trim() !== '');
        setSubjects(filtered);
      } else {
        setSubjects([]);
      }
    } catch (error) {
      console.error('Error in fetchSubjects:', error);
      console.log('Failed to load subjects:', error);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Live date/time update
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentDate(now.toLocaleDateString());
      setCurrentTime(now.toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const captureNow = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Draw current frame to canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Save captured image for UI feedback
      const imageData = canvas.toDataURL('image/jpeg');
      setCapturedImages(prev => [...prev, imageData]);
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg');
      });

      // Extract features and process recognition
      const extractedFeatures = await extractFeaturesWithPython(blob);
      
      // Fetch all students' face_descriptors from Supabase
      const { data: students, error } = await supabase
        .from('students')
        .select('id, name, face_descriptors');
        
      if (error) throw error;
      
      // Compare with each student's descriptors
      const alreadyRecognized = new Set(recognizedStudents.map(s => s.id));
      let studentRecognized = false;

      for (const student of students) {
        if (alreadyRecognized.has(student.id)) continue;

        for (const storedDescriptor of student.face_descriptors) {
          const distance = euclideanDistance(extractedFeatures, storedDescriptor);
          if (distance < FACE_MATCH_THRESHOLD) {
            toast.success(`${student.name} recognized! (distance: ${distance.toFixed(3)})`);
            alreadyRecognized.add(student.id);
            setRecognizedStudents(prev => {
              if (!prev.find(s => s.id === student.id)) {
                return [...prev, { id: student.id, name: student.name }];
              }
              return prev;
            });
            studentRecognized = true;
            break;
          }
        }
        if (studentRecognized) break;
      }

      if (!studentRecognized) {
        toast.warning("No matching student found in this capture");
      }

    } catch (error) {
      console.error('Recognition error:', error);
      toast.error('Failed to process image');
    } finally {
      setIsProcessing(false);
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
    setCapturedImages([]);
  };

  const stopCamera = () => {
    cleanupCamera();
  };

  const saveAttendance = async () => {
    if (recognizedStudents.length === 0) {
      toast.error("No students recognized yet");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to save attendance");
        return;
      }
      const subjectId = selectedSubject;
      const date = new Date().toISOString();
      const presentStudentIds = recognizedStudents.map(student => student.id);

      const { data: allStudents, error: studentsError } = await supabase
        .from('students')
        .select('id');

      if (studentsError) {
        toast.error('Failed to fetch students');
        return;
      }

      const attendanceRows = allStudents.map(student => ({
        student_id: student.id,
        subject_id: subjectId,
        teacher_id: user.id,
        date: date,
        status: presentStudentIds.includes(student.id) ? 'present' : 'absent',
      }));

      const { error } = await supabase
        .from('attendance')
        .insert(attendanceRows);

      if (error) {
        toast.error('Failed to save attendance');
      } else {
        toast.success('Attendance saved successfully!');
        setRecognizedStudents([]);
        cleanupCamera();
        navigate('/');
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
    }
  };

  const startCamera = async () => {
    if (!selectedSubject) {
      toast.error("Please select a subject first");
      return;
    }
    if (isModelLoading) {
      toast.error("Face recognition models are still loading");
      return;
    }
    try {
      cleanupCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setRecognizedStudents([]);
        toast.success("Camera started! Face recognition is active.");
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error("Failed to access camera. Please check permissions.");
    }
  };

  const handleAddSubject = async () => {
    if (!newSubject.trim()) {
      toast.error("Subject name cannot be empty");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user:', userError);
        throw new Error('Authentication error');
      }

      if (!user) {
        toast.error("Please login to add subjects");
        return;
      }

      const { data: existingSubject, error: checkError } = await supabase
        .from('subjects')
        .select('id')
        .eq('name', newSubject.trim())
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing subject:', checkError);
        throw new Error('Failed to check existing subject');
      }

      if (existingSubject) {
        toast.error("Subject already exists");
        return;
      }

      const { data: newSubjectData, error: insertError } = await supabase
        .from('subjects')
        .insert([
          { 
            name: newSubject.trim(),
            teacher_id: user.id 
          }
        ])
        .select('id, name')
        .single();

      if (insertError) {
        console.error('Error inserting subject:', insertError);
        throw new Error(insertError.message);
      }

      if (!newSubjectData) {
        throw new Error('No data returned after insert');
      }

      setSubjects(prev => [...prev, newSubjectData]);
      setNewSubject("");
      setShowAddSubject(false);
      toast.success(`Subject '${newSubject.trim()}' added!`);
      
    } catch (error) {
      console.error('Error adding subject:', error);
      if (error instanceof Error && error.message.includes('duplicate key')) {
        toast.error("This subject already exists");
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to add subject');
      }
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <style>{fadeOutAnimation}</style>
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
            <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Take Attendance
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span>Session Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center justify-between">
                    <span>Subject</span>
                    <button
                      type="button"
                      className="ml-2 p-1 rounded hover:bg-blue-100 text-blue-600"
                      onClick={() => setShowAddSubject(true)}
                      title="Add Subject"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
                    <div className="p-2 bg-gray-50 rounded border text-sm">
                      {currentDate}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Time</label>
                    <div className="p-2 bg-gray-50 rounded border text-sm">
                      {currentTime}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <span>Recognized Students</span>
                </CardTitle>
                <CardDescription>
                  {recognizedStudents.length} students marked present
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recognizedStudents.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No students recognized yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recognizedStudents.map((student, index) => (
                      <div key={student.id} className="flex items-center space-x-2 p-2 bg-green-50 rounded border">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <div className="flex-1">
                          <div className="font-medium text-sm">{student.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Camera className="w-5 h-5 text-blue-600" />
                  <span>Live Camera Feed</span>
                </CardTitle>
                <CardDescription>
                  Face recognition will automatically detect and mark students present
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-96 bg-gray-100 rounded-lg object-cover ${!cameraActive ? 'hidden' : ''}`}
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                  {cameraActive && (
                    <div className="absolute top-0 left-0 w-full h-96 flex items-center justify-center pointer-events-none">
                      <div className="w-64 h-64 border-4 border-green-500 rounded-lg animate-pulse relative">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
                      </div>
                    </div>
                  )}
                  
                  {!cameraActive && (
                    <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">Camera not active</p>
                        <p className="text-sm text-gray-500">Start camera to begin face recognition</p>
                      </div>
                    </div>
                  )}

                  {cameraActive && (
                    <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span>LIVE</span>
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
                          }}
                        />
                      );
                    })()
                  )}
                </div>

                <div className="flex space-x-4 mt-6">
                  {!cameraActive ? (
                    <Button 
                      onClick={startCamera} 
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      disabled={isModelLoading}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {isModelLoading ? 'Loading Models...' : 'Start Camera & Recognition'}
                    </Button>
                  ) : (
                    <>
                      <Button 
                        onClick={stopCamera} 
                        variant="outline" 
                        className="flex-1"
                      >
                        Stop Camera
                      </Button>
                      <Button 
                        onClick={captureNow}
                        className="flex-1 bg-blue-500 hover:bg-blue-600"
                        disabled={isProcessing}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {isProcessing ? 'Processing...' : 'Capture Now'}
                      </Button>
                      <Button 
                        onClick={saveAttendance}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        disabled={recognizedStudents.length === 0 || isProcessing}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Save Attendance ({recognizedStudents.length})
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Add Subject Modal */}
      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Subject</DialogTitle>
            <DialogDescription>
              Enter the name of the new subject you want to add.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Enter subject name"
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddSubject(); }}
            autoFocus
            disabled={isLoading}
          />
          <DialogFooter>
            <Button 
              onClick={handleAddSubject} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? 'Adding...' : 'Add'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowAddSubject(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TakeAttendance;