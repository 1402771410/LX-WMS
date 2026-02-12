export type MailSettings = {
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
};

export type MailSettingsResult =
  | { ok: true; settings: MailSettings }
  | { ok: false; message: string };

const normalizeText = (value?: string): string => (value ?? "").trim();

const normalizePort = (value?: number | string): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value.trim());
  return Number.NaN;
};

const normalizeSecure = (value?: boolean | string): boolean => {
  if (typeof value === "boolean") return value;
  return value === "true";
};

const validateEmail = (email: string): string | null => {
  if (!email) return "请输入发件邮箱";
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return ok ? null : "发件邮箱格式不正确";
};

export const validateMailSettings = (input: {
  user?: string;
  pass?: string;
  host?: string;
  port?: number | string;
  secure?: boolean | string;
}): MailSettingsResult => {
  const user = normalizeText(input.user);
  const pass = normalizeText(input.pass);
  const host = normalizeText(input.host);
  const port = normalizePort(input.port);
  const secure = normalizeSecure(input.secure);
  const emailError = validateEmail(user);
  if (emailError) {
    return { ok: false, message: emailError };
  }
  if (!pass) {
    return { ok: false, message: "请输入邮箱授权码" };
  }
  if (!host) {
    return { ok: false, message: "请输入 SMTP 服务器" };
  }
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    return { ok: false, message: "SMTP 端口配置不正确" };
  }
  return {
    ok: true,
    settings: {
      user,
      pass,
      host,
      port,
      secure,
    },
  };
};
