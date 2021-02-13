export interface Source {
  username: string;
  password: string;
  login: () => Promise<void>;
}
