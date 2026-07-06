const { createClient } = require('redis');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 3000,
        // Give up after a few tries instead of retrying forever — without this,
        // an unreachable Redis (e.g. REDIS_URL still pointing at localhost on a
        // host with no local Redis) hangs connect() indefinitely and blocks
        // server startup, since server.js awaits connectRedis() before listen().
        reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(retries * 200, 1000)),
      },
    });
    redisClient.on('error', (err) => console.warn('Redis error (non-fatal):', err.message));
    await redisClient.connect();
    console.log('Redis Connected');
    return redisClient;
  } catch (error) {
    console.warn('Redis connection failed (continuing without cache):', error.message);
    redisClient = null;
    return null;
  }
};

const getRedis = () => redisClient;

module.exports = { connectRedis, getRedis };
