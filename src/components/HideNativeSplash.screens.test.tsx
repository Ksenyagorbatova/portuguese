import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Где именно прячется нативный сплэш iOS-оболочки. Инвариант: только на первом
// НАСТОЯЩЕМ экране — форма входа, загруженный курс или экран ошибки. Пока
// идёт загрузка (AuthLoading / курс ещё не пришёл), сплэш-логотип держится —
// иначе старт выглядит как «логотип → спиннер «Загрузка…» → главный».
const native = vi.hoisted(() => ({ hideNativeSplash: vi.fn(), isNative: vi.fn(() => false) }));
vi.mock("../lib/native", () => native);

const queries = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0]) => queries.data[getFunctionName(ref)],
    useQueries: (qs: Record<string, { query: Parameters<typeof getFunctionName>[0] }>) =>
      Object.fromEntries(Object.entries(qs).map(([k, { query }]) => [k, queries.data[getFunctionName(query)]])),
    useMutation: () => async () => undefined,
    useConvexConnectionState: () => ({ isWebSocketConnected: true, hasEverConnected: true }),
  };
});
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: async () => undefined, signOut: async () => undefined }),
}));

import { Shell } from "./Shell";
import { SignIn } from "./SignIn";
import { ErrorBoundary } from "./ErrorBoundary";
import { Boom } from "../test/mocks/Boom";

const loaded = {
  "courseQueries:getCourse": {
    topics: [
      {
        topicKey: "t1",
        label: "Приветствия",
        icon: "👋",
        lessons: [
          {
            lessonKey: "l1",
            label: "Урок 1",
            theory: { intro: "", tip: "", sections: [] },
            words: [{ lessonKey: "l1", pt: "olá", ru: "привет" }],
          },
        ],
        sentences: [],
      },
    ],
    crossSentences: [],
  },
  "progress:getSrsState": {
    streak: 0,
    lastDay: null,
    bestStreak: 0,
    startedAt: null,
    cards: [],
    tags: [],
    seenTheory: [],
    learnedPts: [],
    dueCountAll: 0,
    lessonStats: {},
    topicStats: {},
  },
};

const noop = () => {};

beforeEach(() => {
  native.hideNativeSplash.mockClear();
  queries.data = {};
});
// Без globals Vitest RTL не размонтирует дерево сам — иначе «Загрузка…»
// прошлого теста остаётся в document.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("native splash is hidden only by a real first screen", () => {
  it("Shell keeps it while the course is loading", () => {
    render(<Shell themeChoice="light" onCycleTheme={noop} />);
    expect(screen.getByText("Загрузка…")).toBeInTheDocument();
    expect(native.hideNativeSplash).not.toHaveBeenCalled();
  });

  it("Shell hides it once the course and progress are loaded", () => {
    queries.data = loaded;
    render(<Shell themeChoice="light" onCycleTheme={noop} />);
    expect(screen.queryByText("Загрузка…")).not.toBeInTheDocument();
    expect(native.hideNativeSplash).toHaveBeenCalledTimes(1);
  });

  it("the sign-in form hides it", () => {
    render(<SignIn />);
    expect(native.hideNativeSplash).toHaveBeenCalledTimes(1);
  });

  it("the error fallback hides it; a healthy boundary leaves it to its children", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Что-то пошло не так.")).toBeInTheDocument();
    expect(native.hideNativeSplash).toHaveBeenCalledTimes(1);

    native.hideNativeSplash.mockClear();
    render(
      <ErrorBoundary>
        <div>живой контент</div>
      </ErrorBoundary>,
    );
    expect(native.hideNativeSplash).not.toHaveBeenCalled();
  });
});
