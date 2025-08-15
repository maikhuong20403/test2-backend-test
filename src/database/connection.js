const { Pool } = require('pg');

class DatabaseConnection {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Database configuration from environment variables
            const config = {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 5432,
                database: process.env.DB_NAME || 'test001',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'mypassword123',
                // Connection pool settings
                max: 20, // Maximum number of clients in the pool
                idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
                connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
            };

            this.pool = new Pool(config);

            // Test the connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.isConnected = true;
            console.log('✅ Database connected successfully');
            
            // Handle pool errors
            this.pool.on('error', (err) => {
                console.error('❌ Unexpected error on idle client', err);
                this.isConnected = false;
            });

            return this.pool;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            this.isConnected = false;
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    async query(text, params = []) {
        if (!this.pool || !this.isConnected) {
            throw new Error('Database not connected. Call connect() first.');
        }

        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            
            // Log slow queries (> 100ms)
            if (duration > 100) {
                console.warn(`⚠️ Slow query detected (${duration}ms):`, text);
            }
            
            return result;
        } catch (error) {
            console.error('❌ Database query error:', error.message);
            throw error;
        }
    }

    async getUserCount() {
        try {
            // O(1) operation - query the materialized view
            const result = await this.query(
                'SELECT total_users, last_updated FROM user_stats WHERE id = 1'
            );
            
            if (result.rows.length === 0) {
                // Fallback: recalculate if user_stats is empty
                console.warn('⚠️ user_stats table is empty, recalculating...');
                await this.query('SELECT recalculate_user_count()');
                const recalcResult = await this.query(
                    'SELECT total_users, last_updated FROM user_stats WHERE id = 1'
                );
                return recalcResult.rows[0];
            }
            
            return result.rows[0];
        } catch (error) {
            console.error('❌ Error getting user count:', error.message);
            throw error;
        }
    }

    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return { status: 'healthy', connected: this.isConnected };
        } catch (error) {
            return { status: 'unhealthy', connected: false, error: error.message };
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('🔌 Database connection closed');
        }
    }
}

// Singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;
