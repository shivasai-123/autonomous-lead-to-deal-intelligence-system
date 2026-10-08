import { env } from '../config/environment.js';

export class HealthService {
  static getHealthStatus() {
    return {
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: '1.0.0'
    };
  }
}
