import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, GraduationCap, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (mode === "signin") {
        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
          toast.error(error.message);
          setError(error.message);
          return;
        }

        const { data: userData } = await supabase
          .from("users")
          .select("name")
          .eq("email", email)
          .single();

        if (userData?.name) {
          toast.success(`Welcome back, ${userData.name}!`);
          navigate('/', { replace: true });
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } }
        });

        if (error) {
          toast.error(error.message);
          setError(error.message);
          return;
        }

        await supabase.from("users").insert([{ name, email }]);
        toast.success("Successfully signed up! Please verify your email before signing in.");
        setMode("signin");
        setEmail("");
        setPassword("");
        setName("");
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
      setError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-green-600 rounded-full flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Smart Attendance
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Face Recognition Based Attendance System
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative flex mb-4 rounded-lg overflow-hidden bg-blue-100">
            <div
              className={`absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg shadow-md transition-transform duration-300 ${
                mode === "signup" ? "translate-x-full" : ""
              }`}
            />
            <button
              className={`flex-1 py-2 font-semibold z-10 flex items-center justify-center gap-2 ${
                mode === "signin" ? "text-white" : "text-blue-600"
              }`}
              onClick={() => setMode("signin")}
            >
              <LogIn className="w-5 h-5" />
              Sign In
            </button>
            <button
              className={`flex-1 py-2 font-semibold z-10 flex items-center justify-center gap-2 ${
                mode === "signup" ? "text-white" : "text-green-600"
              }`}
              onClick={() => setMode("signup")}
            >
              <UserPlus className="w-5 h-5" />
              Sign Up
            </button>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full Name"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              className={`w-full ${
                mode === "signin"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"
              } text-white py-3 rounded-lg font-medium`}
            >
              {mode === "signin" ? "Sign In" : "Sign Up"}
            </Button>
            {error && (
              <div className="text-red-500 text-center text-sm">{error}</div>
            )}
          </form>
          
          <p className="text-center text-sm text-gray-500">
            Secure access for teachers only
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth; 