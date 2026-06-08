import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Shell } from "./components/Shell";
import { SignIn } from "./components/SignIn";
import { Splash } from "./components/Splash";
import { useTheme } from "./lib/useTheme";

export default function App() {
  const { choice, cycle } = useTheme();
  return (
    <div className="m-app">
      <AuthLoading>
        <Splash />
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <Shell themeChoice={choice} onCycleTheme={cycle} />
      </Authenticated>
    </div>
  );
}
