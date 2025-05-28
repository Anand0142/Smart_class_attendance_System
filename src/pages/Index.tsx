import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Camera, FileText, GraduationCap, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState({
    totalStudents: 0,
    activeSubjects: 0
  });

  useEffect(() => {
    const getUserData = async () => {
      try {
        setIsLoading(true);
        
        // Wait for session to be available
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          toast.error("Error checking session");
          navigate('/auth', { replace: true });
          return;
        }
        
        if (!session?.user?.email) {
          console.log("No session found or no email in session");
          navigate('/auth', { replace: true });
          return;
        }

        // Fetch user data from users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("name")
          .eq("email", session.user.email)
          .single();

        if (userError) {
          console.error("Error fetching user data:", userError);
          toast.error("Error fetching user data");
          navigate('/auth', { replace: true });
          return;
        }

        if (userData?.name) {
          setUserName(userData.name);
        } else {
          console.log("No name found in userData:", userData);
          toast.error("User data not found");
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        console.error("Error in getUserData:", error);
        toast.error("Error fetching user data");
        navigate('/auth', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    getUserData();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/auth', { replace: true });
      } else if (session?.user?.email) {
        const { data: userData } = await supabase
          .from("users")
          .select("name")
          .eq("email", session.user.email)
          .single();
        
        if (userData?.name) {
          setUserName(userData.name);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchSummaryStats = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return;

        // 1. Get total students count
        const { count: studentCount, error: studentError } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });
        
        if (studentError) throw studentError;

        // 2. Get active subjects count
        const { count: subjectCount, error: subjectError } = await supabase
          .from('subjects')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id);
        
        if (subjectError) throw subjectError;

        setSummaryStats({
          totalStudents: studentCount || 0,
          activeSubjects: subjectCount || 0
        });

      } catch (error) {
        console.error('Error fetching summary statistics:', error);
        toast.error('Failed to load summary statistics');
      }
    };

    fetchSummaryStats();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Error signing out");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
            </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  Smart Attendance System
                </h1>
                <p className="text-sm text-gray-600">Teacher Dashboard</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="border-gray-300 hover:bg-gray-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome {userName ? (
              <span className="ml-2 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent font-extrabold underline underline-offset-4">
                {userName}
              </span>
            ) : null}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Manage your class attendance with advanced face recognition technology. 
            Register students, take attendance, and monitor participation effortlessly.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card 
            className="group cursor-pointer hover:shadow-xl hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm"
            onClick={() => navigate('/register-student')}
          >
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl text-gray-900">
                Register Student
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-gray-600 mb-4">
                Add new students to the system using face recognition technology. 
                Capture student photos and store their face vectors securely.
              </CardDescription>
              <div className="flex justify-center">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white px-6">
                  Start Registration
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="group cursor-pointer hover:shadow-xl hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm"
            onClick={() => navigate('/take-attendance')}
          >
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl text-gray-900">
                Take Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-gray-600 mb-4">
                Start a new attendance session. The system will automatically 
                recognize students and mark their attendance.
              </CardDescription>
              <div className="flex justify-center">
                <Button className="bg-green-500 hover:bg-green-600 text-white px-6">
                  Start Session
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="group cursor-pointer hover:shadow-xl hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm"
            onClick={() => navigate('/view-attendance')}
          >
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl text-gray-900">
                View Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-gray-600 mb-4">
                Access detailed attendance reports and analytics. 
                Monitor student participation and generate insights.
              </CardDescription>
              <div className="flex justify-center">
                <Button className="bg-purple-500 hover:bg-purple-600 text-white px-6">
                  View Reports
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Update Summary Statistics section */}
        <div className="mt-16 flex justify-center">
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 text-center border border-gray-100">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {summaryStats.totalStudents}
              </div>
            <div className="text-sm text-gray-600">Registered Students</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 text-center border border-gray-100">
              <div className="text-2xl font-bold text-green-600 mb-2">
                {summaryStats.activeSubjects}
              </div>
            <div className="text-sm text-gray-600">Active Subjects</div>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;