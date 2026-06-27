const { createClient } = require('redis');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    redisClient.on('error', (err) => console.warn('Redis error (non-fatal):', err.message));
    await redisClient.connect();
    console.log('Redis Connected');
    return redisClient;
  } catch (error) {
    console.warn('Redis connection failed (continuing without cache):', error.message);
    return null;
  }
};

const getRedis = () => redisClient;

module.exports = { connectRedis, getRedis };
