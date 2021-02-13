import axios from 'axios';
import * as FormData from 'form-data';

import { Source } from './source';

export class Jira implements Source {
  username: string;

  password: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  async login() {
    const url = 'https://jira.mokahr.com/login.jsp';
    const form = new FormData();
    form.append('os_username', this.username);
    form.append('os_password', this.password);
    const { headers } = await axios.post(url, form);
  }
}
