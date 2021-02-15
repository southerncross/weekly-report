import { Command, flags } from '@oclif/command';
import cli from 'cli-ux';
import * as dayjs from 'dayjs';
import * as relativeTime from 'dayjs/plugin/relativeTime';

import { Jira } from './lib/jira';

dayjs.extend(relativeTime);

class WeeklyReport extends Command {
  static description = 'describe the command here';

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    start: flags.string({ char: 's' }),
    end: flags.string({ char: 'e' }),
  };

  static args = [{ name: 'members' }];

  async run() {
    const { args, flags } = this.parse(WeeklyReport);
    const members = args.members.split(',');

    const username = await cli.prompt('jira user name?');
    const password = await cli.prompt('jira password?', { type: 'hide' });
    const jira = new Jira({ username, password });

    await jira.generate({ members, start: flags.start, end: flags.end });
  }
}

export = WeeklyReport
