const { Client } = require('ssh2');

const host = process.argv[2];
const password = process.argv[3];
const command = process.argv.slice(4).join(' ');

if (!host || !password || !command) {
  console.error('Usage: node ssh-exec.js <host> <password> <command>');
  process.exit(1);
}

const conn = new Client();

conn.on('ready', () => {
  conn.exec(command, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      process.exit(1);
    }

    let stdout = '';
    let stderr = '';

    stream.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data.toString());
    });

    stream.on('close', (code, signal) => {
      if (stderr) process.stderr.write(stderr);
      conn.end();
      process.exit(code || 0);
    });

    stream.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data.toString());
    });
  });
});

conn.on('error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});

conn.connect({
  host,
  port: 22,
  username: 'root',
  password,
  readyTimeout: 30000,
});
