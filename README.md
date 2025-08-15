# Fastify User Count API

A high-performance RESTful API built with Fastify that provides optimized user count operations using PostgreSQL materialized views with triggers for O(1) read performance.

## 🚀 Features

- **O(1) User Count**: Uses materialized views with database triggers for instant count retrieval
- **High Performance**: Fastify framework with connection pooling
- **Real-time Updates**: Database triggers maintain count accuracy automatically
- **Comprehensive Error Handling**: Graceful error responses and logging
- **Health Monitoring**: Built-in health check endpoint
- **Production Ready**: Includes graceful shutdown and proper logging
- **Docker Support**: Easy PostgreSQL setup with Docker

## 📋 Prerequisites

- Node.js (v16 or higher)
- Docker (for PostgreSQL container)
- npm or yarn

## 🛠️ Quick Start Installation

### 1. **Clone and Install**
```bash
git clone <repository-url>
cd fastify-usercount-api
npm install
```

### 2. **Setup Environment**
```bash
cp .env.example .env
```

Edit `.env` file:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test001
DB_USER=postgres
DB_PASSWORD=mypassword123
PORT=6776
NODE_ENV=development
```

### 3. **Start PostgreSQL with Docker**
```bash
docker run -d --name test001 -e POSTGRES_DB=test001 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=mypassword123 -p 5432:5432 -v postgres_data:/var/lib/postgresql/data postgres:15
```

### 4. **Run Database Migration**
```bash
npm run migrate
```

### 5. **Add Sample Data (Optional)**
```bash
node src/migrations/setup.js sample
```

### 6. **Start the Server**
```bash
npm run dev
```

🎉 **API is now running at:** `http://localhost:6776`

## 🗄️ Database Setup Options

### Option 1: Docker (Recommended)

**Start PostgreSQL Container:**
```bash
docker run -d --name test001 -e POSTGRES_DB=test001 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=mypassword123 -p 5432:5432 -v postgres_data:/var/lib/postgresql/data postgres:15
```

**Manage Container:**
```bash
# Start container
docker start test001

# Stop container
docker stop test001

# Connect to database
docker exec -it test001 psql -U postgres -d test001
```

### Option 2: Local PostgreSQL

1. **Install PostgreSQL locally**
2. **Create database:**
   ```sql
   CREATE DATABASE test001;
   ```
3. **Update .env with your local credentials**

### Option 3: Manual Schema Setup

```bash
psql -U postgres -d test001 -f src/database/schema.sql
```

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:6776`

## 📡 API Endpoints

### Get User Count
```http
GET /api/usercount
```

**Response:**
```json
{
  "totalUsers": 42,
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": {
    "status": "healthy",
    "connected": true
  }
}
```

### Add Sample Data

```bash
node src/migrations/setup.js sample
```

### Manual Testing with Postman

1. **Import Collection**: Use `postman-collection.json`
2. **Set Environment**: `baseUrl = http://localhost:6776`
3. **Run Tests**: Execute collection to test all endpoints

### Verify Trigger Functionality

```bash
# Connect to database
docker exec -it test001 psql -U postgres -d test001

# Check current count
SELECT * FROM user_stats;

# Add a user manually
INSERT INTO user_list (username, email) VALUES ('test_user', 'test@example.com');

# Verify count increased
SELECT * FROM user_stats;

# Remove the user
DELETE FROM user_list WHERE username = 'test_user';

# Verify count decreased
SELECT * FROM user_stats;
```

## 🏗️ Architecture & Logic

### Core Concept: Materialized View with Triggers

Instead of using expensive `COUNT(*)` queries that scan all rows (O(n) complexity), this system uses a **materialized view approach** with database triggers for O(1) performance.

### Database Schema

**user_list** (Main transactional table)
```sql
CREATE TABLE user_list (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**user_stats** (Materialized view - single row table)
```sql
CREATE TABLE user_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_users INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row_constraint CHECK (id = 1)
);
```

### Trigger System Logic

**1. INSERT Trigger:**
```sql
-- When a user is added to user_list
INSERT INTO user_list → Trigger fires → UPDATE user_stats SET total_users = total_users + 1
```

**2. DELETE Trigger:**
```sql
-- When a user is removed from user_list
DELETE FROM user_list → Trigger fires → UPDATE user_stats SET total_users = total_users - 1
```

**3. Trigger Function:**
```sql
CREATE OR REPLACE FUNCTION update_user_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE user_stats SET total_users = total_users + 1, last_updated = CURRENT_TIMESTAMP WHERE id = 1;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE user_stats SET total_users = total_users - 1, last_updated = CURRENT_TIMESTAMP WHERE id = 1;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### Performance Comparison

| Method | Complexity | Description | Use Case |
|--------|------------|-------------|----------|
| `SELECT COUNT(*) FROM user_list` | **O(n)** | Scans all rows, slow on large tables | ❌ Not suitable for high-traffic APIs |
| `SELECT total_users FROM user_stats` | **O(1)** | Single row lookup, constant time | ✅ Perfect for real-time APIs |

### Real-time Accuracy

- **Immediate Updates**: Triggers fire automatically on data changes
- **ACID Compliance**: Database transactions ensure consistency
- **No Cache Invalidation**: No need to manage cache expiration
- **Concurrent Safe**: Database handles multiple simultaneous operations

### Benefits

- **Ultra-Fast Reads**: O(1) performance regardless of table size
- **Real-time Accuracy**: Count is always current, no stale data
- **Zero Application Logic**: Database handles everything automatically
- **Scalable**: Performance doesn't degrade with millions of users
- **Reliable**: Database ACID properties ensure data consistency

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | test001 | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | - | Database password |
| `PORT` | 6776 | Server port |
| `NODE_ENV` | development | Environment |

### Database Connection Pool

- **Max Connections**: 20
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 2 seconds

## 📊 Monitoring

### Logs
- Slow queries (>100ms) are logged
- Database connection status
- Error tracking with timestamps

### Health Check
Monitor application health at `/health` endpoint

## 🚨 Error Handling

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 404 | Endpoint not found |
| 500 | Internal server error |
| 503 | Service unavailable (database issues) |

## 🔄 Maintenance

### Manual Count Recalculation
If data integrity issues occur:
```sql
SELECT recalculate_user_count();
```

### Backup Considerations
- Backup both `user_list` and `user_stats` tables
- Triggers and functions are included in schema dumps

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with auto-reload |
| `npm run migrate` | Run database migrations |
| `npm test api` | Test API endpoints (requires server running) |
| `npm test triggers` | Test database triggers and functions |
| `node src/migrations/setup.js sample` | Add sample data for testing |

## 🔧 Troubleshooting

### Common Issues

**Database Connection Failed:**
```bash
# Check if Docker container is running
docker ps

# Start the container if stopped
docker start test001

# Check container logs
docker logs test001
```

**Migration Fails:**
```bash
# Ensure database exists
docker exec -it test001 psql -U postgres -c "CREATE DATABASE test001;"

# Re-run migration
npm run migrate
```

**Port Already in Use:**
```bash
# Change PORT in .env file
PORT=6777

# Or kill process using port 6776
lsof -ti:6776 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :6776   # Windows
```

## 🚀 Production Deployment

### Environment Variables for Production

```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=test001
DB_USER=your-production-user
DB_PASSWORD=your-secure-password
PORT=6776
```

### Docker Compose for Production

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "6776:6776"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: test001
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your-secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details