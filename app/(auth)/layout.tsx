import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* Left side - Branding/Imagery */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-card border-r border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-background z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555664424-778a1e5e3b48?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-overlay" />
        
        <div className="relative z-20 flex flex-col justify-between p-12 h-full text-foreground">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground shadow-lg shadow-primary/20">
              T
            </div>
            <span className="font-semibold text-lg tracking-tight">TransitOps</span>
          </Link>
          
          <div className="max-w-md">
            <h2 className="text-3xl font-bold mb-4">Streamline your entire transit operation.</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Join thousands of dispatchers and fleet managers who use TransitOps to run their operations efficiently and at scale.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Forms */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-center mb-12">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">
              T
            </div>
            <span className="font-semibold text-lg tracking-tight">TransitOps</span>
          </Link>
        </div>

        <div className="mx-auto w-full max-w-sm lg:w-[400px]">
          {children}
        </div>
      </div>
    </div>
  );
}
