-- Database: test001
-- This script creates the optimized user count system using materialized views with triggers

-- Create the main user_list table
CREATE TABLE IF NOT EXISTS user_list (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the user_stats table (materialized view for O(1) count operations)
CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_users INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row_constraint CHECK (id = 1)
);

-- Initialize the user_stats table with a single row
INSERT INTO user_stats (id, total_users, last_updated) 
VALUES (1, 0, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Function to update user count in user_stats table
CREATE OR REPLACE FUNCTION update_user_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment count on INSERT
        UPDATE user_stats 
        SET total_users = total_users + 1, 
            last_updated = CURRENT_TIMESTAMP 
        WHERE id = 1;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement count on DELETE
        UPDATE user_stats 
        SET total_users = total_users - 1, 
            last_updated = CURRENT_TIMESTAMP 
        WHERE id = 1;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for INSERT and DELETE operations
DROP TRIGGER IF EXISTS user_insert_trigger ON user_list;
CREATE TRIGGER user_insert_trigger
    AFTER INSERT ON user_list
    FOR EACH ROW
    EXECUTE FUNCTION update_user_count();

DROP TRIGGER IF EXISTS user_delete_trigger ON user_list;
CREATE TRIGGER user_delete_trigger
    AFTER DELETE ON user_list
    FOR EACH ROW
    EXECUTE FUNCTION update_user_count();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_list_username ON user_list(username);
CREATE INDEX IF NOT EXISTS idx_user_list_email ON user_list(email);
CREATE INDEX IF NOT EXISTS idx_user_list_created_at ON user_list(created_at);

-- Function to manually recalculate user count (for data integrity checks)
CREATE OR REPLACE FUNCTION recalculate_user_count()
RETURNS INTEGER AS $$
DECLARE
    actual_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO actual_count FROM user_list;
    
    UPDATE user_stats 
    SET total_users = actual_count, 
        last_updated = CURRENT_TIMESTAMP 
    WHERE id = 1;
    
    RETURN actual_count;
END;
$$ LANGUAGE plpgsql;
