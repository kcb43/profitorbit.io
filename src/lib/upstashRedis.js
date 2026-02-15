/**
 * Upstash Redis REST client for Vercel serverless functions
 */

class UpstashRedis {
  constructor() {
    this.url = process.env.UPSTASH_REDIS_REST_URL;
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!this.url || !this.token) {
      throw new Error('Upstash Redis credentials not set');
    }
  }

  async execute(command, ...args) {
    const response = await fetch(`${this.url}/${command}/${args.join('/')}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Redis command failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  }

  async get(key) {
    return await this.execute('GET', key);
  }

  async set(key, value) {
    return await this.execute('SET', key, value);
  }

  async setex(key, seconds, value) {
    return await this.execute('SETEX', key, seconds, value);
  }

  async incr(key) {
    return await this.execute('INCR', key);
  }

  async del(key) {
    return await this.execute('DEL', key);
  }

  async exists(key) {
    return await this.execute('EXISTS', key);
  }
}

export const redis = new UpstashRedis();
