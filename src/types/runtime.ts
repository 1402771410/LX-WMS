export type InitState = {
  initialized: boolean;
};

export type UserInfo = {
  id: string;
  username: string;
  role: string;
  displayName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  userCode?: string;
  status?: string;
  recoveryBoundAt?: string;
};
