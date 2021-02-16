import axios from 'axios';
import * as dayjs from 'dayjs';

import { Source } from './source';

type Person = {
  name: string;
  displayName: string;
} | null;

interface Issue {
  expand: string;
  id: string;
  self: string;
  key: string;
  fields: {
    [fieldKey: string]: Record<string, unknown>;
  } & {
    summary: string;
    assignee: Person;
    status: {
      name: string;
      statusCategory: {
        key: string;
        name: string;
        colorName: string;
      };
    };
    issuetype: {
      subtask: boolean;
    };
    priority: {
      name: string;
    };
    /**
     * 所属模块
     */
    components: {
      name: string;
    }[];
    subtasks: Issue[];
    created: string;
    parent?: Issue;
    /**
     * 引入bug负责人
     */
    customfield_10440: Person;
    /**
     * 预计上线日期
     */
    customfield_11218: string;
    /**
     * 技术负责人
     */
    customfield_11219: Person;
    /**
     * 前端开发人员
     */
    customfield_10758: Person;
  };
}

interface IssuesResData {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: Issue[];
}

interface IssueResData {
  expand: string;
  id: string;
  key: string;
  fields: Issue['fields'];
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

    // const hcmBugs = await this.fetchHcmBugs({ members, start, end });
    // report += `本周共反馈了${hcmBugs.total}个bug：\n`;
    // report += this.format(hcmBugs.issues);
    // report += '\n\n';
    // const unresolvedHcmBugs = await this.fetchUnresolvedHcmBugs({ members, start });
    // if (unresolvedHcmBugs.total > 0) {
    //   report += `超过1周且未关闭的bug有${unresolvedHcmBugs.total}个：\n`;
    //   report += this.format(unresolvedHcmBugs.issues);
    //   report += '\n';
    // }
    // console.log(report);

