require('dotenv').config();
const fastify = require('fastify')({ 
    logger: {
        level: process.env.NODE_ENV === 'production' ? 'warn' : 'info'
    }
});
const dbConnection = require('./database/connection');

// Register CORS plugin
fastify.register(require('@fastify/cors'), {
    origin: true // Allow all origins in development
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
    try {
        const dbHealth = await dbConnection.healthCheck();
        
        if (dbHealth.status === 'healthy') {
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: dbHealth
            };
        } else {
            reply.code(503);
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                database: dbHealth
            };
        }
    } catch (error) {
        reply.code(503);
        return {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        };
    }
});

// Main API endpoint - Get user count (O(1) operation)
fastify.get('/api/usercount', async (request, reply) => {
    try {
        const userStats = await dbConnection.getUserCount();
        
        return {
            totalUsers: parseInt(userStats.total_users),
            lastUpdated: userStats.last_updated
        };
    } catch (error) {
        fastify.log.error('Error fetching user count:', error);
        
        reply.code(500);
        return {
            error: 'Internal Server Error',
            message: 'Failed to retrieve user count',
            timestamp: new Date().toISOString()
        };
    }
});

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    
    // Database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        reply.code(503);
        return {
            error: 'Service Unavailable',
            message: 'Database connection failed',
            timestamp: new Date().toISOString()
        };
    }
    
    // Default error response
    reply.code(500);
    return {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
    };
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
        await dbConnection.close();
        await fastify.close();
        process.exit(0);
    } catch (error) {
        fastify.log.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
    try {
        // Connect to database first
        await dbConnection.connect();
        
        // Start the server
        const port = process.env.PORT || 6776;
        const host = process.env.HOST || '0.0.0.0';
        
        await fastify.listen({ port, host });
        
        console.log(`🚀 Server running on http://${host}:${port}`);
        console.log(`📊 User count API available at http://${host}:${port}/api/usercount`);
        console.log(`❤️ Health check available at http://${host}:${port}/health`);
        
    } catch (error) {
        fastify.log.error('Error starting server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    fastify.log.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

start();
