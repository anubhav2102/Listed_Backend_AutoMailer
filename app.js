const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const credentials = require('./credentials.json').web;

const oAuth2Client = new OAuth2Client(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);

async function authenticate() {
  try {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.modify'],
    });

    console.log('Authorize this app by visiting this URL:', authUrl);

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question('Enter the authorization code: ', async (code) => {
      readline.close();

      const tokenResponse = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokenResponse.tokens);
      console.log('Authentication successful!');

      // Start the application after successful authentication
      startApp();
    });
  } catch (error) {
    console.error('Error during authentication:', error);
  }
}

async function checkAndRespondToEmails() {
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  // Retrieve the list of messages
  const res = await gmail.users.messages.list({ userId: 'me' });
  const messages = res.data.messages;

  for (const message of messages) {
    const msgRes = await gmail.users.messages.get({ userId: 'me', id: message.id });
    const email = msgRes.data;

    // Check if the email thread has prior replies
    const hasPriorReplies = email.threadId && email.payload.headers.some((header) => header.name === 'From' && header.value === 'anubhavladha9426@gmail.com');

    if (!hasPriorReplies) {
      // Compose and send the reply email
      const reply = {
        to: email.payload.headers.find((header) => header.name === 'Reply-To' || header.name === 'From').value,
        subject: 'Auto-reply',
        body: 'Thank you for your email. I am currently on vacation and will get back to you as soon as possible.',
      };

      const raw = makeEmailRaw(reply);
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });

      // Add label to the email
      const labelName = 'Vacation Auto-reply'; // Customize the label name
      const labelRes = await gmail.users.labels.list({ userId: 'me' });
      const labels = labelRes.data.labels;
      let label = labels.find((l) => l.name === labelName);

      if (!label) {
        // Create the label if it doesn't exist
        const createdLabel = await gmail.users.labels.create({
          userId: 'me',
          requestBody: { name: labelName },
        });
        label = createdLabel.data;
      }

      await gmail.users.messages.modify({
        userId: 'me',
        id: message.id,
        requestBody: { addLabelIds: [label.id], removeLabelIds: ['INBOX'] },
      });
    }
  }
}

function makeEmailRaw({ to, subject, body }) {
  const emailLines = [];
  emailLines.push(`To: ${to}`);
  emailLines.push(`Subject: ${subject}`);
  emailLines.push('');
  emailLines.push(body);
  return Buffer.from(emailLines.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

function getRandomInterval() {
  return Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000; // Random interval in milliseconds
}

async function startApp() {
  await authenticate(); // Wait for authentication before starting the app
  setInterval(checkAndRespondToEmails, getRandomInterval());
}

startApp();
