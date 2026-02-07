import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import "antd/dist/reset.css";
import "./index.css";
import App from "./App";

dayjs.locale("zh-cn");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#1677ff",
          colorInfo: "#1677ff",
          colorSuccess: "#00b96b",
          colorWarning: "#faad14",
          colorError: "#ff4d4f",
          colorBgLayout: "#f7f9fc",
          colorBgContainer: "#ffffff",
          colorFillSecondary: "#f3f6fb",
          colorBorder: "#e5e7eb",
          colorBorderSecondary: "#eef2f7",
          colorText: "#1f2937",
          colorTextSecondary: "#6b7280",
          borderRadius: 10,
          borderRadiusLG: 12,
          borderRadiusSM: 8,
        },
        components: {
          Layout: {
            headerBg: "#ffffff",
            siderBg: "#ffffff",
            bodyBg: "#f7f9fc",
            triggerBg: "#ffffff",
          },
          Menu: {
            itemBg: "#ffffff",
            itemHoverBg: "#f2f6ff",
            itemSelectedBg: "#e6f4ff",
            itemSelectedColor: "#1677ff",
            itemColor: "#374151",
            subMenuItemBg: "#ffffff",
          },
          Card: {
            headerBg: "#ffffff",
          },
          Button: {
            borderRadius: 8,
            controlHeight: 36,
            controlHeightLG: 40,
          },
          Input: {
            controlHeight: 36,
          },
          Select: {
            controlHeight: 36,
          },
          Tabs: {
            cardGutter: 12,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
);
