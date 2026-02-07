import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Spin, message } from "antd";
import MainLayout from "./pages/MainLayout";
import Login from "./pages/Login";
import SetupAdmin from "./pages/SetupAdmin";
import type { UserInfo } from "./types/runtime";
import "./App.css";

type ViewState = "loading" | "setup" | "login" | "app";

function App() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const hasBridge = typeof window !== "undefined" && !!window.api;
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getProfileKey = (userId: string) => `lx-wms.profile.${userId}`;

  const hydrateProfile = (user: UserInfo): UserInfo => {
    try {
      const raw = localStorage.getItem(getProfileKey(user.id));
      if (!raw) {
        return user;
      }
      const parsed = JSON.parse(raw) as Partial<UserInfo>;
      return { ...user, ...parsed };
    } catch {
      return user;
    }
  };

  useEffect(() => {
    if (!hasBridge) return;
    const loadInitState = async () => {
      try {
        const state = await window.api.getInitState();
        setViewState(state.initialized ? "login" : "setup");
      } catch {
        messageApi.error("初始化失败，请重启应用");
      }
    };
    loadInitState();
  }, [hasBridge, messageApi]);

  const handleRegistered = () => {
    setViewState("login");
  };

  const handleLoginSuccess = (user: UserInfo) => {
    setCurrentUser(hydrateProfile(user));
    setViewState("app");
  };

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setViewState("login");
  }, []);

  useEffect(() => {
    if (viewState !== "app") {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    const idleLimit = 10 * 60 * 1000;
    const resetTimer = () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = window.setTimeout(() => {
        messageApi.info("已超时，请重新登录");
        handleLogout();
      }, idleLimit);
    };
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    const handleActivity = () => resetTimer();
    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    resetTimer();
    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [handleLogout, messageApi, viewState]);

  const handleUpdateProfile = (nextUser: UserInfo) => {
    setCurrentUser(nextUser);
    try {
      localStorage.setItem(
        getProfileKey(nextUser.id),
        JSON.stringify({
          displayName: nextUser.displayName ?? "",
          phone: nextUser.phone ?? "",
          email: nextUser.email ?? "",
          avatarUrl: nextUser.avatarUrl ?? "",
        }),
      );
    } catch {
      messageApi.error("个人资料保存失败，请稍后重试");
    }
  };

  let content: ReactNode;
  if (viewState === "loading") {
    content = (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    );
  } else if (viewState === "setup") {
    content = <SetupAdmin onRegistered={handleRegistered} />;
  } else if (!hasBridge) {
    content = (
      <div className="unsupported-page">
        <div className="unsupported-card">
          <h2>请在桌面端打开</h2>
          <p>当前页面是浏览器预览，无法访问本地数据库与系统功能。</p>
        </div>
      </div>
    );
  } else if (viewState === "login") {
    content = <Login onLoginSuccess={handleLoginSuccess} />;
  } else {
    content = (
      <MainLayout
        currentUser={currentUser}
        onLogout={handleLogout}
        onUpdateProfile={handleUpdateProfile}
      />
    );
  }

  return (
    <div className="app-root">
      {contextHolder}
      {content}
    </div>
  );
}

export default App;
