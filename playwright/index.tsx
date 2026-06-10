// Component Testing entry point. Pull in the app's global styles so mounted
// components render with their real CSS (class names are shared verbatim).
import { beforeMount } from "@playwright/experimental-ct-react/hooks";
import { __setQueryData } from "../src/test/mocks/convexReact";
import "../src/index.css";

// Convex query fixtures for components that call useQuery (Shell): a test
// passes them via mount(..., { hooksConfig: { queries } }) and the aliased
// "convex/react" stub (src/test/mocks/convexReact.ts) serves them by function
// name, e.g. "courseQueries:getCourse".
export type HooksConfig = {
  queries?: Record<string, unknown>;
};

beforeMount<HooksConfig>(async ({ hooksConfig }) => {
  if (hooksConfig?.queries) __setQueryData(hooksConfig.queries);
});