    const data = await this.fetchUnresolvedSprintIssues({ members, end });
    console.log(this.outputHtml(data.issues));
  }

  private async fetchIssues<DataType>(jql: string) {
    const { data }: { data: DataType } = await axios.post(
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

  private async fetchIssue<DataType>(key: string) {
    const { data }: { data: DataType } = await axios.get(
      `/rest/api/2/issue/${key}`,
      {
        auth: {
          username: this.username,
          password: this.password,
        },
      }
    );
    return data;
  }

  async fetchHcmBugs({ members, start, end }: { members: string[]; start: string; end: string }) {
    const jql = `project = HCMBUGS AND issuetype = Bug AND status in ("To Do", 修复中, "In Review", DONE, 已反馈, 调查中, 待产品确认, 待修复, 测试验证中, 待测试, 无法复现, 遗留问题, Bug转任务, 历史数据原因无法查证) AND priority in (Highest, High, Medium, Low, Lowest) AND HCM的BUG分类 = 技术bug AND created >= ${start} AND created <= ${end} AND assignee in (${members.join(',')}) ORDER BY created ASC, cf[10608] ASC, status ASC, priority DESC, updated ASC`;
    const data = await this.fetchIssues<IssuesResData>(jql);
    return data;
  }

  async fetchUnresolvedHcmBugs({ members, start }: { members: string[]; start: string }) {
    const jql = `project = HCMBUGS AND issuetype = Bug AND status in ("To Do", 修复中, "In Review", DONE, 已反馈, 调查中, 待产品确认, 待修复, 测试验证中, 待测试, 无法复现, 遗留问题, Bug转任务, 历史数据原因无法查证) AND priority in (Highest, High, Medium, Low, Lowest) AND HCM的BUG分类 = 技术bug AND created < ${start} AND assignee in (${members.join(',')}) AND resolution = Unresolved ORDER BY created ASC, cf[10608] ASC, status ASC, priority DESC, updated ASC`;
    const data = await this.fetchIssues<IssuesResData>(jql);
    return data;
  }

  async fetchUnresolvedSprintIssues({ members, end }: { members: string[]; end: string }) {
    let jql = `project = HCM AND issuetype in (Story, 任务, 工程优化) AND (预计上线日期 > ${end} OR 技术负责人 != EMPTY AND 预计上线日期 = EMPTY) AND (技术负责人 in (${members.join(',')}) OR 前端成本（pd）> 0 OR 前端开发人员 in (${members.join(',')}) OR assignee in (${members.join(',')}))`;
    const data = await this.fetchIssues<IssuesResData>(jql);
    const taskKeys: string[] = [];
    data.issues.forEach((issue) => {
      if (issue.fields.subtasks.length > 0) {
        taskKeys.push(issue.key);
      }
    });
    jql = `parent in (${taskKeys.join(',')})`;
    const { issues }: { issues: Issue[] } = await this.fetchIssues<IssuesResData>(jql);
    data.total += issues.length;
    data.issues.push(...issues);
    return data;
  }

  async fetchResolvedSprintIssues({ members, start, end }: { members: string[]; start: string; end: string }) {
    const jql = `project = HCM AND issuetype in (Story, 任务, 工程优化, subTaskIssueTypes()) AND resolved >= ${start} AND resolved <= ${end} AND (技术负责人 in (${members.join(',')}) OR 前端成本（pd）> 0 OR 前端开发人员 in (${members.join(',')}) OR assignee in (${members.join(',')}))`;
    const data = await this.fetchIssues<IssuesResData>(jql);
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
        issue.fields.assignee?.name || '',
        issue.fields.status.name,
        dayjs(issue.fields.created).toNow(),
        '',
      ].join('|'));
    });
    return results.join('\n');
  }

  outputHtml(issues: Issue[]) {
    const tasks: Issue[] = [];
    const subtaskEntities: Record<string, Issue> = {};
    issues.forEach((issue) => {
      if (issue.fields.issuetype.subtask) {
        subtaskEntities[issue.key] = issue;
      } else {
        tasks.push(issue);
      }
    });
    let result = '<table><thead>';
    result += ['模块', '描述', 'jira', '经办人', '状态', '预计上线日期'].map((header) => `<th>${header}</th>`).join('');
    result += '</thead><tbody>';
    const componentToIssues = tasks.reduce<Record<string, Issue[]>>((res, issue) => {
      let componentName = '';
      if (issue.fields.components.length === 0) {
        componentName = '工程优化';
      } else {
        for (const component of issue.fields.components) {
          if (/审批/.test(component.name)) {
            componentName = '审批';
            break;
          } else if (/组织|人事|入职/.test(component.name)) {
            componentName = '组织&人事';
            break;
          } else if (/假勤/.test(component.name)) {
            componentName = '假勤';
            break;
          } else if (/薪酬/.test(component.name)) {
            componentName = '薪酬';
            break;
          } else if (/绩效/.test(component.name)) {
            componentName = '绩效';
            break;
          }
        }

        componentName = componentName || '通用产品';
      }

      res[componentName] = res[componentName] || [];
      res[componentName].push(issue);
      return res;
    }, {});

    ['审批', '组织&人事', '假勤', '薪酬', '绩效', '通用产品', '工程优化'].forEach((component) => {
      (componentToIssues[component] || []).forEach((issue) => {
        result += '<tr>' + [component, issue.fields.summary, issue.key, issue.fields.customfield_10758?.displayName || '', issue.fields.status.name, issue.fields.customfield_11218 || ''].map((item) => `<td>${item}</td>`).join('') + '</tr>';
        if (issue.fields.subtasks.length > 0) {
          issue.fields.subtasks.filter((subtask) => Boolean(subtaskEntities[subtask.key])).map((subtask) => subtaskEntities[subtask.key]).forEach((subtask) => {
            result += '<tr>' + ['', subtask.fields.summary, subtask.key, subtask.fields.assignee?.displayName || '', subtask.fields.status.name, subtask.fields.customfield_11218 || ''].map((item) => `<td>${item}</td>`).join('') + '</tr>';
          });
        }
      });
    });
    result += '</tbody></table>';

    return result;
  }
}
