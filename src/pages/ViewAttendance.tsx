import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Mail, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const ViewAttendance = () => {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryStats, setSummaryStats] = useState({
    totalStudents: 0,
    activeSubjects: 0
  });

  // Fetch subjects from Supabase on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('Error getting user:', userError);
          return;
        }
        if (!user) return;
        const { data, error } = await supabase
          .from('subjects')
          .select('name')
          .eq('teacher_id', user.id)
          .not('name', 'is', null)
          .order('name');
        if (error) {
          console.error('Error fetching subjects:', error);
          return;
        }
        if (data) {
          const filtered = data.map(s => s.name).filter(name => name && name.trim() !== '');
          setSubjects(filtered);
        }
      } catch (error) {
        console.error('Error in fetchSubjects:', error);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject === 'all' || !selectedSubject) {
      setAttendanceData([]);
      return;
    }
    const fetchAttendanceData = async () => {
      setLoading(true);
      try {
        // 1. Get subject id
        const { data: subjectData, error: subjectError } = await supabase
          .from('subjects')
          .select('id')
          .eq('name', selectedSubject)
          .single();
        if (subjectError || !subjectData) {
          toast.error('Error fetching subject');
          setLoading(false);
          return;
        }
        const subjectId = subjectData.id;

        // 2. Get all students
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, roll_no, name, email');
        if (studentsError) {
          toast.error('Error fetching students');
          setLoading(false);
          return;
        }

        // 3. Get all attendance records for this subject
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance')
          .select('student_id, date')
          .eq('subject_id', subjectId);
        if (attendanceError) {
          toast.error('Error fetching attendance');
          setLoading(false);
          return;
        }

        // 4. Calculate stats for each student
        const studentAttendance = students.map(student => {
          const records = attendance.filter(a => a.student_id === student.id);
          const total = records.length;
          const present = records.length; // Since each record represents a present attendance
          const percentage = total > 0 ? (present / total) * 100 : 0;
          return {
            ...student,
            present,
            total,
            percentage,
          };
        });

        setAttendanceData(studentAttendance);
      } catch (err) {
        toast.error('Error loading attendance');
      }
      setLoading(false);
    };

    fetchAttendanceData();
  }, [selectedSubject]);

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

  const getSubjectKey = (subject: string) => {
    return subject.toLowerCase().replace(/\s+/g, '');
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 75) return 'bg-green-100 text-green-800';
    if (percentage >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const sendWarningEmail = (student: any, subject: string) => {
    const subjectKey = getSubjectKey(subject);
    const attendance = student[subjectKey];
    
    if (!attendance) {
      toast.error(`No attendance data found for ${student.name} in ${subject}`);
      return;
    }
    
    // In real app, this would trigger a Supabase Edge Function
    toast.success(`Warning email sent to ${student.name} for ${subject} (${attendance.percentage.toFixed(1)}% attendance)`);
  };

  const filteredData = selectedSubject === 'all' ? attendanceData : attendanceData;

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
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Attendance Reports
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle>Filter Options</CardTitle>
            <CardDescription>Select a subject to view detailed attendance statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex-1 max-w-xs">
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(subject => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subject-wise Tables */}
        {(selectedSubject === 'all' ? subjects : [selectedSubject]).map(subject => (
          <Card key={subject} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{subject}</span>
                <Badge variant="outline" className="bg-blue-50">
                  {attendanceData.length} Students
                </Badge>
              </CardTitle>
              <CardDescription>
                Attendance statistics and email notifications for students below 60%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Present Days</TableHead>
                    <TableHead>Total Classes</TableHead>
                    <TableHead>Attendance %</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map(student => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.roll_no}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell className="text-sm text-gray-600">{student.email}</TableCell>
                      <TableCell>{student.present}</TableCell>
                      <TableCell>{student.total}</TableCell>
                      <TableCell>
                        <Badge className={getAttendanceColor(student.percentage)}>
                          {student.percentage.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.percentage < 75 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendWarningEmail(student, selectedSubject)}
                            className="flex items-center space-x-1 text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Mail className="w-3 h-3" />
                            <AlertTriangle className="w-3 h-3" />
                            <span className="text-xs">Send Warning</span>
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                            Good Standing
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

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

export default ViewAttendance;
