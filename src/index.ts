import { Command, flags } from '@oclif/command';
import cli from 'cli-ux';

import { Jira } from './lib/jira';

class WeeklyReport extends Command {
  static description = 'describe the command here'

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
  }

  static args = [{ name: 'file' }]

  async run() {
    const { args, flags } = this.parse(WeeklyReport);

    const username = await cli.prompt('jira user name?');
    const password = await cli.prompt('jira password?', { type: 'hide' });
    const jira = new Jira(username, password);

    await jira.login();
  }
}

export = WeeklyReport
