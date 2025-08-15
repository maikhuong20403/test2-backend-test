require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const dbConnection = require('../database/connection');

async function runMigration() {
    console.log('🔄 Starting database migration...');
    
    try {
        // Connect to database
        await dbConnection.connect();
        console.log('✅ Connected to database');
        
        // Read and execute schema SQL
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schemaSql = await fs.readFile(schemaPath, 'utf8');
        
        console.log('📝 Executing schema migration...');
        await dbConnection.query(schemaSql);
        console.log('✅ Schema migration completed');
        
        // Verify the setup
        console.log('🔍 Verifying migration...');
        
        // Check if tables exist
        const tablesResult = await dbConnection.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('user_list', 'user_stats')
            ORDER BY table_name
        `);
        
        console.log('📊 Created tables:', tablesResult.rows.map(row => row.table_name));
        
        // Check if triggers exist
        const triggersResult = await dbConnection.query(`
            SELECT trigger_name, event_manipulation, event_object_table
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public'
            AND event_object_table = 'user_list'
            ORDER BY trigger_name
        `);
        
        console.log('⚡ Created triggers:', triggersResult.rows.map(row => 
            `${row.trigger_name} (${row.event_manipulation} on ${row.event_object_table})`
        ));
        
        // Check if functions exist
        const functionsResult = await dbConnection.query(`
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name IN ('update_user_count', 'recalculate_user_count')
            ORDER BY routine_name
        `);
        
        console.log('🔧 Created functions:', functionsResult.rows.map(row => row.routine_name));
        
        // Verify user_stats initialization
        const userStatsResult = await dbConnection.query('SELECT * FROM user_stats WHERE id = 1');
        if (userStatsResult.rows.length > 0) {
            const stats = userStatsResult.rows[0];
            console.log(`📈 User stats initialized: ${stats.total_users} users, last updated: ${stats.last_updated}`);
        }
        
        console.log('🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        await dbConnection.close();
    }
}

// Add sample data function (for testing purposes)
async function addSampleData() {
    console.log('🔄 Adding sample data...');
    
    try {
        await dbConnection.connect();
        
        const sampleUsers = [
            { username: 'john_d1oe', email: 'john1@example.com' },
            { username: 'jane_sm1ith', email: 'jane1@example.com' },
            { username: 'bob_wil1son', email: 'b1ob@example.com' },
            { username: 'alice_br1own', email: 'al1ice@example.com' },
            { username: 'charli1e_davis', email: 'cha1rlie@example.com' }
        ];
        
        for (const user of sampleUsers) {
            try {
                await dbConnection.query(
                    'INSERT INTO user_list (username, email) VALUES ($1, $2)',
                    [user.username, user.email]
                );
                console.log(`✅ Added user: ${user.username}`);
            } catch (error) {
                if (error.code === '23505') { // Unique constraint violation
                    console.log(`⚠️ User ${user.username} already exists, skipping...`);
                } else {
                    throw error;
                }
            }
        }
        
        // Verify the count
        const countResult = await dbConnection.getUserCount();
        console.log(`📊 Total users after sample data: ${countResult.total_users}`);
        
        console.log('🎉 Sample data added successfully!');
        
    } catch (error) {
        console.error('❌ Failed to add sample data:', error.message);
        throw error;
    }
}

// Command line interface
const command = process.argv[2];

if (command === 'sample') {
    runMigration()
        .then(() => addSampleData())
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
} else {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
