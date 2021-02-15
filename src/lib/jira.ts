import axios from 'axios';
import * as dayjs from 'dayjs';

import { Source } from './source';

interface Issue {
  expand: string;
  id: string;
  self: string;
  key: string;
  fields: {
    [fieldKey: string]: Record<string, unknown>;
  } & {
    summary: string;
    assignee: {
      name: string;
    };
    status: {
      name: string;
      statusCategory: {
        key: string;
        name: string;
        colorName: string;
      };
    };
    priority: {
      name: string;
    };
    components: {
      name: string;
    }[];
    created: string;
    /**
     * 引入bug负责人
     */
    customfield_10440?: {
      name: string;
    };
  };
}

interface HcmBugData {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: Issue[];
}

export class Jira implements Source {
  username: string;

  password: string;

  constructor({ username, password }: { username: string; password: string }) {
    this.username = username;
    this.password = password;
  }

  async generate({ members, start, end }: { members: string[]; start?: string; end?: string }) {
    start = start ?? dayjs(end).startOf('week').add(1, 'day').format('YYYY-MM-DD');
    end = end ?? dayjs(start).endOf('week').add(1, 'day').format('YYYY-MM-DD');
    let report = '';

    const hcmBugs = await this.fetchHcmBugs({ members, start, end });
    report += `本周共反馈了${hcmBugs.total}个bug：\n`;
    report += this.format(hcmBugs.issues);
    report += '\n\n';
    const unresolvedHcmBugs = await this.fetchUnresolvedHcmBugs({ members, start });
    if (unresolvedHcmBugs.total > 0) {
      report += `超过1周且未关闭的bug有${unresolvedHcmBugs.total}个：\n`;
      report += this.format(unresolvedHcmBugs.issues);
      report += '\n';
    }
    console.log(report);
  }

  async fetchHcmBugs({ members, start, end }: { members: string[]; start: string; end: string }) {
    const jql = `project = HCMBUGS AND issuetype = Bug AND status in ("To Do", 修复中, "In Review", DONE, 已反馈, 调查中, 待产品确认, 待修复, 测试验证中, 待测试, 无法复现, 遗留问题, Bug转任务, 历史数据原因无法查证) AND priority in (Highest, High, Medium, Low, Lowest) AND HCM的BUG分类 = 技术bug AND created >= ${start} AND created <= ${end} AND assignee in (${members.join(',')}) ORDER BY created ASC, cf[10608] ASC, status ASC, priority DESC, updated ASC`;
    const { data }: { data: HcmBugData } = await axios.post(
      'https://jira.mokahr.com/rest/api/2/search',
      {
        jql,
        startAt: 0,
      },
      {
        auth: {
          username: this.username,
          password: this.password,
        },
      }
    );
    return data;
  }

  async fetchUnresolvedHcmBugs({ members, start }: { members: string[]; start: string }) {
    const jql = `project = HCMBUGS AND issuetype = Bug AND status in ("To Do", 修复中, "In Review", DONE, 已反馈, 调查中, 待产品确认, 待修复, 测试验证中, 待测试, 无法复现, 遗留问题, Bug转任务, 历史数据原因无法查证) AND priority in (Highest, High, Medium, Low, Lowest) AND HCM的BUG分类 = 技术bug AND created < ${start} AND assignee in (${members.join(',')}) AND resolution = Unresolved ORDER BY created ASC, cf[10608] ASC, status ASC, priority DESC, updated ASC`;
    const { data }: { data: HcmBugData } = await axios.post(
      'https://jira.mokahr.com/rest/api/2/search',
      {
        jql,
        startAt: 0,
      },
      {
        auth: {
          username: this.username,
          password: this.password,
        },
      }
    );
    return data;
  }

  format(issues: Issue[]) {
    const headers = ['Priority', 'jira link', 'component', 'summary', 'importer', 'assignee', 'status', 'duration'];
    const results: string[] = [];
    results.push('|' + headers.join('|') + '|');
    results.push('|' + headers.map((header) => new Array(header.length).fill('-').join('')).join('|') + '|');
    issues.forEach((issue) => {
      results.push([
        '',
        issue.fields.priority.name,
        `https://jira.mokahr.com/browse/${issue.key}`,
        issue.fields.components.map((x) => x.name).join(','),
        issue.fields.summary,
        issue.fields.customfield_10440?.name || ' ',
        issue.fields.assignee.name,
        issue.fields.status.name,
        dayjs(issue.fields.created).toNow(),
        '',
      ].join('|'));
    });
    return results.join('\n');
  }
}
