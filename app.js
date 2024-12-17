import express from 'express';
import fetch from 'node-fetch';
import { createClient } from 'redis';

const app = express();

// initialize redis
const initRedis = async () => {
  try {
    const client = await createClient()
      .on('error', (err) => console.log('Redis Client Error', err))
      .connect();
    console.log('Redis connected');
    return client;
  } catch (err) {
    console.error('Error connecting to Redis:', err);
    process.exit(1);
  }
};

const client = await initRedis();

// Get response
const getResponse = (username, repos) => {
  return `<h1>${username}'s got <code>${repos}</code> public repos on <code>GitHub</code>.</h1>`;
};

// Get repos
const getRepos = async (req, res) => {
  console.log('Fetching data from GitHub...');
  const { username } = req.params;

  try {
    const response = await fetch(`https://api.github.com/users/${username}`);

    if (!response.ok) {
      return res.status(404).send(`<h2>User ${username} not found on GitHub.</h2>`);
    }

    const data = await response.json();
    const repos = data.public_repos;

    // Set data in redis
    await client.set(username, repos); // Cache expires in 60 seconds
    console.log(`Cached "${username}": "${repos}" in Redis`);

    res.status(200).send(getResponse(username, repos));
  } catch (err) {
    console.error(err);
    res.status(500).send('<h2>Server error!!!<h2>');
  }
};

// Cache check middleware
const isCached = async (req, res, next) => {
  const { username } = req.params;

  const cachedRepos = await client.get(username);

  if (cachedRepos === null) {
    return next();
  }

  console.log('Serving from cache...');
  res.status(200).send(getResponse(username, cachedRepos));
};

// Route
app.get('/repos/:username', isCached, getRepos);

// Start app
app.listen(5000, () => {
  console.log('\n\n\nApp running @ http://localhost:5000');
});
