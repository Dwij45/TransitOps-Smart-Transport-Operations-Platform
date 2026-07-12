import Link from "next/link";
import { Zap } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function LandingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isAuthenticated = !!session?.user;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 flex flex-col font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground shadow-lg shadow-primary/20">
              T
            </div>
            <span className="font-semibold text-lg tracking-tight">TransitOps</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/profile" className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 py-2 text-sm font-medium transition-colors">
                Profile
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </Link>
                <Link href="/login" className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 py-2 text-sm font-medium transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden pt-32 pb-20">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[100px] opacity-50 pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 text-center z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border text-sm text-muted-foreground mb-8 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
            Next-Gen Transport Management
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
            Smart Operations for <br className="hidden md:block" />
            <span className="text-primary">
              Modern Fleets
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Unify your dispatch, maintenance, and finance operations in one beautiful platform. 
            Built for scale, designed for simplicity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard" className="inline-flex items-center justify-center font-medium h-14 px-8 text-base rounded-full bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-lg shadow-primary/20 transition-all hover:scale-105">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="inline-flex items-center justify-center font-medium h-14 px-8 text-base rounded-full bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-lg shadow-primary/20 transition-all hover:scale-105">
                  Start Your Free Trial
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center font-medium h-14 px-8 text-base rounded-full bg-muted border border-border text-foreground hover:bg-muted/80 backdrop-blur-md transition-all">
                  Book a Demo
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mockup Preview Area */}
        <div className="w-full max-w-6xl mx-auto px-6 mt-20 z-10 perspective-1000">
          <div className="rounded-2xl border border-border bg-card backdrop-blur-xl shadow-2xl p-2 md:p-4 rotate-x-12 scale-95 hover:rotate-x-0 hover:scale-100 transition-all duration-700 ease-out">
            <div className="rounded-xl overflow-hidden border border-border bg-background aspect-video flex items-center justify-center relative">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=2945&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
               <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent"></div>
               <div className="z-10 text-center">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-2xl backdrop-blur-md flex items-center justify-center border border-border mb-4 shadow-xl">
                    <Zap className="w-8 h-8 text-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">Live Dashboard Preview</h3>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
