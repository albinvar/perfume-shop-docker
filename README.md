# Perfume Shop Application

A full-stack perfume shop management system with Django backend and Expo React Native web frontend.

## Architecture

- **Backend**: Django REST Framework API (Python)
- **Frontend**: Expo React Native (Web version)
- **Database**: PostgreSQL
- **File Storage**: Cloudinary
- **SMS**: Twilio

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed
- Git

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository (if not already done)
git clone <your-repo-url>
cd PROJECT

# Copy environment files
cp backend-main/.env.example backend-main/.env
cp perfume-shop-mobile/.env.example perfume-shop-mobile/.env
```

### 2. Configure Environment Variables

Edit `backend-main/.env` with your actual values:
- `SECRET_KEY`: Generate a secure Django secret key
- `CLOUDINARY_*`: Your Cloudinary credentials
- `TWILIO_*`: Your Twilio credentials (optional)

### 3. Build and Run with Docker

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build

# For development with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### 4. Initialize the Backend

```bash
# Create a superuser for Django admin
docker-compose exec backend python manage.py createsuperuser

# Load initial data (if available)
docker-compose exec backend python manage.py loaddata data.json
```

## Access Points

- **Backend API**: http://localhost:8000/api/
- **Django Admin**: http://localhost:8000/admin/
- **Expo Web App**: http://localhost:3000/
- **PostgreSQL**: localhost:5432 (database: perfume_shop)

## Docker Commands

### Start Services
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Start specific service
docker-compose up backend
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (database data)
docker-compose down -v
```

### View Logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs app
docker-compose logs db

# Follow logs
docker-compose logs -f backend
```

### Execute Commands
```bash
# Django management commands
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py collectstatic
docker-compose exec backend python manage.py shell

# Access container shell
docker-compose exec backend /bin/sh
docker-compose exec app /bin/sh
```

### Rebuild Services
```bash
# Rebuild all services
docker-compose build

# Rebuild specific service
docker-compose build backend

# Rebuild and restart
docker-compose up --build
```

## Development

### Backend Development

The backend uses Django with REST Framework. Key directories:
- `backend-main/accounts/`: User authentication and management
- `backend-main/products/`: Product management
- `backend-main/purchases/`: Purchase tracking
- `backend-main/Sales/`: Sales management
- `backend-main/reports/`: Reporting functionality

### Frontend Development

The frontend uses Expo with React Native for web. To develop locally:

```bash
# Install dependencies locally
cd perfume-shop-mobile
npm install

# Run web version
npm run web

# Run with specific port
npx expo start --web --port 3000
```

### Database Management

```bash
# Create migrations
docker-compose exec backend python manage.py makemigrations

# Apply migrations
docker-compose exec backend python manage.py migrate

# Access PostgreSQL
docker-compose exec db psql -U postgres -d perfume_shop
```

## API Endpoints

Main API endpoints available:

- `/api/token/`: JWT token authentication
- `/api/token/refresh/`: Refresh JWT token
- `/api/register/`: User registration
- `/api/products/`: Product CRUD operations
- `/api/purchases/`: Purchase management
- `/api/sales/`: Sales management
- `/api/accounts/`: User/Staff management
- `/api/reports/`: Various reports

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process using port 8000
# On Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# On Mac/Linux:
lsof -i :8000
kill -9 <PID>
```

### Database Connection Issues
```bash
# Restart database
docker-compose restart db

# Check database logs
docker-compose logs db
```

### Clear Docker Cache
```bash
# Remove all containers and volumes
docker-compose down -v

# Remove Docker build cache
docker system prune -a
```

## Production Deployment

For production deployment:

1. Update environment variables with production values
2. Set `DEBUG=False` in Django settings
3. Use proper SECRET_KEY
4. Configure proper CORS origins
5. Set up SSL certificates
6. Use production-grade database credentials
7. Configure proper logging

## Support

For issues or questions, please check:
- Django logs: `docker-compose logs backend`
- Expo logs: `docker-compose logs app`
- Database logs: `docker-compose logs db`