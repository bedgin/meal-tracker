export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "#FFF7F0" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-fredoka font-medium" style={{ fontSize: 32, background: "linear-gradient(135deg, #FF9446, #FF6A12)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Meal Tracker
          </h1>
        </div>
        <div style={{ background: "#fff", borderRadius: 22, boxShadow: "0 8px 24px rgba(80,40,10,0.08)", padding: "32px 28px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
