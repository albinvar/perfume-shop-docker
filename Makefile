# Makefile for Perfume Shop Application

.PHONY: help build up down restart logs shell migrate test clean

help:
	@echo "Available commands:"
	@echo "  make build       - Build Docker images"
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make restart     - Restart all services"
	@echo "  make logs        - View logs for all services"
	@echo "  make shell-backend - Access backend shell"
	@echo "  make shell-app   - Access app shell"
	@echo "  make migrate     - Run Django migrations"
	@echo "  make superuser   - Create Django superuser"
	@echo "  make test        - Run tests"
	@echo "  make clean       - Clean up containers and volumes"

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

shell-backend:
	docker-compose exec backend /bin/sh

shell-app:
	docker-compose exec app /bin/sh

migrate:
	docker-compose exec backend python manage.py migrate

superuser:
	docker-compose exec backend python manage.py createsuperuser

test:
	docker-compose exec backend python manage.py test

clean:
	docker-compose down -v
	docker system prune -f