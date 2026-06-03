import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Shell } from "./components/Shell";
import { SignIn } from "./components/SignIn";
import { Splash } from "./components/Splash";

export default function App() {
  return (
    <div className="app">
      <AuthLoading>
        <Splash />
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <Shell />
      </Authenticated>
    </div>
  );
}
