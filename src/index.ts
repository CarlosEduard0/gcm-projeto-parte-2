import { Toolkit } from 'actions-toolkit';
const tools = new Toolkit();

// Run your GitHub Action!
run();

async function run() {
  try {

    const issueId = getIssueIdFromCommitMessage();
    tools.log.debug(`Issue id: ${issueId}`);

    if (!issueId) {
      tools.exit.failure('No linked issue found!');
      return;
    }

    const issue = await getIssueById(issueId);
    tools.log.debug(`Issue: ${JSON.stringify(issue, undefined, 2)}`);

    if (!issue) {
      tools.exit.failure('Linked issue not found!');
      return;
    }

    if (issue.state !== 'open') {
      tools.exit.failure('Linked issue is closed');
    }

    if (!issue.labels.find(x => x.name === 'developing')) {
      tools.exit.failure('Linked issue does not have the label "developing"');
    }

    tools.log.debug(JSON.stringify(tools.context.payload, undefined, 2));
    
    const changedFiles = await getChangedFiles();
    const comment = `**Date:** ${Date()}\n` +
                    `**Author:** ${tools.context.payload.head_commit.author.name}\n` +
                    `**Changed Files:** \n>${changedFiles.map(x => x.filename).join('\n')}\n\n` +
                    `**Commit Message:** ${tools.context.payload.head_commit.message}`;
    await tools.github.issues.createComment({
      ...tools.context.repo,
      issue_number: issueId,
      body: comment
    });

    tools.exit.success('Linked issue verified!')
  } catch (error) {
    tools.log.error(`Error verifying linked issue.`);
    tools.log.error(error);
  }
};

function getIssueIdFromCommitMessage(): number | null {
  const commitMessage = tools.context.payload.head_commit.message;
  tools.log.debug(`Checking commit message: "${commitMessage}"`);

  const re = /#[1-9]\d*/g;
  const matches = commitMessage.match(re);
  tools.log.debug(`Regex matches: ${matches}`);

  if (matches && matches.length > 0) {
    return Number(matches[0].replace('#', '').trim());
  }

  return null;
}

async function getIssueById(issueId: number) {
  try {
    const response = await tools.github.issues.get({
      ...tools.context.repo,
      issue_number: issueId
    });

    return response.data;
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
  }
}

async function getChangedFiles() {
  const response = await tools.github.repos.compareCommits({
    ...tools.context.repo,
    base: tools.context.payload.before,
    head: tools.context.payload.after
  });

  return response.data.files;
}

