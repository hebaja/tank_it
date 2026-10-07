COMPOSE = docker compose -f docker-compose.yml

all: up

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) --profile dev --profile prod down --remove-orphans

build:
	$(COMPOSE) build

rebuild:
	$(COMPOSE) up -d --build

logs:
	$(COMPOSE) logs -f

clean:
	$(COMPOSE) --profile dev --profile prod down -v --remove-orphans

fclean:
	$(COMPOSE) --profile dev --profile prod down -v --rmi local --remove-orphans

ps:
	$(COMPOSE) ps

dev:
	$(COMPOSE) --profile dev up -d

prod:
	$(COMPOSE) --profile prod up -d

db-migrate:
	cd backend && dotnet ef database update -p src/TankIt.Api -s src/TankIt.Api

db-migration-add name=MigrationName:
	cd backend && dotnet ef migrations add $(name) -p src/TankIt.Api -s src/TankIt.Api

.PHONY: all up down build rebuild logs clean fclean ps dev prod db-migrate db-migration-add