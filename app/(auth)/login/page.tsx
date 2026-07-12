import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe } from "lucide-react";

export default function LoginPage() {
  return (
    <>
      <div className="flex flex-col space-y-2 text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email to sign in to your account
        </p>
      </div>
      
      <div className="grid gap-6">
        <form>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-muted-foreground">Email</Label>
              <Input 
                id="email" 
                placeholder="name@example.com" 
                type="email" 
                autoCapitalize="none" 
                autoComplete="email" 
                autoCorrect="off" 
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-11"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-muted-foreground">Password</Label>
                <Link href="#" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <Input 
                id="password" 
                type="password" 
                className="bg-muted border-border text-foreground h-11"
              />
            </div>
            <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all hover:shadow-lg hover:shadow-primary/20">
              Sign In
            </Button>
          </div>
        </form>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
        
        <Button variant="outline" className="w-full h-11 bg-transparent border-border text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
          <Globe className="mr-2 h-4 w-4" />
          Google
        </Button>
      </div>
      
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:text-primary/80 transition-colors">
          Sign up
        </Link>
      </p>
    </>
  );
}
